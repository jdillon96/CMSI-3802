// Defines the factory functions for building the Abstract Syntax Tree (AST).
// Each function returns a lightweight, strongly-typed JSON object representing a node in the compiler pipeline.

// -------- STRUCTURE & TYPES --------

export function program(body) {
  return { kind: "Program", body }
}

export function typeDeclaration(kind, baseType) {
  return {
    kind,
    baseType,
  }
}

export function structDecl(name, fields) {
  return {
    kind: "StructDeclaration",
    name,
    fields,
  }
}

export function fieldDecl(name, type) {
  return {
    kind: "Field",
    name,
    type,
  }
}

// -------- VARIABLES --------

export function variable(name, readOnly, type) {
  return {
    kind: "Variable",
    name,
    readOnly,
    type,
  }
}

export function varDecl(variable, initializer) {
  return {
    kind: "VariableDeclaration",
    variable,
    initializer,
  }
}

// -------- FUNCTIONS --------

export function functionDecl(fun, body) {
  return {
    kind: "FunctionDeclaration",
    function: fun,
    body,
  }
}

export function functionObject(name, params, returnType) {
  return {
    kind: "FunctionObject",
    name,
    params,
    returnType,
  }
}

export function functionCall(callee, args, type) {
  return {
    kind: "FunctionCall",
    callee,
    arguments: args,
    type,
  }
}

export function constructorCall(callee, args, type) {
  return {
    kind: "ConstructorCall",
    callee,
    arguments: args,
    type,
  }
}

// -------- STATEMENTS & CONTROL FLOW --------

export function playStmt(argument) {
  return {
    kind: "PlayStatement",
    argument,
  }
}

export function assignStmt(target, source) {
  return {
    kind: "AssignStatement",
    target,
    source,
  }
}

export function bumpStmt(variable, operator) {
  return {
    kind: "BumpStatement",
    variable,
    operator,
  }
}

export function ifStmt(test, consequent, alternate) {
  return {
    kind: "IfStatement",
    test,
    consequent,
    alternate,
  }
}

export function cutStmt() {
  return { kind: "CutStatement" }
}

export function returnStmt(expression) {
  return {
    kind: "ReturnStatement",
    expression,
  }
}

export function shortReturnStmt() {
  return { kind: "ShortReturnStatement" }
}

// -------- LOOPS --------

export function vampStmt(test, body) {
  return {
    kind: "VampStatement",
    test,
    body,
  }
}

export function encoreStmt(count, body) {
  return {
    kind: "EncoreStatement",
    count,
    body,
  }
}

export function measureRangeStmt(iterator, low, high, body) {
  return {
    kind: "MeasureRangeStatement",
    iterator,
    low,
    high,
    body,
  }
}

export function measureInStmt(iterator, collection, body) {
  return {
    kind: "MeasureInStatement",
    iterator,
    collection,
    body,
  }
}

// -------- EXPRESSIONS --------

export function binaryExp(left, operator, right, type) {
  return {
    kind: "BinaryExpression",
    operator,
    left,
    right,
    type,
  }
}

export function unaryExp(operator, argument, type) {
  return {
    kind: "UnaryExpression",
    operator,
    argument,
    type,
  }
}

export function arrayLiteral(elements, type) {
  return { kind: "ArrayLiteral", elements, type }
}

export function subscriptExp(array, index, type) {
  return { kind: "SubscriptExpression", array, index, type }
}

export function memberExp(object, field, type) {
  return { kind: "MemberExpression", object, field, type }
}

export function conditionalExp(test, consequent, alternate, type) {
  return { kind: "ConditionalExpression", test, consequent, alternate, type }
}

export function unwrapElseExp(optional, alternate, type) {
  return { kind: "UnwrapElseExpression", optional, alternate, type }
}

// -------- STANDARD LIBRARY --------

export const standardLibrary = Object.freeze({
  sqrt: functionObject("sqrt", [variable("x", true, "level")], "level"),
  hypot: functionObject(
    "hypot",
    [variable("x", true, "level"), variable("y", true, "level")],
    "level",
  ),
})
