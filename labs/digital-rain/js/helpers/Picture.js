//
const canvas = document.querySelector('canvas#background')
const ctx = canvas.getContext('2d', { willReadFrequently: true })

export default class Picture {
  constructor(path) {
    this.data = null
    this.image = new Image
    this.image.crossOrigin = 'anonymous'
    this.image.style.display = 'none'
    this.image.src = path
    this.image.addEventListener('load', () => { this.resize() })
  }

  resize() {
    const width = window.innerWidth
    const height = window.innerHeight
    const size = 2*Math.min(width, height)/3
    ctx.drawImage(this.image, 0, 0, size, size)
    this.data = ctx.getImageData(0, 0, size, size)
    this.center = {
      x: (width > height ? width/4 : width/2),
      y: (width > height ? height/2: height/4), }
  }

  draw() {
    const width = window.innerWidth
    const height = window.innerHeight
    const size = 2*Math.min(width, height)/3
    ctx.globalAlpha = 0.05
    ctx.drawImage(this.image,
      this.center.x - size/2, this.center.y - size/2,
      size, size)
    ctx.globalAlpha = 1
  }

  getColorAt(position) {
    if (!this.data)
      return [0, 0, 0]
    position = {
      x: parseInt(position.x - this.center.x + (this.data.width/2)),
      y: parseInt(position.y - this.center.y + (this.data.height/2)), }
    if (position.x > this.data.width)
      return [0, 0, 0]
    if (position.y > this.data.height)
      return [0, 0, 0]
    const components = this.data.data.length/(this.data.width*this.data.height)
    const idx = position.y*components*this.data.width + position.x*components
    return [this.data.data[idx], this.data.data[idx+1], this.data.data[idx+2]]
  }
}
