import { describe, it } from "node:test";
import assert from "node:assert";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";
import * as core from "../src/core.js";

// -------- VALID SEMANTICS FIXTURES --------

const validVariablesAndMath = [
  ["mutable note declaration", "note x = 1"],
  ["immutable key declaration", "key x = 1"],
  ["note reassignment", "note x = 1 x = 2"],
  ["bump operations on levels", "note x = 1 x sharp x flat"],
  ["addition", "play 1 + 2"],
  ["subtraction", "play 5 - 3"],
  ["multiplication", "play 2 * 3"],
  ["division", "play 6 / 2"],
  ["modulo", "play 7 % 3"],
  ["exponentiation", "play 2 ^ 8"],
  ["negation", "play -5"],
  ["logical AND", "play open && closed"],
  ["logical OR", "play closed || open"],
  ["less than", "play 1 < 2"],
  ["greater than", "play 2 > 1"],
  ["equality", "play 1 == 1"],
  ["inequality", "play 1 != 2"],
  ["logical NOT", "play !open"],
  ["ternary conditional", "note x = open ? 1 : 2"],
  ["parenthesized expression", "play (1 + 2)"],
];

const validControlFlow = [
  ["cue statement with gate literal", "cue open : play 1 cadence"],
  ["cue-drop statement", "cue closed : play 1 drop : play 0 cadence"],
  ["cue with comparison condition", "note x = 1 cue x < 2 : play x cadence"],
  [
    "cue-alt statement without drop",
    "cue open : play 1 alt closed : play 2 cadence",
  ],
  [
    "cue-alt-drop statement",
    "cue open : play 1 alt closed : play 2 drop : play 3 cadence",
  ],
  ["empty block check", "cue open : cadence"],
];

const validLoops = [
  ["vamp statement", "vamp closed : play 1 cadence"],
  ["vamp with comparison", "note x = 1 vamp x < 10 : x = 2 cadence"],
  ["encore statement", "encore 5 : play 1 cadence"],
  ["measure range loop", "measure i from 1 to 10 : play i cadence"],
  [
    "measure range loop with variables",
    "note start = 1 note end = 5 measure i from start to end : play i cadence",
  ],
  [
    "measure collection loop",
    "note arr = [1, 2, 3] measure item in arr : play item cadence",
  ],
  ["cut statement", "vamp open : cut cadence"],
];

const validArraysAndOptionals = [
  ["array declarations", "note arr = [1, 2, 3]"],
  ["array subscripting", "note arr = [1, 2, 3] play arr[0]"],
  ["array to array assignment", "note a = [1] note b = a"],
  ["nested array declaration", "note arr = [[1], [2]]"],
  ["nested array assignment", "note a = [[1]] note b = a"],
  ["ghost instantiation", "note x = ghost 5"],
  ["unwrap else", "note x = ghost 5 note y = x ?? 10"],
  ["optional to optional assignment", "note o1 = ghost 1 note o2 = o1"],
];

const validStructs = [
  ["chord declaration", "chord Point : x : level y : level cadence"],
  [
    "struct with nested struct field",
    "chord A : x : level cadence chord B : inner : A cadence",
  ],
  [
    "struct member access",
    "chord Point : x : level cadence compose f(pt : Point) : play pt.x cadence",
  ],
  [
    "struct optional chaining",
    "chord Point : x : level cadence compose f(pt : Point) : play pt?.x cadence",
  ],
];

const validFunctions = [
  [
    "function declaration and call",
    "compose add(a : level, b : level) -> level : fin a + b cadence play add(5, 7)",
  ],
  [
    "parent scope access",
    "note x = 1 compose f() -> level : fin x cadence play f()",
  ],
  ["short return", "compose f() : fin cadence"],
  ["array type annotation", "compose f(a : [level]) : cadence"],
  ["optional type annotation", "compose f(a : ghost level) : cadence"],
  [
    "struct type annotation",
    "chord Point : x : level cadence compose f(p : Point) : cadence",
  ],
  [
    "all primitive types",
    "compose f(a : level, b : lyric, c : gate, d : silence, e : noise) : cadence",
  ],
];

const validLiterals = [
  ["float literal", "note f = 3.14"],
  ["float with positive exponent", "note f = 3.14e+2"],
  ["float with negative exponent", "note f = 3.14e-2"],
  ["float with standard scientific", "note f = 3.14E5"],
  ["string literal", 'note s = "groovy"'],
  ["float literal with leading zero", "note f = 0.5"],
  ["float literal with capitalized exponent", "note f = 1.5E3"],
  ["float literal with negative exponent and sign", "note f = 1.5e-3"],
  ["short string literal", 'note s = ""'],
];

// -------- INVALID SEMANTICS FIXTURES --------

const invalidScopeAndMutability = [
  ["use of undeclared variable", "play x", /Undefined identifier/],
  [
    "redeclaration of variable",
    "note x = 1 note x = 2",
    /Identifier already declared/,
  ],
  ["assign to undeclared variable", "x = 1", /Undefined identifier/],
  [
    "overwrite immutable key",
    "key x = 1 x = 2",
    /Cannot overwrite immutable 'key'/,
  ],
  [
    "bump immutable key",
    "key x = 1 x sharp",
    /Cannot overwrite immutable 'key'/,
  ],
  ["bump a boolean", "note x = open x sharp", /Expected a level/],
  [
    "param reassignment",
    "compose f(x : level) : x = 2 cadence",
    /Cannot overwrite immutable 'key'/,
  ],
];

const invalidControlFlowAndLoops = [
  ["non-gate condition in cue", "cue 1 : play 1 cadence", /Expected a gate/],
  [
    "non-gate condition in alt",
    "cue open : play 1 alt 2 : play 2 cadence",
    /Expected a gate/,
  ],
  ["non-gate condition in vamp", "vamp 1 : play 1 cadence", /Expected a gate/],
  [
    "non-level count in encore",
    "encore open : play 1 cadence",
    /Expected a level/,
  ],
  [
    "measure in non-array",
    "note x = 5 measure i in x : play i cadence",
    /Can only use 'in' to measure an array/,
  ],
  [
    "measure range with non-level low",
    "measure i from open to 10 : cadence",
    /Expected a level/,
  ],
  [
    "measure range with non-level high",
    "measure i from 1 to closed : cadence",
    /Expected a level/,
  ],
];

const invalidTypesAndExpressions = [
  [
    "type mismatch assigning gate to level",
    "note x = 1 x = open",
    /Type mismatch/,
  ],
  [
    "type mismatch assigning level to gate",
    "note x = open x = 1",
    /Type mismatch/,
  ],
  ["gate in addition left operand", "play open + 1", /Expected a level/],
  ["gate in addition right operand", "play 1 + open", /Expected a level/],
  ["gate in multiplication", "play open * 1", /Expected a level/],
  ["gate in exponentiation base", "play open ^ 2", /Expected a level/],
  ["gate in negation", "play -open", /Expected a level/],
  ["gate in less than", "play open < 1", /Expected a level/],
  ["level in logical AND", "play 1 && open", /Expected a gate/],
  ["level in logical NOT", "play !5", /Expected a gate/],
  ["ternary test non-gate", "note x = 1 ? 2 : 3", /Expected a gate/],
  ["ternary type mismatch", "note x = open ? 1 : closed", /Type mismatch/],
];

const invalidArraysAndOptionals = [
  ["type mismatch in array", "note arr = [1, open]", /Type mismatch/],
  ["nested array type mismatch", "note arr = [[1], [open]]", /Type mismatch/],
  ["array of optional mismatch", "note arr = [ghost 1, 1]", /Type mismatch/],
  [
    "array to optional assignment",
    "note arr = [1] note x = ghost 1 arr = x",
    /Type mismatch/,
  ],
  [
    "unwrap non-optional",
    "note x = 5 play x ?? 10",
    /Can only unwrap a 'ghost' type/,
  ],
  [
    "unwrap type mismatch",
    "note x = ghost 5 play x ?? open",
    /Unwrap types do not match/,
  ],
  [
    "subscript non-array",
    "note x = 1 play x[0]",
    /Can only subscript an array/,
  ],
  [
    "subscript with non-level",
    "note arr = [1] play arr[open]",
    /Expected a level/,
  ],
];

const invalidFunctionsAndStructs = [
  [
    "call non-function",
    "note x = 1 play x()",
    /Attempted to call a non-composition/,
  ],
  [
    "struct instantiation attempt",
    "chord Box : x : level cadence note b = Box(1)",
    /Attempted to call a non-composition/,
  ],
  [
    "wrong number of arguments",
    "compose f() : cadence play f(1)",
    /Expected 0 inputs/,
  ],
  [
    "argument type mismatch",
    "compose f(x : level) : cadence play f(open)",
    /Type mismatch/,
  ],
  [
    "member access on non-struct",
    "note x = 1 play x.y",
    /Target is not a chord/,
  ],
  [
    "member access unknown field 1",
    "chord Point : x : level cadence note pt = 1 play pt.z",
    /Target is not a chord/,
  ],
  [
    "member access on array",
    "note arr = [1] play arr.x",
    /Target is not a chord/,
  ],
  [
    "member access unknown field 2",
    "chord Point : x : level cadence compose f(pt : Point) : play pt.z cadence",
    /has no note named z/,
  ],
  [
    "compare function to level",
    "compose f() : cadence play f == 1",
    /Type mismatch/,
  ],
];

describe("The Analyzer", () => {
  describe("Valid Semantics", () => {
    const validCategories = {
      "Variables & Math": validVariablesAndMath,
      "Control Flow": validControlFlow,
      Loops: validLoops,
      "Arrays & Optionals": validArraysAndOptionals,
      Structs: validStructs,
      Functions: validFunctions,
      Literals: validLiterals,
    };

    for (const [category, fixtures] of Object.entries(validCategories)) {
      describe(category, () => {
        for (const [scenario, source] of fixtures) {
          it(`recognizes ${scenario}`, () => {
            assert.ok(analyze(parse(source, [])));
          });
        }
      });
    }
  });

  describe("Invalid Semantics", () => {
    const invalidCategories = {
      "Scope & Mutability": invalidScopeAndMutability,
      "Control Flow & Loops": invalidControlFlowAndLoops,
      "Types & Expressions": invalidTypesAndExpressions,
      "Arrays & Optionals": invalidArraysAndOptionals,
      "Functions & Structs": invalidFunctionsAndStructs,
    };

    for (const [category, fixtures] of Object.entries(invalidCategories)) {
      describe(category, () => {
        for (const [scenario, source, errorMessagePattern] of fixtures) {
          it(`throws on ${scenario}`, () => {
            assert.throws(
              () => analyze(parse(source, [])),
              errorMessagePattern,
            );
          });
        }
      });
    }
  });

  describe("AST Validation", () => {
    it("produces the expected AST for a trivial program", () => {
      assert.deepEqual(
        analyze(parse("note x = 1", [])),
        core.program([core.varDecl(core.variable("x", false, "level"), 1)]),
      );
    });
  });
});
