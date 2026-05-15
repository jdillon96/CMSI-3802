// Somebody once told me
key world = "gonna roll me"
note sharpestTool = closed

compose getYourGameOn(isStar: gate, hasMoney: gate) -> lyric:
  cue isStar == open && hasMoney == open:
    play "Hey now, you're an All Star!"
    play "Get your show on, get paid."
  alt isStar == open:
    play "Go play."
  cadence
  
  note shootingStar = "breaks the mold"
  fin "All that glitters is gold"
cadence

getYourGameOn(open, closed)