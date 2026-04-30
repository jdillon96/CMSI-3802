chord Point :
  x : level
  y : level
cadence

compose makePoint(a : level, b : level) -> Point :
  fin Point(a, b)
cadence

note p = makePoint(3, 4)
play p.x