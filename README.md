<div align="center">
  <img src="docs/Groovy-logo.png" height="256" alt="Groovy Logo">

# Groovy

_Music in. Software out._

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](#)
[![Compiles to](https://img.shields.io/badge/compiles%20to-JavaScript-yellow)](#)

</div>

---

## Team

| Name   | Diego Cuadros                                      | Jay Dillon                                 | Westley Holmes                             | Jesus Lopez                              |
| ------ | -------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------- |
| GitHub | [@diegocuadros1](https://github.com/diegocuadros1) | [@jdillon96](https://github.com/jdillon96) | [@WesHolmes](https://github.com/WesHolmes) | [@jalopezW](https://github.com/jalopezW) |

---

## The Story

Groovy is an esolang that converts audio input to code output through a MIDI-to-source code encoding pipeline. Programs are made by placing notes in a digital editor, with the channel a note lives on determining what kind of character it produces, and the pitch selecting the specific character via modulo arithmetic. Export the MIDI, run it through Groovy, and your performance becomes source code that compiles to JavaScript.

MIDI files are translated into a text representation that is music themed. Every keyword comes from music vocabulary: variables are `note`s, constants are `key`s, functions are `compose`d, loops are `measure`s and `vamp`s, conditionals are `cue`s.

Groovy was built as a semester long compiler project for CMSI 3802 at LMU.

---

## Audio Encoding

Every Groovy program can be authored and performed as a MIDI file. The preprocessor reads the notes, figures out what characters they represent, and reconstructs the source text, which then flows into the normal compile pipeline.

### Channel Routing

The channel a note is placed on determines what kind of character it encodes. Pitch selects the specific character within that category via modulo arithmetic.

| Channel | Encodes                                                               | Selection                                        |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| 1       | Groovy keywords (`note`, `compose`, `cue`, `vamp`, …)                 | `KEYWORDS[pitch % 28]`                           |
| 2       | Letters (a–z, A–Z)                                                    | `ALPHABET[pitch % 52]`                           |
| 3       | Digits and math operators (`0–9 . + - * / % ^ =`)                     | `MATH_CHARS[pitch % 18]`                         |
| 4       | Punctuation ({ } ( ) [ ] , ; : < > ! ? & &#124; " ' \ \_ @ # $ ~ \` ) | `SPECIALS[pitch % 24]`                           |
| 5       | Explicit whitespace                                                   | `pitch % 3` → space / tab / newline              |
| 6       | Comments                                                              | Dropped entirely — play whatever you want here   |
| 7–16    | Unicode                                                               | `(channel − 7) × 16384 + pitch × 128 + velocity` |

### Implicit Whitespace from Timing

Notes are sorted chronologically before decoding. The gap in time between consecutive notes automatically generates whitespace, which means how fast or slow you play a passage shapes the indentation and structure of the output:

| Gap     | Whitespace injected |
| ------- | ------------------- |
| ≥ 0.2 s | space               |
| ≥ 1.0 s | tab                 |
| ≥ 2.5 s | newline             |

### Full Pipeline

```
MIDI file → preprocessing → source text → lexer/parser → semantic analysis → optimizer → code gen → JavaScript
```

---

## Text Representation

Groovy also has a plain text syntax if you'd rather type than compose. Every construct maps to a music keyword:

- Declare variables with `note x = 5` (mutable) or `key x = 5` (immutable)
- Define functions with `compose name(params) -> returnType :`
- Loop with `measure` (range or collection), `vamp` (while), or `encore` (repeat N times)
- Branch with `cue` / `alt` / `drop` (if / else-if / else)
- Close every block with `cadence`

The five primitive types are `level` (number), `lyric` (string), `gate` (boolean), `silence` (void), and `noise` (any). Types can be made optional with `ghost`.

Groovy can also be translated from this text representation into MIDI files via `textToMidi.js`, allowing users to hear what their code would sound like!

---

## Features

- **Dual input modes** — write programs as MIDI files or as plain-text `.groovy` source
- **Music themed syntax** — every keyword comes from musical vocabulary
- **Static typing** — five primitive types: `level`, `lyric`, `gate`, `silence`, `noise`
- **Optional types** — first class `ghost` types with `??` unwrap-else semantics
- **Structs** — custom data types via `chord` declarations
- **Arrays** — typed, subscriptable collections
- **First class functions** — typed parameters and return annotations via `compose`
- **Control flow** — `cue`/`alt`/`drop`, `vamp` (while), `measure` (for-range & for-in), `encore` (repeat N times), `cut` (break)
- **Immutability** — `key` declares constants; function parameters are immutable by default
- **MIDI comment track** — Channel 6 notes are silently discarded, letting you annotate your performance freely
- **Compiles to JavaScript** — clean JS output with safe name mangling

---

## Quick Reference

| Groovy                 | Meaning                        |
| ---------------------- | ------------------------------ |
| `note`                 | mutable variable               |
| `key`                  | immutable constant             |
| `chord`                | struct / record type           |
| `compose`              | function declaration           |
| `fin`                  | return                         |
| `play`                 | print                          |
| `cue` / `alt` / `drop` | if / else-if / else            |
| `vamp`                 | while loop                     |
| `measure … from … to`  | numeric range loop             |
| `measure … in`         | collection loop                |
| `encore N`             | repeat N times                 |
| `cut`                  | break                          |
| `cadence`              | end-of-block terminator        |
| `open` / `closed`      | true / false                   |
| `ghost`                | optional type wrapper          |
| `sharp` / `flat`       | `++` / `--`                    |
| `^`                    | exponentiation                 |
| `??`                   | unwrap-else (optional)         |
| `?.`                   | optional member access         |
| `level`                | number                         |
| `lyric`                | string                         |
| `gate`                 | boolean                        |
| `silence`              | void (no return)               |
| `noise`                | any type                       |
| `sqrt`                 | square root (standard library) |
| `hypot`                | hypotenuse (standard library)  |

---

## Static Checks

The Groovy analyzer catches the following errors at compile time:

**Scope & Declarations**

- Using an undeclared identifier
- Re-declaring a variable in the same scope
- Assigning to an immutable `key` variable (including function parameters)

**Type Checking**

- Non-numeric operands in arithmetic (`+`, `-`, `*`, `/`, `%`, `^`)
- Non-boolean operands in logical expressions (`&&`, `||`, `!`)
- Non-boolean condition in `cue`, `alt`, or `vamp`
- Non-numeric count in `encore`
- Mismatched types in assignment or comparison
- Mixed-type elements in an array literal

**Functions**

- Calling a non-function
- Wrong number of arguments
- Argument type mismatch against declared parameter types

**Structs**

- Member access on a non-`chord` type
- Accessing a field that doesn't exist on a `chord`
- Optional chaining (`?.`) on a non-`chord` type

**Optionals & Arrays**

- Using `??` on a non-`ghost` (non-optional) value
- Mismatched types in an unwrap-else expression
- Using `in` iteration on a non-array
- Subscripting a non-array

---

## Language Website

Visit the Groovy project site: [Link](https://diegocuadros1.github.io/)

---

## Examples

A few short samples below. Additional full-length written and audio examples are in the `docs` folder.

### Variables & Constants

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note score = 100
key maxScore = 999
note name = "Alice"
note active = open
```

</td>
<td>

```javascript
let score_1 = 100;
let maxScore_2 = 999;
let name_3 = "Alice";
let active_4 = true;
```

</td>
</tr>
</table>

---

### Arithmetic & Operators

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note x = 4
note y = x ^ 3
x sharp
x flat
play x + y
```

</td>
<td>

```javascript
let x_1 = 4;
let y_2 = x_1 ** 3;
x_1++;
x_1--;
console.log(x_1 + y_2);
```

</td>
</tr>
</table>

---

### Conditionals

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note x = 5

cue x < 0 :
  play "negative"
alt x == 0 :
  play "zero"
drop :
  play "positive"
cadence
```

</td>
<td>

```javascript
let x_1 = 5;

if (x_1 < 0) {
  console.log("negative");
} else if (x_1 === 0) {
  console.log("zero");
} else {
  console.log("positive");
}
```

</td>
</tr>
</table>

---

### While Loop (`vamp`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note i = 0
vamp i < 5 :
  play i
  i = i + 1
cadence
```

</td>
<td>

```javascript
let i_1 = 0;
while (i_1 < 5) {
  console.log(i_1);
  i_1 = i_1 + 1;
}
```

</td>
</tr>
</table>

---

### Range Loop (`measure … from … to`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
measure i from 1 to 10 :
  play i
cadence
```

</td>
<td>

```javascript
for (let i_1 = 1; i_1 <= 10; i_1++) {
  console.log(i_1);
}
```

</td>
</tr>
</table>

---

### Collection Loop (`measure … in`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note beats = [1, 2, 3, 4]
measure beat in beats :
  play beat
cadence
```

</td>
<td>

```javascript
let beats_1 = [1, 2, 3, 4];
for (let beat_2 of beats_1) {
  console.log(beat_2);
}
```

</td>
</tr>
</table>

---

### Repeat Loop (`encore`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
encore 4 :
  play "drop the beat"
cadence
```

</td>
<td>

```javascript
for (let i_1 = 0; i_1 < 4; i_1++) {
  console.log("drop the beat");
}
```

</td>
</tr>
</table>

---

### Functions (`compose`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
compose add(x : level, y : level) -> level :
  fin x + y
cadence

compose greet(name : lyric) :
  play name
cadence

play add(3, 7)
greet("Groovy")
```

</td>
<td>

```javascript
function add_1(x_2, y_3) {
  return x_2 + y_3;
}
function greet_4(name_5) {
  console.log(name_5);
}
console.log(add_1(3, 7));
greet_4("Groovy");
```

</td>
</tr>
</table>

---

### Structs (`chord`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
chord Point :
  x : level
  y : level
cadence

compose makePoint(a : level, b : level) -> Point :
  fin Point(a, b)
cadence

note p = makePoint(3, 4)
play p.x
```

</td>
<td>

```javascript
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}
function makePoint_1(a_2, b_3) {
  return new Point(a_2, b_3);
}
let p_4 = makePoint_1(3, 4);
console.log(p_4.x);
```

</td>
</tr>
</table>

---

### Optional Types (`ghost`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note maybeScore = ghost 42
note result = maybeScore ?? 0
play result
```

</td>
<td>

```javascript
let maybeScore_1 = 42;
let result_2 = maybeScore_1 ?? 0;
console.log(result_2);
```

</td>
</tr>
</table>

---

### Arrays & Subscripting

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note notes = [60, 62, 64, 65, 67]
play notes[0]
measure n in notes :
  play n
cadence
```

</td>
<td>

```javascript
let notes_1 = [60, 62, 64, 65, 67];
console.log(notes_1[0]);
for (let n_2 of notes_1) {
  console.log(n_2);
}
```

</td>
</tr>
</table>

---

### Break (`cut`)

<table>
<tr><th>Groovy</th><th>JavaScript</th></tr>
<tr>
<td>

```groovy
note i = 0
vamp i < 100 :
  cue i == 5 :
    cut
  cadence
  i = i + 1
cadence
```

</td>
<td>

```javascript
let i_1 = 0;
while (i_1 < 100) {
  if (i_1 === 5) {
    break;
  }
  i_1 = i_1 + 1;
}
```

</td>
</tr>
</table>

---

<div align="center">
  <sub>Built with ♩ for CMSI-3802 at Loyola Marymount University</sub>
</div>
