#! /usr/bin/env node

import fs from "fs";
import path from "path";
import MidiWriter from "midi-writer-js";
import { REVERSE_MAP } from "./preProcessing.js";

export function generateMidi(sourceCode, outputPath) {
  // 1. Initialize a new MIDI track
  const track = new MidiWriter.Track();

  // 2. Sort our dictionary keys from longest to shortest
  const dictionary = Array.from(REVERSE_MAP.keys()).sort(
    (a, b) => b.length - a.length,
  );

  let i = 0;
  while (i < sourceCode.length) {
    let matched = false;

    for (const token of dictionary) {
      if (sourceCode.startsWith(token, i)) {
        const { channel, pitch } = REVERSE_MAP.get(token);

        // 3. Create the standard MIDI Note
        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: [pitch],
            duration: "8",
            channel: channel + 1, // FIX: +1 offsets the Tone.js 0-index logic
            velocity: 100,
          }),
        );

        i += token.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 4. Unicode Fallback (Channels 7-16)
      const codepoint = sourceCode.codePointAt(i);
      const velocity = codepoint % 128;
      const remainder = Math.floor(codepoint / 128);
      const pitch = remainder % 128;
      let channel = Math.floor(remainder / 128) + 7;
      if (channel > 15) channel = 15;

      const writerVelocity = Math.max(1, Math.round((velocity / 127) * 100));

      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: [pitch],
          duration: "8",
          channel: channel + 1,
          velocity: writerVelocity,
        }),
      );

      i += codepoint > 0xffff ? 2 : 1;
    }
  }

  const writer = new MidiWriter.Writer(track);
  fs.writeFileSync(outputPath, writer.buildFile());
  return outputPath;
}
/* c8 ignore start */
// --- CLI EXECUTION LOGIC ---
const isCLI = process.argv[1] && process.argv[1].endsWith("textToMidi.js");

if (isCLI) {
  if (process.argv.length !== 3) {
    console.error("Usage: node src/textToMidi.js <file.groovy>");
    process.exit(1);
  }

  const inputFile = process.argv[2];

  try {
    const sourceCode = fs.readFileSync(inputFile, "utf-8");

    // Parse the input path to generate the output path in the exact same directory
    const parsedPath = path.parse(inputFile);
    const outputFile = path.join(parsedPath.dir, `${parsedPath.name}.mid`);

    generateMidi(sourceCode, outputFile);
    console.log(`\x1b[32m🎵 Successfully generated MIDI: ${outputFile}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31mError generating MIDI: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}
/* c8 ignore stop */
