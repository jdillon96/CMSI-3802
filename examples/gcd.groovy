// Euclid's GCD algorithm in Groovy

compose gcd(a: level, b: level) -> level:
  note currentA = a
  note currentB = b
  
  vamp currentB != 0:
    note temp = currentB
    currentB = currentA % currentB
    currentA = temp
  cadence
  
  fin currentA
cadence

// Execution

note num1 = 48
note num2 = 18

play "The GCD of 48 and 18 is:"
play gcd(num1, num2)

play "The GCD of 1071 and 462 is:"
play gcd(1071, 462)