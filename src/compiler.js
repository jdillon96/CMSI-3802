// The core compiler pipeline.
// Routes source code through the parser, analyzer, optimizer, and generator based on the requested output type.

// -------- SETUP --------

import parse from "./parser.js"
import analyze from "./analyzer.js"
import optimize from "./optimizer.js"
import generate from "./generator.js"

// -------- COMPILER PIPELINE --------

export default function compile(source, outputType, sourceMap = []) {
  if (!["parsed", "analyzed", "optimized", "js"].includes(outputType)) {
    throw new Error("Unknown output type")
  }

  const match = parse(source, sourceMap)
  if (outputType === "parsed") return "Syntax is ok"

  const analyzed = analyze(match, sourceMap)
  if (outputType === "analyzed") return analyzed

  const optimized = optimize(analyzed)
  if (outputType === "optimized") return optimized

  return generate(optimized)
}
