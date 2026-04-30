// A fibonacci implementation in Groovy

compose fib(n: level, a: level, b: level) -> level:
  note currentN = n
  note currentA = a
  note currentB = b

  vamp open:
    cue currentN == 0:
      fin currentA
    cadence

    note nextB = currentA + currentB
    
    currentA = currentB
    currentB = nextB

    currentN flat
  cadence
cadence

// Execution

play "First 15 Fibonacci numbers:"

measure i from 0 to 14:
  play fib(i, 0, 1)
cadence

play "The 50th Fibonacci number is:"
play fib(50, 0, 1)