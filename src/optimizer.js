// Performs AST optimizations including constant folding, dead code elimination,
// strength reduction, and loop unrolling before target code generation.

import * as core from "./core.js";

// -------- SETUP & HELPERS --------

const isZero = (n) => n === 0;
const isOne = (n) => n === 1;

// Flattens optimized arrays and stops processing after terminal jumps
function optimizeBlock(statements) {
  const result = [];
  for (const statement of statements) {
    const optimizedStmt = optimize(statement);
    const flattened = Array.isArray(optimizedStmt)
      ? optimizedStmt
      : [optimizedStmt];
    result.push(...flattened);

    if (
      flattened.some((s) =>
        ["CutStatement", "ReturnStatement", "ShortReturnStatement"].includes(
          s.kind,
        ),
      )
    ) {
      break;
    }
  }
  return result;
}

// -------- CORE OPTIMIZER --------

export default function optimize(node) {
  return optimizers?.[node.kind]?.(node) ?? node;
}

const optimizers = {
  // -------- DECLARATIONS --------

  Program(p) {
    p.body = optimizeBlock(p.body);
    return p;
  },
  VariableDeclaration(d) {
    d.variable = optimize(d.variable);
    d.initializer = optimize(d.initializer);
    return d;
  },
  StructDeclaration(d) {
    return d;
  },
  FunctionDeclaration(d) {
    d.function = optimize(d.function);
    d.body = optimizeBlock(d.body);
    return d;
  },
  FunctionObject(f) {
    return f;
  },

  // -------- STATEMENTS --------

  AssignStatement(s) {
    s.source = optimize(s.source);
    s.target = optimize(s.target);
    if (s.source.name && s.target.name && s.source.name === s.target.name)
      return [];
    return s;
  },
  BumpStatement(s) {
    s.variable = optimize(s.variable);
    return s;
  },
  CutStatement(s) {
    return s;
  },
  ReturnStatement(s) {
    s.expression = optimize(s.expression);
    return s;
  },
  ShortReturnStatement(s) {
    return s;
  },
  PlayStatement(s) {
    s.argument = optimize(s.argument);
    return s;
  },

  // -------- CONTROL FLOW & LOOPS --------

  IfStatement(s) {
    s.test = optimize(s.test);
    s.consequent = optimizeBlock(s.consequent);
    s.alternate = optimizeBlock(s.alternate);

    if (s.test.constructor === Boolean) {
      return s.test ? s.consequent : s.alternate;
    }
    if (s.consequent.length === 0 && s.alternate.length === 0) {
      if (
        s.test.kind === "Variable" ||
        s.test.constructor === Boolean ||
        s.test.constructor === Number
      )
        return [];
    }
    return s;
  },
  VampStatement(s) {
    s.test = optimize(s.test);
    if (s.test === false) return [];

    s.body = optimizeBlock(s.body);
    if (s.body.length === 0) {
      if (
        s.test.kind === "Variable" ||
        s.test.constructor === Boolean ||
        s.test.constructor === Number
      )
        return [];
    }
    return s;
  },
  EncoreStatement(s) {
    s.count = optimize(s.count);
    if (s.count === 0) return [];

    s.body = optimizeBlock(s.body);
    if (s.body.length === 0) return [];

    if (s.count.constructor === Number && s.count <= 5) {
      const unrolled = [];
      for (let i = 0; i < s.count; i++) {
        unrolled.push(...structuredClone(s.body));
      }
      return unrolled;
    }
    return s;
  },
  MeasureRangeStatement(s) {
    s.iterator = optimize(s.iterator);
    s.low = optimize(s.low);
    s.high = optimize(s.high);
    s.body = optimizeBlock(s.body);

    if (
      s.low.constructor === Number &&
      s.high.constructor === Number &&
      s.low > s.high
    )
      return [];
    return s;
  },
  MeasureInStatement(s) {
    s.iterator = optimize(s.iterator);
    s.collection = optimize(s.collection);
    s.body = optimizeBlock(s.body);

    if (
      s.collection?.kind === "ArrayLiteral" &&
      s.collection.elements.length === 0
    )
      return [];
    return s;
  },

  // -------- EXPRESSIONS --------

  ConditionalExpression(e) {
    e.test = optimize(e.test);
    e.consequent = optimize(e.consequent);
    e.alternate = optimize(e.alternate);
    if (e.test.constructor === Boolean) {
      return e.test ? e.consequent : e.alternate;
    }
    return e;
  },
  UnwrapElseExpression(e) {
    e.optional = optimize(e.optional);
    e.alternate = optimize(e.alternate);
    return e;
  },
  BinaryExpression(e) {
    e.left = optimize(e.left);
    e.right = optimize(e.right);

    if (e.operator === "&&") {
      if (e.left === true) return e.right;
      if (e.right === true) return e.left;
      if (e.left === false || e.right === false) return false;
    } else if (e.operator === "||") {
      if (e.left === false) return e.right;
      if (e.right === false) return e.left;
      if (e.left === true || e.right === true) return true;
    } else if (e.left.constructor === Number) {
      if (e.right.constructor === Number) {
        if (e.operator === "+") return e.left + e.right;
        if (e.operator === "-") return e.left - e.right;
        if (e.operator === "*") return e.left * e.right;
        if (e.operator === "/") return e.left / e.right;
        if (e.operator === "**" || e.operator === "^") return e.left ** e.right;
        if (e.operator === "%") return e.left % e.right;
        if (e.operator === "<") return e.left < e.right;
        if (e.operator === "<=") return e.left <= e.right;
        if (e.operator === "==") return e.left === e.right;
        if (e.operator === "!=") return e.left !== e.right;
        if (e.operator === ">=") return e.left >= e.right;
        if (e.operator === ">") return e.left > e.right;
      }
      if (isZero(e.left) && e.operator === "+") return e.right;
      if (isOne(e.left) && e.operator === "*") return e.right;
      if (isOne(e.left) && (e.operator === "**" || e.operator === "^"))
        return e.left;
      if (isZero(e.left) && ["*", "/"].includes(e.operator)) return e.left;
    } else if (e.right.constructor === Number) {
      if (["+", "-"].includes(e.operator) && isZero(e.right)) return e.left;
      if (["*", "/"].includes(e.operator) && isOne(e.right)) return e.left;
      if (e.operator === "*" && isZero(e.right)) return e.right;
      if ((e.operator === "**" || e.operator === "^") && isZero(e.right))
        return 1;
    }
    return e;
  },
  UnaryExpression(e) {
    e.argument = optimize(e.argument);
    if (e.argument.constructor === Number && e.operator === "-")
      return -e.argument;
    if (e.argument.constructor === Boolean && e.operator === "!")
      return !e.argument;
    return e;
  },
  ArrayLiteral(e) {
    e.elements = e.elements.map(optimize);
    return e;
  },
  SubscriptExpression(e) {
    e.array = optimize(e.array);
    e.index = optimize(e.index);
    return e;
  },
  MemberExpression(e) {
    e.object = optimize(e.object);
    return e;
  },
  FunctionCall(c) {
    c.callee = optimize(c.callee);
    c.arguments = c.arguments.map(optimize);

    if (
      c.callee === core.standardLibrary.sqrt &&
      c.arguments[0].constructor === Number
    ) {
      return Math.sqrt(c.arguments[0]);
    }
    if (
      c.callee === core.standardLibrary.hypot &&
      c.arguments[0].constructor === Number &&
      c.arguments[1].constructor === Number
    ) {
      return Math.hypot(c.arguments[0], c.arguments[1]);
    }
    return c;
  },
};
