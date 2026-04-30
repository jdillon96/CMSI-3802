// A Bubble Sort implementation in Groovy

compose bubbleSort(arr: [level], size: level):
  note swapped = open
  note limit = size
  
  vamp swapped:
    swapped = closed
    note i = 0
    
    vamp i < limit - 1:
      cue arr[i] > arr[i + 1]:
        note temp = arr[i]
        arr[i] = arr[i + 1]
        arr[i + 1] = temp
        
        swapped = open
      cadence
      
      i sharp
    cadence
    
    limit flat
  cadence
cadence


// Execution

note numbers = [64, 34, 25, 12, 22, 11, 90]

play "Before sorting:"
measure item in numbers:
  play item
cadence

bubbleSort(numbers, 7)

play "After sorting:"
measure item in numbers:
  play item
cadence