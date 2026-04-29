import * as core from "./core.js"

// Translates the optimized Groovy Abstract Syntax Tree (AST) into executable JavaScript.
// Handles variable renaming, scoping, and mapping Groovy constructs to native JS equivalents.

export default function generate(program) {
  // -------- SETUP --------

  const output = []

  // Prevents JS keyword collisions
  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  // -------- CORE GENERATOR --------

  const gen = node => {
    if (node === undefined) return "undefined"
    if (typeof node !== "object") return JSON.stringify(node)
    if (!generators[node.kind]) throw new Error(`No generator for ${node.kind}`)
    return generators[node.kind](node)
  }

  // Wraps standalone expression statements
  const generateBlock = statements => {
    statements.forEach(statement => {
      const result = gen(statement)
      if (typeof result === "string") output.push(`${result};`)
    })
  }

  const generators = {
    Program(p) {
      generateBlock(p.body)
    },

    // -------- STRUCTURE & TYPES --------

    VariableDeclaration(d) {
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`)
    },
    Variable(v) {
      return targetName(v)
    },
    StructDeclaration(d) {
      output.push(`class ${d.name} {`)
      const fieldNames = d.fields.map(f => f.name)
      output.push(`constructor(${fieldNames.join(", ")}) {`)
      for (let name of fieldNames) {
        output.push(`this.${name} = ${name};`)
      }
      output.push("}")
      output.push("}")
    },

    // -------- FUNCTIONS --------

    FunctionDeclaration(d) {
      output.push(
        `function ${gen(d.function)}(${d.function.params.map(gen).join(", ")}) {`,
      )
      generateBlock(d.body)
      output.push("}")
    },
    FunctionObject(f) {
      return targetName(f)
    },
    FunctionCall(c) {
      if (c.callee === core.standardLibrary.sqrt)
        return `Math.sqrt(${gen(c.arguments[0])})`
      if (c.callee === core.standardLibrary.hypot)
        return `Math.hypot(${gen(c.arguments[0])}, ${gen(c.arguments[1])})`
      return `${gen(c.callee)}(${c.arguments.map(gen).join(", ")})`
    },

    // -------- STATEMENTS & CONTROL FLOW --------

    PlayStatement(s) {
      output.push(`console.log(${gen(s.argument)});`)
    },
    AssignStatement(s) {
      output.push(`${gen(s.target)} = ${gen(s.source)};`)
    },
    BumpStatement(s) {
      const op = s.operator === "sharp" ? "++" : "--"
      output.push(`${gen(s.variable)}${op};`)
    },
    CutStatement(s) {
      output.push("break;")
    },
    ReturnStatement(s) {
      output.push(`return ${gen(s.expression)};`)
    },
    ShortReturnStatement(s) {
      output.push("return;")
    },
    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      generateBlock(s.consequent)

      if (s.alternate && s.alternate.length > 0) {
        if (s.alternate[0].kind === "IfStatement") {
          output.push("} else")
          gen(s.alternate[0])
        } else {
          output.push("} else {")
          generateBlock(s.alternate)
          output.push("}")
        }
      } else {
        output.push("}")
      }
    },

    // -------- LOOPS --------

    VampStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      generateBlock(s.body)
      output.push("}")
    },
    EncoreStatement(s) {
      // Hidden counter for JS loop
      const i = targetName({ name: "i" })
      output.push(`for (let ${i} = 0; ${i} < ${gen(s.count)}; ${i}++) {`)
      generateBlock(s.body)
      output.push("}")
    },
    MeasureRangeStatement(s) {
      const i = gen(s.iterator)
      output.push(`for (let ${i} = ${gen(s.low)}; ${i} <= ${gen(s.high)}; ${i}++) {`)
      generateBlock(s.body)
      output.push("}")
    },
    MeasureInStatement(s) {
      output.push(`for (let ${gen(s.iterator)} of ${gen(s.collection)}) {`)
      generateBlock(s.body)
      output.push("}")
    },

    // -------- EXPRESSIONS --------

    ConditionalExpression(e) {
      return `((${gen(e.test)}) ? (${gen(e.consequent)}) : (${gen(e.alternate)}))`
    },
    UnwrapElseExpression(e) {
      return `(${gen(e.optional)} ?? ${gen(e.alternate)})`
    },
    BinaryExpression(e) {
      const op = { "==": "===", "!=": "!==" }[e.operator] ?? e.operator
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },
    UnaryExpression(e) {
      if (e.operator === "ghost") return gen(e.argument)
      return `(${e.operator}${gen(e.argument)})`
    },
    ArrayLiteral(e) {
      return `[${e.elements.map(gen).join(", ")}]`
    },
    SubscriptExpression(e) {
      return `${gen(e.array)}[${gen(e.index)}]`
    },
    MemberExpression(e) {
      return `${gen(e.object)}.${e.field}`
    },
  }

  gen(program)
  return output.join("\n")
}
