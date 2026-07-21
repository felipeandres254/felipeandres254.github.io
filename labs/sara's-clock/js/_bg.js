//
;document.addEventListener('DOMContentLoaded', () => {

const bg = document.querySelector('#bg g#icons')
const svg = bg.closest('svg')
const { width: svgWidth, height: svgHeight } = svg.getBoundingClientRect()

const iconCount = 100
const minIconSize = 16
const maxIconSize = 32
const minVelocity = 0.5
const maxVelocity = 1.5
const minAlpha = 0.25
const maxAlpha = 0.5

const randomBetween = (min, max) => Math.random() * (max - min) + min
const randomDirection = () => (Math.random() < 0.5 ? -1 : 1)

const icons = Array.from({ length: iconCount }, (_, idx) => {
  const size = randomBetween(minIconSize, maxIconSize)
  return {
    id: `animIcon${idx}`,
    x: randomBetween(0, Math.max(0, svgWidth - size)),
    y: randomBetween(0, Math.max(0, svgHeight - size)),
    vx: randomDirection() * randomBetween(minVelocity, maxVelocity),
    vy: randomDirection() * randomBetween(minVelocity, maxVelocity),
    size,
    alpha: randomBetween(minAlpha, maxAlpha),
  }
})

const getIconHref = () => {
  const hour = new Date().getHours()
  return hour >= 6 && hour < 18 ? '#sun' : '#moon'
}
const iconHref = getIconHref()

bg.innerHTML = icons
  .map(icon => `<use href="${iconHref}" class="icon" id="${icon.id}" width="${icon.size}" height="${icon.size}" opacity="${icon.alpha}" />`)
  .join('')

function animate() {
  const svg = bg.closest('svg')
  const { width: svgWidth, height: svgHeight } = svg.getBoundingClientRect()

  icons.forEach(icon => {
    icon.x += icon.vx
    icon.y += icon.vy

    const totalWidth = svgWidth + icon.size
    const totalHeight = svgHeight + icon.size

    if (icon.x > svgWidth) icon.x -= totalWidth
    if (icon.x < -icon.size) icon.x += totalWidth
    if (icon.y > svgHeight) icon.y -= totalHeight
    if (icon.y < -icon.size) icon.y += totalHeight

    const element = document.getElementById(icon.id)
    if (element) {
      element.setAttribute('x', icon.x)
      element.setAttribute('y', icon.y)
      element.setAttribute('width', icon.size)
      element.setAttribute('height', icon.size)
      element.setAttribute('opacity', icon.alpha)
    }
  })
  
  requestAnimationFrame(animate)
}

animate()

})
