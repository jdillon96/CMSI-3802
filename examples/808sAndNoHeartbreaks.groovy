// In the night, I hear them talk
chord Heart :
  status: gate
  temperature: level
cadence

compose heartbreak() -> silence :
  note myHeart = Heart(closed, 0)
  note drumMachine = 808
  
  vamp myHeart.temperature < drumMachine :
    cue myHeart.status == closed :
      play "How could you be so cold?"
      cut 
    drop :
      myHeart.temperature sharp
    cadence
  cadence
  
  fin
cadence