#! /usr/bin/env node

// Main command-line interface for the Groovy compiler.
// Handles file reading, MIDI preprocessing, and routing through the compiler pipeline.

import * as fs from "node:fs/promises"
import stringify from "graph-stringify"
import { processMidi } from "./preProcessing.js"
import compile from "./compiler.js"

// -------- SETUP --------

const help = `Groovy Compiler

Usage: node src/groovy.js <filename> <outputType>

The <filename> can be a .mid, .midi, or .groovy file.

The <outputType> must be one of:
  parsed     Confirms the musical syntax is valid
  analyzed   Shows the validated Abstract Syntax Tree (AST)
  optimized  Shows the AST after algebraic folding and logic cleanup
  js         Spits out the executable JavaScript translation
`

// -------- COMPILER PIPELINE --------

async function compileFromFile(filename, outputType) {
  try {
    let sourceCode = ""
    let sourceMap = []

    if (filename.endsWith(".mid") || filename.endsWith(".midi")) {
      const result = processMidi(filename)
      sourceCode = result.sourceCode
      sourceMap = result.sourceMap
    } else {
      const buffer = await fs.readFile(filename)
      sourceCode = buffer.toString()
    }

    const compiled = compile(sourceCode, outputType, sourceMap)

    console.log(typeof compiled === "object" ? stringify(compiled, "kind") : compiled)
  } catch (e) {
    console.error(`\x1b[31m${e.message}\x1b[0m`)
    process.exitCode = 1
  }
}

// -------- CLI EXECUTION --------

if (process.argv.length === 4) {
  await compileFromFile(process.argv[2], process.argv[3])
} else {
  console.log(help)
  process.exitCode = 2
}
