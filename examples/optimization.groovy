// A showcase of many optimizations present in the optimizer

compose heavilyOptimized(x: level, y: level) -> level:
  
  vamp closed:
    play "This will never run"
  cadence
  
  encore 0:
    play "Neither will this"
  cadence

  cue closed:
    play "Dead if-statement block"
  cadence

  encore 3:
    play "Unroll me!"
  cadence

  note mathMagic = (5 * 8) + (10 % 3) + (2 ^ 3)
  
  note logicMagic = !(!open) && (closed || open)
  
  note strength = (x * 0) + (y * 1) + (x - x) + (y / y)
  
  note flipped = !(x < y)
  note isSame = (x == x)
  
  note stdLib = sqrt(16) + hypot(3, 4)

  fin stdLib + strength
  play "This is completely eliminated because it's after a return"
  
cadence

// Execution

play heavilyOptimized(10, 20)