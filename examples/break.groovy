// Small example to show break functionality

note i = 0
vamp i < 100:
  cue i == 5:
    cut
  cadence
  i = i + 1
cadence