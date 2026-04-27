import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";
import optimize from "../src/optimizer.js";
import generate from "../src/generator.js";

function dedent(s) {
  return `${s}`.replace(/(?<=\n)\s+/g, "").trim();
}

const fixtures = [
  {
    name: "small",
    source: `
      note x = 1
      x sharp
      x flat
      key y = open
      note z = x ^ 2
      play (y && closed) || (x != 5)
    `,
    expected: dedent`
      let x_1 = 1;
      x_1++;
      x_1--;
      let y_2 = true;
      let z_3 = (x_1 ** 2);
      console.log((x_1 !== 5));
    `, // Updated to expect the deeply optimized boolean reduction!
  },
  {
    name: "if statements",
    source: `
      note x = 0
      cue x == 0 : play 1 cadence
      cue x == 0 : play 1 drop : play 2 cadence
      cue x == 0 : play 1 alt x == 2 : play 3 cadence
      cue x == 0 : play 1 alt x == 2 : play 3 drop : play 4 cadence
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log(1);
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else {
      console.log(2);
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else
      if ((x_1 === 2)) {
      console.log(3);
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else
      if ((x_1 === 2)) {
      console.log(3);
      } else {
      console.log(4);
      }
    `,
  },
  {
    name: "loops",
    source: `
      note x = 0
      vamp x < 5 :
        note y = 0
        vamp y < 5 :
          play x * y
          y = y + 1
          cut
        cadence
        x = x + 1
      cadence
      encore 3 : play x cadence
      measure i from 1 to 10 : play i cadence
      note arr = [1, 2, 3]
      measure item in arr : play item cadence
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
      let y_2 = 0;
      while ((y_2 < 5)) {
      console.log((x_1 * y_2));
      y_2 = (y_2 + 1);
      break;
      }
      x_1 = (x_1 + 1);
      }
      for (let i_3 = 0; i_3 < 3; i_3++) {
      console.log(x_1);
      }
      for (let i_4 = 1; i_4 <= 10; i_4++) {
      console.log(i_4);
      }
      let arr_5 = [1, 2, 3];
      for (let item_6 of arr_5) {
      console.log(item_6);
      }
    `,
  },
  {
    name: "functions",
    source: `
      compose f(x : level, y : gate) -> gate :
        play x > 3
        fin y
      cadence
      compose g() -> gate :
        fin closed
      cadence
      compose h() :
        fin
      cadence
      f(5, g())
    `,
    expected: dedent`
      function f_1(x_2, y_3) {
      console.log((x_2 > 3));
      return y_3;
      }
      function g_4() {
      return false;
      }
      function h_5() {
      return;
      }
      f_1(5, g_4());
    `,
  },
  {
    name: "arrays and optionals",
    source: `
      note a = [open, closed, open]
      note b = [10, 20, 30]
      play a[1] || (b[0] < 88 ? closed : open)
      note opt = ghost 5
      note unwrap = opt ?? 10
    `,
    expected: dedent`
      let a_1 = [true, false, true];
      let b_2 = [10, 20, 30];
      console.log((a_1[1] || (((b_2[0] < 88)) ? (false) : (true))));
      let opt_3 = 5;
      let unwrap_4 = (opt_3 ?? 10);
    `,
  },
  {
    name: "structs",
    source: `
      chord Point : x : level y : level cadence
      compose getX(pt : Point) :
        play pt.x
      cadence
    `,
    expected: dedent`
      class Point {
      constructor(x, y) {
      this.x = x;
      this.y = y;
      }
      }
      function getX_1(pt_2) {
      console.log(pt_2.x);
      }
    `,
  },
  {
    name: "small",
    source: `
      note x = 1
      x sharp
      x flat
      key y = open
      note z = x ^ 2
      play (y && closed) || (x != 5)
      play -x
      play !y
    `,
    expected: dedent`
      let x_1 = 1;
      x_1++;
      x_1--;
      let y_2 = true;
      let z_3 = (x_1 ** 2);
      console.log((x_1 !== 5));
      console.log((-x_1));
      console.log((!y_2));
    `,
  },
  {
    name: "standard library",
    source: `
      note a = 16
      note b = 3
      note c = 4
      play sqrt(a)
      play hypot(b, c)
    `,
    expected: dedent`
      let a_1 = 16;
      let b_2 = 3;
      let c_3 = 4;
      console.log(Math.sqrt(a_1));
      console.log(Math.hypot(b_2, c_3));
    `,
  },
];

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected JS output for the ${fixture.name} program`, () => {
      // Re-added the optimizer so it runs the full gauntlet!
      const actual = generate(optimize(analyze(parse(fixture.source, []))));
      assert.deepEqual(actual, fixture.expected);
    });
  }
  it("handles undefined nodes and throws on unknown node kinds", () => {
    // Direct AST spoofing to hit the 'undefined' literal check
    const spoofedAST = {
      kind: "Program",
      body: [undefined],
    };
    assert.equal(generate(spoofedAST), "undefined;");

    // Direct AST spoofing to hit the missing generator branch
    const badAST = {
      kind: "Program",
      body: [{ kind: "UnknownNode" }],
    };
    assert.throws(() => generate(badAST), /No generator for UnknownNode/);
  });
});
