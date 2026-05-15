#! /usr/bin/env node

// Translates Groovy source code text into binary MIDI files.
// Uses a greedy tokenizer to match strings to specific MIDI channels,
// with a base-128 mathematical fallback for arbitrary Unicode characters.

import fs from "node:fs"
import path from "node:path"
import MidiWriter from "midi-writer-js"
import { REVERSE_MAP } from "./preProcessing.js"

// -------- SETUP --------

// Pre-compute the sorted dictionary once to save CPU cycles on repeated calls
const dictionary = Array.from(REVERSE_MAP.keys()).sort((a, b) => b.length - a.length)

// -------- CORE GENERATOR --------

export function generateMidi(sourceCode, outputPath) {
  const track = new MidiWriter.Track()

  let i = 0
  while (i < sourceCode.length) {
    let matched = false

    for (const token of dictionary) {
      if (sourceCode.startsWith(token, i)) {
        const { channel, pitch } = REVERSE_MAP.get(token)

        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: [pitch],
            duration: "8",
            channel: channel + 1, // Offset for Tone.js 0-indexing
            velocity: 100,
          }),
        )

        i += token.length
        matched = true
        break
      }
    }

    if (!matched) {
      const codepoint = sourceCode.codePointAt(i)
      const velocity = codepoint % 128
      const remainder = Math.floor(codepoint / 128)
      const pitch = remainder % 128

      let channel = Math.floor(remainder / 128) + 7
      if (channel > 15) channel = 15

      // Bypass midi-writer-js's percentage rounding to preserve exact base-128 data
      const writerVelocity = Math.max(1, velocity / 1.27)

      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [pitch],
          duration: "8",
          channel: channel + 1,
          velocity: writerVelocity,
        }),
      )

      i += codepoint > 0xffff ? 2 : 1
    }
  }

  const writer = new MidiWriter.Writer(track)
  fs.writeFileSync(outputPath, writer.buildFile())
  return outputPath
}

// -------- CLI --------

const help = `Groovy Text-to-MIDI Converter

Usage: node src/textToMidi.js <filename>

The <filename> must be a plain-text .groovy file containing your source code.
The converter will generate a playable .mid file in the same directory, 
using channel routing and timing to encode your syntax.

NOTE: files that may contain errors WILL still be converted. 
`

/* c8 ignore start */
const isCLI = process.argv[1]?.endsWith("textToMidi.js")

if (isCLI) {
  if (process.argv.length !== 3) {
    console.log(help)
    process.exit(2)
  }

  const inputFile = process.argv[2]

  try {
    const sourceCode = fs.readFileSync(inputFile, "utf-8")
    const parsedPath = path.parse(inputFile)
    const outputFile = path.join(parsedPath.dir, `${parsedPath.name}.mid`)

    generateMidi(sourceCode, outputFile)
    console.log(`\x1b[32mSuccessfully generated MIDI: ${outputFile}\x1b[0m`)
  } catch (error) {
    console.error(`\x1b[31mError generating MIDI: ${error.message}\x1b[0m`)
    process.exit(1)
  }
}
/* c8 ignore stop */
