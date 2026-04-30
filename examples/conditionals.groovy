// Small example to show conditionals

note x = 5

cue x < 0:
  play "negative"
alt x == 0:
  play "zero"
drop:
  play "positive"
cadence