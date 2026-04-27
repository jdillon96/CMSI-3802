import { describe, it } from "node:test";
import assert from "node:assert/strict";
import optimize from "../src/optimizer.js";
import * as core from "../src/core.js";

// Set up some mock variables to use in tests
const x = core.variable("x", false, "level");
const y = core.variable("y", false, "level");
const arr = core.variable(
  "arr",
  false,
  core.typeDeclaration("ArrayType", "level"),
);
const f = core.functionObject("f", [x], "level");

// Set up some mock statements
const xpp = core.bumpStmt(x, "sharp");
const playX = core.playStmt(x);

// Helpers to quickly make math and logic nodes
const bin = (l, op, r) => core.binaryExp(l, op, r, "unknown");
const un = (op, a) => core.unaryExp(op, a, "unknown");

const tests = [
  // --- MATH CONSTANT FOLDING ---
  ["folds +", bin(5, "+", 8), 13],
  ["folds -", bin(5, "-", 8), -3],
  ["folds *", bin(5, "*", 8), 40],
  ["folds /", bin(5, "/", 8), 0.625],
  ["folds **", bin(5, "**", 8), 390625],
  ["folds ^", bin(5, "^", 8), 390625],
  ["folds %", bin(10, "%", 3), 1],

  // --- COMPARISON FOLDING ---
  ["folds <", bin(5, "<", 8), true],
  ["folds <=", bin(5, "<=", 8), true],
  ["folds ==", bin(5, "==", 5), true],
  ["folds !=", bin(5, "!=", 8), true],
  ["folds >=", bin(5, ">=", 8), false],
  ["folds >", bin(5, ">", 8), false],

  // --- STRENGTH REDUCTIONS ---
  ["optimizes +0", bin(x, "+", 0), x],
  ["optimizes -0", bin(x, "-", 0), x],
  ["optimizes *1", bin(x, "*", 1), x],
  ["optimizes /1", bin(x, "/", 1), x],
  ["optimizes *0", bin(x, "*", 0), 0],
  ["optimizes 0+", bin(0, "+", x), x],
  ["optimizes 0*", bin(0, "*", x), 0],
  ["optimizes 0/", bin(0, "/", x), 0],
  ["optimizes 1*", bin(1, "*", x), x],
  ["optimizes 1**", bin(1, "**", x), 1],
  ["optimizes 1^", bin(1, "^", x), 1],
  ["optimizes **0", bin(x, "**", 0), 1],
  ["optimizes ^0", bin(x, "^", 0), 1],

  // --- UNARY FOLDING ---
  ["folds unary -", un("-", 8), -8],
  ["folds unary !", un("!", true), false],
  ["leaves boolean variables alone", un("!", y), un("!", y)],
  ["leaves optional ghost alone", un("ghost", 5), un("ghost", 5)],

  // --- LOGICAL REDUCTIONS ---
  ["removes left false from ||", bin(false, "||", x), x],
  ["removes right false from ||", bin(x, "||", false), x],
  ["removes left true from ||", bin(true, "||", x), true],
  ["removes right true from ||", bin(x, "||", true), true],
  ["removes false || false", bin(false, "||", false), false],
  ["removes left true from &&", bin(true, "&&", x), x],
  ["removes right true from &&", bin(x, "&&", true), x],
  ["removes left false from &&", bin(false, "&&", x), false],
  ["removes right false from &&", bin(x, "&&", false), false],

  // --- STATEMENT OPTIMIZATIONS ---
  [
    "removes x=x at beginning",
    core.program([core.assignStmt(x, x), xpp]),
    core.program([xpp]),
  ],
  [
    "removes x=x at end",
    core.program([xpp, core.assignStmt(x, x)]),
    core.program([xpp]),
  ],
  [
    "leaves non-matching assign alone",
    core.assignStmt(x, y),
    core.assignStmt(x, y),
  ],

  ["optimizes if-true", core.ifStmt(true, [xpp], []), [xpp]],
  ["optimizes if-false", core.ifStmt(false, [xpp], [playX]), [playX]],
  ["optimizes if-false no alternate", core.ifStmt(false, [xpp], []), []],
  [
    "leaves if pass-through",
    core.ifStmt(x, [xpp], [xpp]),
    core.ifStmt(x, [xpp], [xpp]),
  ],

  ["optimizes vamp-false", core.vampStmt(false, [xpp]), []],
  [
    "leaves vamp-true alone",
    core.vampStmt(true, [xpp]),
    core.vampStmt(true, [xpp]),
  ],

  ["optimizes encore-0", core.encoreStmt(0, [xpp]), []],
  [
    "leaves encore pass-through",
    core.encoreStmt(bin(1, "+", 1), [xpp]),
    core.encoreStmt(2, [xpp]),
  ],

  [
    "optimizes measure-range low > high",
    core.measureRangeStmt(x, 10, 5, [xpp]),
    [],
  ],
  [
    "leaves measure-range valid",
    core.measureRangeStmt(x, bin(1, "+", 1), bin(3, "+", 3), [xpp]),
    core.measureRangeStmt(x, 2, 6, [xpp]),
  ],

  [
    "optimizes measure-in empty array",
    core.measureInStmt(x, core.arrayLiteral([], "ArrayType"), [xpp]),
    [],
  ],
  [
    "leaves measure-in valid",
    core.measureInStmt(x, core.arrayLiteral([bin(1, "+", 1)], "ArrayType"), [
      xpp,
    ]),
    core.measureInStmt(x, core.arrayLiteral([2], "ArrayType"), [xpp]),
  ],

  // --- EXPRESSION PASS-THROUGHS ---
  ["optimizes ternary-true", core.conditionalExp(true, 1, 2, "level"), 1],
  ["optimizes ternary-false", core.conditionalExp(false, 1, 2, "level"), 2],
  [
    "leaves ternary pass-through",
    core.conditionalExp(x, 1, 2, "level"),
    core.conditionalExp(x, 1, 2, "level"),
  ],

  [
    "optimizes in struct decl",
    core.structDecl("Point", [core.fieldDecl("x", "level")]),
    core.structDecl("Point", [core.fieldDecl("x", "level")]),
  ],
  [
    "optimizes in function call",
    core.functionCall(f, [bin(1, "+", 1)], "level"),
    core.functionCall(f, [2], "level"),
  ],
  [
    "optimizes in subscript",
    core.subscriptExp(arr, bin(1, "+", 1), "level"),
    core.subscriptExp(arr, 2, "level"),
  ],
  [
    "optimizes in unwrap",
    core.unwrapElseExp(x, bin(1, "+", 1), "level"),
    core.unwrapElseExp(x, 2, "level"),
  ],
  [
    "optimizes in member",
    core.memberExp(x, "f", "level"),
    core.memberExp(x, "f", "level"),
  ],
  ["optimizes in play", core.playStmt(bin(1, "+", 1)), core.playStmt(2)],
  ["optimizes in return", core.returnStmt(bin(1, "+", 1)), core.returnStmt(2)],
  [
    "optimizes in var decl",
    core.varDecl(x, bin(1, "+", 1)),
    core.varDecl(x, 2),
  ],
  [
    "optimizes in array literal",
    core.arrayLiteral([bin(1, "+", 1)], "ArrayType"),
    core.arrayLiteral([2], "ArrayType"),
  ],
  [
    "optimizes function declaration",
    core.functionDecl(f, [core.returnStmt(bin(1, "+", 1))]),
    core.functionDecl(f, [core.returnStmt(2)]),
  ],
  ["leaves cut alone", core.cutStmt(), core.cutStmt()],
  ["leaves short return alone", core.shortReturnStmt(), core.shortReturnStmt()],
  // --- STANDARD LIBRARY FOLDING ---
  [
    "folds sqrt",
    core.functionCall(core.standardLibrary.sqrt, [16], "level"),
    4,
  ],
  [
    "folds hypot",
    core.functionCall(core.standardLibrary.hypot, [3, 4], "level"),
    5,
  ],
  [
    "leaves sqrt alone with variables",
    core.functionCall(core.standardLibrary.sqrt, [x], "level"),
    core.functionCall(core.standardLibrary.sqrt, [x], "level"),
  ],
  [
    "leaves hypot alone with variables",
    core.functionCall(core.standardLibrary.hypot, [x, 4], "level"),
    core.functionCall(core.standardLibrary.hypot, [x, 4], "level"),
  ],
];

describe("The optimizer", () => {
  for (const [scenario, before, after] of tests) {
    it(`${scenario}`, () => {
      assert.deepEqual(optimize(before), after);
    });
  }
});
