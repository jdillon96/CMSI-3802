import { describe, it, after } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import MidiWriter from "midi-writer-js"
import { processMidi } from "../src/preProcessing.js"
import { generateMidi } from "../src/textToMidi.js"

const TEMP_MIDI_PATH = "./test_temp.mid"

// -------- ROUND-TRIP FIXTURES --------

const fixtures = [
  { name: "variable declarations", source: "note x = 5\nkey y = 10\n" },
  { name: "loops and math", source: "vamp x < 10 :\n  x sharp\ncadence\n" },
  {
    name: "functions",
    source: "compose f(x : level) -> level :\n  fin x * 2\ncadence\n",
  },
  {
    name: "standard library math",
    source: "play sqrt(16)\nplay hypot(3, 4)\n",
  },
  {
    name: "special characters and arrays",
    source: "note arr = [1, 2, 3]\nplay arr[0]\n",
  },
  { name: "unicode and emojis", source: 'play "Hello 🎸 World!"\n' },
  { name: "BMP unicode fallback", source: 'note symbol = "λ and é"\n' },
  { name: "explicit tab whitespace", source: "note\tx = 1\n" },
  {
    name: "exhaustive math and numbers",
    source: "note math = 0123456789.+-*/%^=\n",
  },
  { name: "exhaustive punctuation", source: "{}()[],;:<>\n" },
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
]

describe("The Preprocessor and MIDI Generator", () => {
  // -------- ROUND-TRIP FIXTURES --------
  describe("Round-Trip Fixtures", () => {
    for (const fixture of fixtures) {
      it(`perfectly round-trips ${fixture.name}`, () => {
        generateMidi(fixture.source, TEMP_MIDI_PATH)
        const result = processMidi(TEMP_MIDI_PATH)
        assert.equal(result.sourceCode, fixture.source)
      })
    }
  })

  // -------- IMPLICIT WHITESPACE TIMING --------
  describe("Implicit Whitespace Timing", () => {
    it("generates implicit whitespace based on chronological time gaps", () => {
      const track = new MidiWriter.Track()
      track.setTempo(60)

      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [52], duration: "16", channel: 3 }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "8",
        }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "4",
        }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "1",
        }),
      )

      const writer = new MidiWriter.Writer(track)
      fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile())

      const result = processMidi(TEMP_MIDI_PATH)
      assert.equal(result.sourceCode, "a a\ta\na")
    })

    it("resolves exact mathematical boundary gaps correctly", () => {
      const track = new MidiWriter.Track()
      track.setTempo(60)

      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [52], duration: "16", channel: 3 }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "T26",
        }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "T128",
        }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [52],
          duration: "16",
          channel: 3,
          wait: "T320",
        }),
      )

      const writer = new MidiWriter.Writer(track)
      fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile())

      const result = processMidi(TEMP_MIDI_PATH)
      assert.equal(result.sourceCode, "a a\ta\na")
    })
  })

  // -------- CHANNEL FILTERING & EDGE CASES --------
  describe("Channel Filtering & Edge Cases", () => {
    it("ignores channel 6 comment tracks entirely", () => {
      const track = new MidiWriter.Track()

      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [52], duration: "16", channel: 3 }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [60], duration: "16", channel: 7 }),
      )
      track.addEvent(
        new MidiWriter.NoteEvent({ pitch: [53], duration: "16", channel: 3 }),
      )

      const writer = new MidiWriter.Writer(track)
      fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile())

      const result = processMidi(TEMP_MIDI_PATH)
      assert.equal(result.sourceCode, "ab")
    })

    it("safely clamps extremely high Unicode characters to max MIDI limits", () => {
      const highUnicode = String.fromCodePoint(200000)
      generateMidi(highUnicode, TEMP_MIDI_PATH)

      const result = processMidi(TEMP_MIDI_PATH)
      assert.equal(result.sourceCode, String.fromCodePoint(134464))
    })

    it("gracefully handles a completely empty MIDI file without crashing", () => {
      const track = new MidiWriter.Track()
      const writer = new MidiWriter.Writer(track)
      fs.writeFileSync(TEMP_MIDI_PATH, writer.buildFile())

      const result = processMidi(TEMP_MIDI_PATH)
      assert.equal(result.sourceCode, "")
      assert.equal(result.sourceMap.length, 0)
    })
  })

  after(() => {
    if (fs.existsSync(TEMP_MIDI_PATH)) {
      fs.unlinkSync(TEMP_MIDI_PATH)
    }
  })
})
