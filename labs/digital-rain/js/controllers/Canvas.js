/**
 * @author Andrés Felipe Torres
 */
import { hsl2rgb, rgb2hsl, rgbBrightness } from '../helpers/Color.js'
import Picture from '../helpers/Picture.js'

const width = () => window.innerWidth
const height = () => window.innerHeight

const START_LOCATION = -50
const GET_NUM_DROPS = () => parseInt(width() / (width() > height() ? 5 : 10))
const GET_SIZE = () => parseInt(12.5 + 12.5 * Math.random() / 2)
const GET_ALPHA = () => 0.5 + 0.25 * Math.random()
const GET_ALPHA_DELTA = () => (width() > height() ? 0.005 : 0.0025)
const GET_SPEED = () => 5 + 2.5 * Math.random()
const GET_COLOR = () => hsl2rgb(Math.floor(152 + 56 * Math.random()) / 360, 1, 0.375)

const CHARSET = [
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  String.fromCharCode(...Array.from(new Array(0xff9d - 0xff66), (_, i) => i + 0xff66)),
].join('')

const canvas = document.querySelector('canvas#background')
const ctx = canvas.getContext('2d')

let cursor = { x: START_LOCATION, y: START_LOCATION }
let traces = []

document.body.addEventListener('mousemove', (event) => {
  cursor.x = event.clientX
  cursor.y = event.clientY })

class CanvasTrace {
  constructor(position, size, char, color, alpha) {
    this.position = JSON.parse(JSON.stringify(position))
    this.size = size
    this.char = char
    this.color = JSON.parse(JSON.stringify(color)).join(',')
    this.alpha = alpha
    this.overlay = {
      color: JSON.parse(JSON.stringify(this.color)),
      alpha: JSON.parse(JSON.stringify(this.alpha)), }
  }

  draw() {
    if (this.overlay.alpha <= 0)
      return -1
    this.alpha -= GET_ALPHA_DELTA()
    this.overlay.alpha -= GET_ALPHA_DELTA() / 1.25
    ctx.font = `${this.size}px monospace`
    ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`
    ctx.beginPath()
    ctx.fillText(this.char, this.position.x, this.position.y)
    ctx.fill()
  }
}

class CanvasDrop {
  constructor() {
    ;(this.init = this.init.bind(this))()
  }

  init() {
    this.position = Object.assign(this.position || {}, { x: width() * Math.random() })
    this.position.y = (this.position.y ? START_LOCATION : height()) * Math.random()
    this.size = GET_SIZE()
    this.speed = GET_SPEED()
    this.color = GET_COLOR()
    this.alpha = GET_ALPHA()
    this.interval = 5 - Math.floor(this.speed)
    this.overlay = {
      color: JSON.parse(JSON.stringify(this.color)).join(','),
      alpha: JSON.parse(JSON.stringify(this.alpha)), }

    this.count = 0
    this.lastY = this.position.y
    this.char = CHARSET.charAt(Math.floor(CHARSET.length * Math.random()))

    for (let y = this.position.y; y > 0; y -= this.size) {
      const position = { x: this.position.x, y }
      const char = CHARSET.charAt(Math.floor(CHARSET.length * Math.random()))
      const alpha = this.alpha - GET_ALPHA_DELTA() * (this.position.y - y)
      traces.push(new CanvasTrace(position, this.size, char, this.color, alpha))
    }
  }

  draw() {
    if (this.position.y > this.lastY+this.size) {
      traces.push(new CanvasTrace(this.position, this.size, this.char, this.color, this.alpha))
      this.lastY = this.position.y
    }
    if (this.count >= this.interval) {
      this.char = CHARSET.charAt(Math.floor(CHARSET.length * Math.random()))
      this.count = 0
    }
    this.count++
    this.position.y += this.speed
    ctx.font = `${this.size}px monospace`
    ctx.fillStyle = `rgba(75%, 75%, 75%, ${this.alpha})`
    ctx.beginPath()
    ctx.fillText(this.char, this.position.x, this.position.y)
    ctx.fill()
  }
}

export default class Canvas {
  constructor() {
    window.addEventListener('resize', () => this.resize())
    this.resize()

    Array.from(new Array(parseInt(width() / 20)), () => {
      const position = { x: width() * Math.random(), y: height() + 50 * Math.random() }
      const size = GET_SIZE()
      const color = GET_COLOR()
      const alpha = GET_ALPHA()

      for (let y = position.y; y > 0; y -= size) {
        const nPosition = { x: position.x, y }
        const char = CHARSET.charAt(Math.floor(CHARSET.length * Math.random()))
        const nAlpha = alpha - GET_ALPHA_DELTA() * (nPosition.y - y)
        if (nAlpha > 0)
          traces.push(new CanvasTrace(nPosition, size, char, color, nAlpha))
      }
    })
    this.drops = Array.from(new Array(GET_NUM_DROPS()), () => new CanvasDrop)
    ;(this.animate = this.animate.bind(this))()
  }

  resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const target = GET_NUM_DROPS()
    while (!!this.drops && this.drops.length !== target) {
      if (this.drops.length > target)
        this.drops.pop()
      else
        this.drops.push(new CanvasDrop)
    }
    traces = []
    if (!this.drops) return
    this.drops.forEach(drop => {
      drop.position.x = width() * Math.random()
      drop.position.y = Math.random() * height()
    })
  }

  animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    traces = traces.filter((trace) => trace.draw() !== -1)
    this.drops = this.drops.filter((drop) => {
      if(drop.position.y >= canvas.height) {
        if (this.drops.length <= GET_NUM_DROPS())
          drop.init()
      }
      drop.draw()
      return true
    })
    ctx.fillStyle = 'rgba(0, 0, 0, 25%)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    requestAnimationFrame(this.animate)
  }
}
