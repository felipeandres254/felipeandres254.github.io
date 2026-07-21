//
;document.addEventListener('DOMContentLoaded', () => {

let isBlinking = false

function updateColors(h24) {
  const eClock = document.getElementById('clock')

  let $h, $s, $l, bgColor, fgColor
  if ((h24 >= 5 && h24 < 7) || (h24 >= 17 && h24 < 19)) {
    // dawn and dusk: red-orange
    bgColor = 'hsl(20, 100%, 55%)'
    fgColor = '#002b36'
  } else if (h24 >= 7 && h24 < 17) {
    // day
    bgColor = 'hsl(210, 100%, 50%)'
    fgColor = '#002b36'
  } else {
    // night
    bgColor = 'hsl(210, 100%, 12.5%)'
    fgColor = '#fdf6e3'
  }

  document.body.style.background = bgColor
  if (!isBlinking)
    eClock.style.color = fgColor
  else if (isBlinking && Date.now() % 1000 < 500)
    eClock.style.color = '#fdf6e3'
  else
    eClock.style.color = '#002b36'
}

function updateClock() {
  const eClock = document.getElementById('clock')

  const now = new Date()
  const h24 = now.getHours()
  const period = h24 >= 12 ? 'pm' : 'am'
  const hours = ((h24 % 12) || 12).toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  eClock.textContent = `${hours}:${minutes}:${seconds} ${period}`

  // Update colors based on time of day
  updateColors(h24)

  // If o'clock, trigger the following effect
  if (now.getMinutes() === 0 && now.getSeconds() === 0) {
    isBlinking = true
    eClock.style.fontSize = '7.5rem'
  } else if ((now.getMinutes() - 1) === 0 && now.getSeconds() === 0) {
    isBlinking = false
    eClock.style.fontSize = '5rem'
  }
}

setInterval(updateClock, 100)
updateClock()

})
