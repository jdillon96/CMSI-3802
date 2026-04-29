// Parses Groovy source code against the defined Ohm grammar.
// Provides custom error tracing that maps text syntax errors back to their exact MIDI audio timestamps.

import * as ohm from "ohm-js"
import * as fs from "node:fs/promises"

// -------- SETUP --------

const grammarSource = await fs.readFile("./src/groovy.ohm", "utf-8")
const grammar = ohm.grammar(grammarSource)

// -------- CORE PARSER --------

export default function parse(sourceCode, sourceMap = []) {
  const match = grammar.match(sourceCode)

  if (match.failed()) {
    const errorIndex = match.rightmostFailurePosition ?? 99999
    const reversedMap = [...sourceMap].reverse()
    const errorData = reversedMap.find(entry => entry.index <= errorIndex)

    let errorMessage = `\nSYNTAX ERROR\n${match.message}\n`

    if (errorData) {
      errorMessage += `\nAUDIO TRACEBACK:\nTimestamp: ${errorData.time}s\nChannel:   ${errorData.channel}\nPitch:     ${errorData.pitch}\nCharacter: '${errorData.char}'\n`
    }

    throw new Error(errorMessage)
  }

  return match
}
