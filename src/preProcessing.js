import pkg from "@tonejs/midi";
const { Midi } = pkg;
import fs from "fs";

// --- 1. THE SINGLE SOURCE OF TRUTH ---
export const GROOVY_CHANNELS = {
  1: [
    // Keywords
    "note",
    "key",
    "chord",
    "play",
    "measure",
    "from",
    "to",
    "vamp",
    "encore",
    "cut",
    "compose",
    "fin",
    "cadence",
    "cue",
    "alt",
    "drop",
    "gate",
    "open",
    "closed",
    "ghost",
    "level",
    "lyric",
    "silence",
    "noise",
    "sqrt",
    "hypot",
    "sharp",
    "flat",
  ],
  2: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", // Alphabet
  3: "0123456789.+-*/%^=", // Math & Numbers
  4: "{}()[],;:<>", // Punctuation
};

// --- 2. AUTO-GENERATE THE REVERSE DICTIONARY ---
export const REVERSE_MAP = new Map();

for (const [channelStr, items] of Object.entries(GROOVY_CHANNELS)) {
  const channel = parseInt(channelStr);
  const len = items.length;

  for (let i = 0; i < len; i++) {
    // To make it sound musical instead of like a screeching modem,
    // we calculate an octave multiplier to push the base index up near Middle C (pitch 60).
    const multiplier = Math.floor(60 / len);
    const pitch = i + multiplier * len;

    REVERSE_MAP.set(items[i], { channel, pitch });
  }
}

// Add explicit whitespace overrides (Channel 5)
// Space = 0 mod 3, Tab = 1 mod 3, Newline = 2 mod 3
REVERSE_MAP.set(" ", { channel: 5, pitch: 60 });
REVERSE_MAP.set("\t", { channel: 5, pitch: 61 });
REVERSE_MAP.set("\n", { channel: 5, pitch: 62 });

export function processMidi(filePath) {
  const midiData = fs.readFileSync(filePath);
  const parsedMidi = new Midi(midiData);

  let sourceCode = "";
  let sourceMap = [];
  let allNotes = [];

  // 1. Flatten all tracks, dropping the comment channel instantly
  parsedMidi.tracks.forEach((track) => {
    if (track.channel === 6) return; // Channel 6 is our silent comment track

    track.notes.forEach((note) => {
      allNotes.push({
        channel: track.channel,
        pitch: note.midi,
        velocity: Math.floor(note.velocity * 127),
        time: note.time,
        duration: note.duration,
      });
    });
  });

  // 2. Sort chronologically
  allNotes.sort((a, b) => a.time - b.time);

  // 3. Translate to Text & Build Source Map
  let lastNoteEndTime = 0;

  allNotes.forEach((note) => {
    // A. Handle explicit whitespace based on time gaps
    const gap = note.time - lastNoteEndTime;

    if (lastNoteEndTime > 0) {
      let spaceChar = "";
      if (gap >= 1.0 && gap < 2.5) spaceChar = "\t";
      else if (gap >= 2.5) spaceChar = "\n";
      else if (gap >= 0.2) spaceChar = " ";

      if (spaceChar) {
        // We log implicitly generated whitespace in the source map too!
        sourceMap.push({
          index: sourceCode.length,
          char: spaceChar,
          time: note.time.toFixed(2),
          channel: "Implicit",
          pitch: "N/A",
        });
        sourceCode += spaceChar;
      }
    }

    let charToAppend = "";

    // B. Channel Routing
    switch (note.channel) {
      case 1: // Keywords
        // Note: We add a trailing space to keywords so they don't jam together
        const keywords = GROOVY_CHANNELS[1];
        charToAppend = keywords[note.pitch % keywords.length];
        break;
      case 2: // Alphabet
      case 3: // Numbers & Math Logic
      case 4: // Special Characters & Punctuation
        const chars = GROOVY_CHANNELS[note.channel];
        charToAppend = chars[note.pitch % chars.length];
        break;
      case 5: // Explicit Whitespace
        if (note.pitch % 3 === 0) charToAppend = " ";
        if (note.pitch % 3 === 1) charToAppend = "\t";
        if (note.pitch % 3 === 2) charToAppend = "\n";
        break;
      default:
        // Channels 7-16: Unicode calculation
        if (note.channel >= 7 && note.channel <= 16) {
          const codepoint =
            (note.channel - 7) * 16384 + note.pitch * 128 + note.velocity;
          charToAppend = String.fromCodePoint(codepoint);
        }
        break;
    }

    // C. Append to string and push to Source Map
    if (charToAppend) {
      sourceMap.push({
        index: sourceCode.length, // Capture the exact string position
        char: charToAppend,
        time: note.time.toFixed(2),
        channel: note.channel,
        pitch: note.pitch,
      });
      sourceCode += charToAppend;
    }

    lastNoteEndTime = note.time + note.duration;
  });

  return { sourceCode, sourceMap };
}
