// Resolves a binary MIDI file into Groovy source code and a corresponding source map.
// Uses channel routing and time gaps to decode keywords, characters, and whitespace.

import pkg from "@tonejs/midi"
const { Midi } = pkg
import fs from "fs"

// -------- DICTIONARIES & MAPPING --------

export const GROOVY_CHANNELS = {
  1: [
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
  2: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  3: "0123456789.+-*/%^=",
  4: "{}()[],;:<>!?&|\"'\\_@#$~`",
}

export const REVERSE_MAP = new Map()

for (const [channelStr, items] of Object.entries(GROOVY_CHANNELS)) {
  const channel = parseInt(channelStr)
  const len = items.length

  for (let i = 0; i < len; i++) {
    const multiplier = Math.floor(60 / len)
    const pitch = i + multiplier * len
    REVERSE_MAP.set(items[i], { channel, pitch })
  }
}

// Explicit whitespace overrides
REVERSE_MAP.set(" ", { channel: 5, pitch: 60 })
REVERSE_MAP.set("\t", { channel: 5, pitch: 61 })
REVERSE_MAP.set("\n", { channel: 5, pitch: 62 })

// -------- CORE PREPROCESSOR --------

export function processMidi(filePath) {
  const midiData = fs.readFileSync(filePath)
  const parsedMidi = new Midi(midiData)

  let sourceCode = ""
  const sourceMap = []
  const allNotes = []

  parsedMidi.tracks.forEach(track => {
    if (track.channel === 6) return

    track.notes.forEach(note => {
      allNotes.push({
        channel: track.channel,
        pitch: note.midi,
        velocity: Math.floor(note.velocity * 127),
        time: note.time,
        duration: note.duration,
      })
    })
  })

  allNotes.sort((a, b) => a.time - b.time)

  let lastNoteEndTime = 0

  allNotes.forEach(note => {
    const gap = note.time - lastNoteEndTime

    if (lastNoteEndTime > 0) {
      let spaceChar = ""
      if (gap >= 1.0 && gap < 2.5) spaceChar = "\t"
      else if (gap >= 2.5) spaceChar = "\n"
      else if (gap >= 0.2) spaceChar = " "

      if (spaceChar) {
        sourceMap.push({
          index: sourceCode.length,
          char: spaceChar,
          time: note.time.toFixed(2),
          channel: "Implicit",
          pitch: "N/A",
        })
        sourceCode += spaceChar
      }
    }

    let charToAppend = ""

    switch (note.channel) {
      case 1:
        const keywords = GROOVY_CHANNELS[1]
        charToAppend = keywords[note.pitch % keywords.length]
        break
      case 2:
      case 3:
      case 4:
        const chars = GROOVY_CHANNELS[note.channel]
        charToAppend = chars[note.pitch % chars.length]
        break
      case 5:
        if (note.pitch % 3 === 0) charToAppend = " "
        else if (note.pitch % 3 === 1) charToAppend = "\t"
        else if (note.pitch % 3 === 2) charToAppend = "\n"
        break
      default:
        if (note.channel >= 7 && note.channel <= 16) {
          const codepoint = (note.channel - 7) * 16384 + note.pitch * 128 + note.velocity
          charToAppend = String.fromCodePoint(codepoint)
        }
        break
    }

    if (charToAppend) {
      sourceMap.push({
        index: sourceCode.length,
        char: charToAppend,
        time: note.time.toFixed(2),
        channel: note.channel,
        pitch: note.pitch,
      })
      sourceCode += charToAppend
    }

    lastNoteEndTime = note.time + note.duration
  })

  return { sourceCode, sourceMap }
}
