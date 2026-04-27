import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateMidi } from "../src/textToMidi.js";
import { processMidi } from "../src/preProcessing.js";
import MidiWriter from "midi-writer-js";

// A temporary file path for the tests to use and delete
const TEMP_MIDI_PATH = path.join(process.cwd(), "temp_test_audio.mid");

// The exact same fixture style we used for the optimizer and generator!
const fixtures = [
  {
    name: "variable declarations",
    source: "note x = 5\nkey y = 10\n",
  },
  {
    name: "loops and math",
    source: "vamp x < 10 :\n  x sharp\ncadence\n",
  },
  {
    name: "functions",
    source: "compose f(x : level) -> level :\n  fin x * 2\ncadence\n",
  },
  {
    name: "standard library math",
    source: "play sqrt(16)\nplay hypot(3, 4)\n",
  },
  {
    name: "explicit tab whitespace",
    source: "note\tx = 1\n",
  },
  {
    name: "special characters and arrays",
    source: "note arr = [1, 2, 3]\nplay arr[0]\n",
  },
  {
    name: "unicode and emojis",
    source: 'play "Hello 🎸 World!"\n', // The unicode fallback logic in action!
  },
  {
    name: "exhaustive math and numbers",
    source: "note math = 0123456789.+-*/%^=\n",
  },
  {
    name: "exhaustive punctuation",
    source: "{}()[],;:<>\n",
  },
  {
    name: "complex and mixed whitespace",
    source: "\n\t  note space = 1\n\n\tplay space\n",
  },
  {
    name: "nested control flow",
    source: "cue open :\n  vamp closed :\n    play 1\n  cadence\ncadence\n",
  },
  {
    name: "struct and member access",
    source: "chord Point : x : level cadence\nnote p = Point\nplay p.x\n",
  },
];

describe("The Preprocessor and MIDI Generator (Round-Trip)", () => {
  // Ensure the temp file is cleaned up even if a test fails
  after(() => {
    if (fs.existsSync(TEMP_MIDI_PATH)) {
      fs.unlinkSync(TEMP_MIDI_PATH);
    }
  });

  for (const { name, source } of fixtures) {
    it(`perfectly round-trips ${name}`, () => {
      // 1. Text -> MIDI (Generate)
      generateMidi(source, TEMP_MIDI_PATH);

      // 2. MIDI -> Text (Preprocess)
      const result = processMidi(TEMP_MIDI_PATH);

      // 3. Assert the round-trip was lossless
      assert.equal(result.sourceCode, source);
    });
  }
  it("generates implicit whitespace based on chronological time gaps", () => {
    const track = new MidiWriter.Track();
    track.setTempo(60); // 60 BPM = 1 beat per second

    // We write the letter 'a' (Channel 3 in MidiWriter -> reads as Channel 2 Alphabet)
    // At 60 BPM: '8' wait is 0.5s, '4' is 1.0s, '1' is 4.0s.
    track.addEvent(
      new MidiWriter.NoteEvent({ pitch: [52], duration: "16", channel: 3 }),
    );
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [52],
        duration: "16",
        channel: 3,
        wait: "8",
      }),
    );
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [52],
        duration: "16",
        channel: 3,
        wait: "4",
      }),
    );
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [52],
        duration: "16",
        channel: 3,
        wait: "1",
      }),
    );

    const writer = new MidiWriter.Writer(track);
    fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile());

    const result = processMidi(TEMP_MIDI_PATH);

    // The gaps should result in 'a', then a space, then a tab, then a newline!
    assert.equal(result.sourceCode, "a a\ta\na");
  });
  it("ignores channel 6 comment tracks", () => {
    const track = new MidiWriter.Track();

    // Valid 'a' on channel 3 (MidiWriter uses 1-index, Tone uses 0-index. Channel 3 = Alphabet)
    track.addEvent(
      new MidiWriter.NoteEvent({ pitch: [52], duration: "16", channel: 3 }),
    );

    // Comment on channel 7 (Tone.js reads this as Channel 6)
    track.addEvent(
      new MidiWriter.NoteEvent({ pitch: [60], duration: "16", channel: 7 }),
    );

    // Valid 'b' on channel 3
    track.addEvent(
      new MidiWriter.NoteEvent({ pitch: [53], duration: "16", channel: 3 }),
    );

    const writer = new MidiWriter.Writer(track);
    fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile());

    const result = processMidi(TEMP_MIDI_PATH);

    // The preprocessor should output 'ab', dropping the comment completely
    assert.equal(result.sourceCode, "ab");
  });

  it("clamps extremely high Unicode characters to max MIDI limits", () => {
    // Codepoint 200000 mathematically calculates to a channel of 19.
    const highUnicode = String.fromCodePoint(200000);
    generateMidi(highUnicode, TEMP_MIDI_PATH);

    const result = processMidi(TEMP_MIDI_PATH);

    // Original: 200000
    // velocity = 200000 % 128 = 64
    // remainder = floor(200000 / 128) = 1562
    // pitch = 1562 % 128 = 26
    // Clamped Channel = 15
    // Preprocessor decodes as: (15 - 7) * 16384 + 26 * 128 + 64 = 134464
    assert.equal(result.sourceCode, String.fromCodePoint(134464));
  });
});
