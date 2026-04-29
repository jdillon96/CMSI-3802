// Enforces static type safety, variable immutability, and scoping rules.
// Uses Ohm.js semantics to traverse the parsed tree and build a validated Abstract Syntax Tree.

import * as core from "./core.js"

// -------- SCOPE TRACKING --------

class Context {
  constructor(parent = null) {
    this.parent = parent
    this.bindings = new Map()
  }
  get(name, at) {
    if (this.bindings.has(name)) return this.bindings.get(name)
    if (this.parent) return this.parent.get(name, at)
    error(`Undefined identifier: ${name}`, at)
  }
  set(name, value, at) {
    if (this.bindings.has(name))
      error(`Identifier already declared in this scope: ${name}`, at)
    this.bindings.set(name, value)
  }
}

function error(message, at) {
  const prefix = at.getLineAndColumnMessage()
  throw new Error(`${prefix}${message}`)
}

// -------- TYPE VALIDATION HELPERS --------

function typeOf(value) {
  if (typeof value === "string") return value
  if (typeof value === "number") return "level"
  if (typeof value === "boolean") return "gate"
  return value?.type ?? "unknown"
}

function typesMatch(t1, t2) {
  if (t1 === t2) return true
  if (typeof t1 !== typeof t2) return false
  if (typeof t1 === "object" && typeof t2 === "object") {
    if (t1.kind !== t2.kind) return false
    return typesMatch(t1.baseType, t2.baseType)
  }
  return false
}

function validate(condition, message, at) {
  if (!condition) error(message, at)
}

function validateGate(value, at) {
  validate(
    typesMatch(typeOf(value), "gate"),
    `Expected a gate (boolean), but got ${JSON.stringify(typeOf(value))}`,
    at,
  )
}

function validateLevel(value, at) {
  validate(
    typesMatch(typeOf(value), "level"),
    `Expected a level (number), but got ${JSON.stringify(typeOf(value))}`,
    at,
  )
}

function validateNotReadOnly(variable, at) {
  validate(
    !variable.readOnly,
    `Cannot overwrite immutable 'key' variable: ${variable.name}`,
    at,
  )
}

function validateSameType(target, source, at) {
  validate(
    typesMatch(typeOf(target), typeOf(source)),
    `Type mismatch. Cannot assign/compare ${JSON.stringify(typeOf(source))} to ${JSON.stringify(typeOf(target))}`,
    at,
  )
}

// -------- SEMANTIC ANALYZER --------

export default function translate(match) {
  let context = new Context()

  for (const [name, entity] of Object.entries(core.standardLibrary)) {
    context.set(name, entity)
  }

  const grammar = match.matcher.grammar

  const actions = {
    _iter(...children) {
      return children.map(c => c.translate())
    },
    _terminal() {
      return this.sourceString
    },

    Program(statements) {
      return core.program(statements.children.map(s => s.translate()))
    },
    Block(statements) {
      return statements.children.map(s => s.translate())
    },

    // -------- DECLARATIONS --------

    VarDecl(modifier, id, _eq, expression) {
      const source = expression.translate()
      const isReadOnly = modifier.sourceString === "key"
      const target = core.variable(id.sourceString, isReadOnly, typeOf(source))
      context.set(id.sourceString, target, id.source)
      return core.varDecl(target, source)
    },

    StructDecl(_chord, id, _colon, fields, _cadence) {
      const name = id.sourceString
      const fieldList = fields.children.map(f => f.translate())
      const struct = core.structDecl(name, fieldList)
      context.set(name, struct, id.source)
      return struct
    },

    Field(id, _colon, type) {
      return core.fieldDecl(id.sourceString, type.translate())
    },

    FunDecl(_compose, id, params, _arrow, optRet, _colon, block, _cadence) {
      const paramList = params.translate()
      const returnType =
        optRet.children.length > 0 ? optRet.children[0].translate() : "silence"

      const funContext = new Context(context)
      for (const param of paramList) {
        funContext.set(param.name, param, id.source)
      }

      const func = core.functionObject(id.sourceString, paramList, returnType)
      context.set(id.sourceString, func, id.source)

      const previousContext = context
      context = funContext
      const body = block.translate()
      context = previousContext

      return core.functionDecl(func, body)
    },

    Params(_open, paramList, _close) {
      return paramList.asIteration().children.map(p => p.translate())
    },

    Param(id, _colon, type) {
      return core.variable(id.sourceString, true, type.translate())
    },

    // -------- STATEMENTS & CONTROL FLOW --------

    Statement_print(_play, expression) {
      return core.playStmt(expression.translate())
    },

    Statement_assign(idExp, _eq, expression) {
      const target = idExp.translate()
      const source = expression.translate()
      validateNotReadOnly(target, idExp.source)
      validateSameType(target, source, idExp.source)
      return core.assignStmt(target, source)
    },

    Statement_bump(idExp, op) {
      const target = idExp.translate()
      validateLevel(target, idExp.source)
      validateNotReadOnly(target, idExp.source)
      return core.bumpStmt(target, op.sourceString)
    },

    Statement_break(_cut) {
      return core.cutStmt()
    },
    Statement_return(_fin, expression) {
      return core.returnStmt(expression.translate())
    },
    Statement_shortreturn(_fin) {
      return core.shortReturnStmt()
    },

    IfStmt(
      _cue,
      testExp,
      _c1,
      block,
      _alt,
      altExps,
      _c2,
      altBlocks,
      _drop,
      _c3,
      dropBlock,
      _cadence,
    ) {
      const test = testExp.translate()
      validateGate(test, testExp.source)
      const consequent = block.translate()

      const alternates = altExps.children.map((e, i) => {
        const altTest = e.translate()
        validateGate(altTest, e.source)
        return core.ifStmt(altTest, altBlocks.children[i].translate(), [])
      })

      const finalAlternate =
        dropBlock.children.length > 0 ? dropBlock.children[0].translate() : []
      if (finalAlternate.length > 0) {
        if (alternates.length > 0)
          alternates[alternates.length - 1].alternate = finalAlternate
        else return core.ifStmt(test, consequent, finalAlternate)
      }
      return core.ifStmt(test, consequent, alternates.length > 0 ? [alternates[0]] : [])
    },

    // -------- LOOPS --------

    LoopStmt_while(_vamp, expression, _colon, block, _cadence) {
      const test = expression.translate()
      validateGate(test, expression.source)
      return core.vampStmt(test, block.translate())
    },

    LoopStmt_repeat(_encore, expression, _colon, block, _cadence) {
      const count = expression.translate()
      validateLevel(count, expression.source)
      return core.encoreStmt(count, block.translate())
    },

    LoopStmt_range(_measure, id, _from, lowExp, _to, highExp, _colon, block, _cadence) {
      const low = lowExp.translate()
      const high = highExp.translate()
      validateLevel(low, lowExp.source)
      validateLevel(high, highExp.source)

      const iterator = core.variable(id.sourceString, true, "level")
      const loopContext = new Context(context)
      loopContext.set(iterator.name, iterator, id.source)

      const previousContext = context
      context = loopContext
      const loopBody = block.translate()
      context = previousContext

      return core.measureRangeStmt(iterator, low, high, loopBody)
    },

    LoopStmt_collection(_measure, id, _in, exp, _colon, block, _cadence) {
      const collection = exp.translate()
      const collectionType = typeOf(collection)
      validate(
        collectionType.kind === "ArrayType",
        "Can only use 'in' to measure an array",
        exp.source,
      )

      const iterator = core.variable(id.sourceString, true, collectionType.baseType)
      const loopContext = new Context(context)
      loopContext.set(iterator.name, iterator, id.source)

      const previousContext = context
      context = loopContext
      const loopBody = block.translate()
      context = previousContext

      return core.measureInStmt(iterator, collection, loopBody)
    },

    // -------- TYPES & EXPRESSIONS --------

    Type_primitive(prim) {
      return prim.sourceString
    },
    Type_array(_open, type, _close) {
      return core.typeDeclaration("ArrayType", type.translate())
    },
    Type_optional(_ghost, type) {
      return core.typeDeclaration("OptionalType", type.translate())
    },
    Type_id(id) {
      return id.sourceString
    },

    Exp_conditional(testExp, _q, consExp, _colon, altExp) {
      const test = testExp.translate()
      validateGate(test, testExp.source)
      const consequent = consExp.translate()
      const alternate = altExp.translate()
      validateSameType(consequent, alternate, altExp.source)
      return core.conditionalExp(test, consequent, alternate, typeOf(consequent))
    },

    Exp1_unwrapelse(leftExp, _qq, rightExp) {
      const left = leftExp.translate()
      const right = rightExp.translate()
      const leftType = typeOf(left)
      validate(
        leftType.kind === "OptionalType",
        "Can only unwrap a 'ghost' type",
        leftExp.source,
      )
      validate(
        typesMatch(leftType.baseType, typeOf(right)),
        "Unwrap types do not match",
        rightExp.source,
      )
      return core.unwrapElseExp(left, right, typeOf(right))
    },

    Exp2_or(left, _ops, right) {
      const rightNodes = right.translate()
      let x = left.translate()
      validateGate(x, left.source)
      for (const y of rightNodes) {
        validateGate(y, right.source)
        x = core.binaryExp(x, "||", y, "gate")
      }
      return x
    },

    Exp2_and(left, _ops, right) {
      const rightNodes = right.translate()
      let x = left.translate()
      validateGate(x, left.source)
      for (const y of rightNodes) {
        validateGate(y, right.source)
        x = core.binaryExp(x, "&&", y, "gate")
      }
      return x
    },

    Exp3_compare(left, op, right) {
      const x = left.translate()
      const y = right.translate()
      const operator = op.sourceString

      if (["<", "<=", ">", ">="].includes(operator)) {
        validateLevel(x, left.source)
        validateLevel(y, right.source)
      } else {
        validateSameType(x, y, left.source)
      }

      return core.binaryExp(x, operator, y, "gate")
    },

    Exp4_add(left, op, right) {
      const x = left.translate()
      const y = right.translate()
      validateLevel(x, left.source)
      validateLevel(y, right.source)
      return core.binaryExp(x, op.sourceString, y, "level")
    },

    Exp5_multiply(left, op, right) {
      const x = left.translate()
      const y = right.translate()
      validateLevel(x, left.source)
      validateLevel(y, right.source)
      return core.binaryExp(x, op.sourceString, y, "level")
    },

    Exp6_power(left, _caret, right) {
      const x = left.translate()
      const y = right.translate()
      validateLevel(x, left.source)
      validateLevel(y, right.source)
      return core.binaryExp(x, "**", y, "level")
    },

    Exp6_unary(op, expression) {
      const x = expression.translate()
      const operator = op.sourceString
      if (operator === "-") validateLevel(x, op.source)
      if (operator === "!") validateGate(x, op.source)
      const returnType =
        operator === "!"
          ? "gate"
          : operator === "-"
            ? "level"
            : core.typeDeclaration("OptionalType", typeOf(x))
      return core.unaryExp(operator, x, returnType)
    },

    Exp7_call(calleeExp, _open, args, _close) {
      const callee = calleeExp.translate()
      validate(
        callee.kind === "FunctionObject",
        "Attempted to call a non-composition",
        calleeExp.source,
      )
      const argValues = args.asIteration().children.map(arg => arg.translate())
      validate(
        argValues.length === callee.params.length,
        `Expected ${callee.params.length} inputs, got ${argValues.length}`,
        args.source,
      )
      for (let i = 0; i < argValues.length; i++) {
        validateSameType(callee.params[i], argValues[i], args.source)
      }
      return core.functionCall(callee, argValues, callee.returnType)
    },

    Exp7_subscript(arrayExp, _open, indexExp, _close) {
      const array = arrayExp.translate()
      const index = indexExp.translate()
      validate(
        typeOf(array).kind === "ArrayType",
        "Can only subscript an array",
        arrayExp.source,
      )
      validateLevel(index, indexExp.source)
      return core.subscriptExp(array, index, typeOf(array).baseType)
    },

    Exp7_member(objectExp, op, id) {
      const object = objectExp.translate()
      const structName = typeOf(object)

      if (typeof structName !== "string") error("Target is not a chord", objectExp.source)

      let struct
      try {
        struct = context.get(structName, objectExp.source)
      } catch (err) {
        error("Target is not a chord", objectExp.source)
      }

      validate(
        struct.kind === "StructDeclaration",
        "Target is not a chord",
        objectExp.source,
      )

      const field = struct.fields.find(f => f.name === id.sourceString)
      validate(
        field !== undefined,
        `Chord ${structName} has no note named ${id.sourceString}`,
        id.source,
      )

      const type =
        op.sourceString === "?."
          ? core.typeDeclaration("OptionalType", field.type)
          : field.type
      return core.memberExp(object, id.sourceString, type)
    },

    Exp7_arrayexp(_open, elements, _close) {
      const elems = elements.asIteration().children.map(e => e.translate())
      const baseType = typeOf(elems[0])

      for (const el of elems) {
        validate(
          typesMatch(baseType, typeOf(el)),
          "Type mismatch in array",
          elements.source,
        )
      }
      return core.arrayLiteral(elems, core.typeDeclaration("ArrayType", baseType))
    },

    Exp7_parens(_open, expression, _close) {
      return expression.translate()
    },
    Exp7_id(id) {
      return context.get(id.sourceString, id.source)
    },

    // -------- LITERALS & TERMINALS --------

    intlit(_digits) {
      return Number(this.sourceString)
    },
    floatlit(_whole, _dot, _fraction, _e, _sign, _exp) {
      return Number(this.sourceString)
    },
    open(_) {
      return true
    },
    closed(_) {
      return false
    },
    stringlit(_openQuote, chars, _closeQuote) {
      return chars.sourceString
    },
  }

  const semantics = grammar.createSemantics().addOperation("translate", actions)
  return semantics(match).translate()
}
