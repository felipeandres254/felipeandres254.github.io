import { createConfig, DEFAULT_CONFIG } from './config.js'
import { createGravityEngine } from './gravity.js'

const { config, encodeConfig, resetConfig, pushUrl } = createConfig()
const engine = createGravityEngine(config)

const canvas = document.getElementById('gc')
const ctx = canvas.getContext('2d')
let dpr = 1
let trailCanvas, trailCtx

let bodyCount = 0
let showHint = true
let dragActive = false
let dragX0 = 0, dragY0 = 0, dragX1 = 0, dragY1 = 0, dragStartTime = 0
let gridPoints = [], gridField = [], gridCols = 0, gridRows = 0, gridX0 = 0, gridY0 = 0
let frameCount = 0
let currentZoom = 1
let zoomReady = false
let rafId = 0
let modalOpen = false
let activeTab = 'Physics'
let shareToastTimer = 0

const TABS = ['Physics', 'Render', 'Grid', 'Interaction', 'Advanced']

function cssW() { return canvas.clientWidth }
function cssH() { return canvas.clientHeight }

function setupCanvas() {
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx.scale(dpr, dpr)
  ctx.fillStyle = config.render.bgColor
  ctx.fillRect(0, 0, cssW(), cssH())
  trailCanvas = new OffscreenCanvas(canvas.width, canvas.height)
  trailCtx = trailCanvas.getContext('2d')
  trailCtx.scale(dpr, dpr)
}

function bodyColor(mass, speed) {
  const tm = Math.min(1, Math.max(0, (mass - config.physics.massMin) / (config.physics.massMax - config.physics.massMin)))
  const ts = Math.min(1, Math.max(0, speed / config.render.speedMax))
  const hue = config.render.hueSlowLight * (1 - tm) * (1 - ts)
            + config.render.hueSlowHeavy * tm * (1 - ts)
            + config.render.hueFastLight * (1 - tm) * ts
            + config.render.hueFastHeavy * tm * ts
  return `hsl(${Math.round(hue)}, 100%, 50%)`
}

function drawArrow(c, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 4) return
  const angle = Math.atan2(dy, dx)
  const tipLen = Math.min(len * 0.25, 16)
  c.save()
  c.strokeStyle = 'rgba(255,255,255,0.75)'
  c.lineWidth = 1.5
  c.setLineDash([7, 4])
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
  c.setLineDash([])
  c.beginPath()
  c.moveTo(x1, y1)
  c.lineTo(x1 - tipLen * Math.cos(angle - Math.PI / 6), y1 - tipLen * Math.sin(angle - Math.PI / 6))
  c.moveTo(x1, y1)
  c.lineTo(x1 - tipLen * Math.cos(angle + Math.PI / 6), y1 - tipLen * Math.sin(angle + Math.PI / 6))
  c.stroke()
  c.restore()
}

function buildGridPoints(W, H) {
  const cx = W / 2, cy = H / 2
  const R = config.physics.maxDist * Math.max(W, H)
  gridX0 = cx - R; gridY0 = cy - R
  gridCols = Math.ceil(2 * R / config.grid.spacing) + 1
  gridRows = Math.ceil(2 * R / config.grid.spacing) + 1
  gridPoints = []
  for (let row = 0; row < gridRows; row++)
    for (let col = 0; col < gridCols; col++)
      gridPoints.push({ x: gridX0 + col * config.grid.spacing, y: gridY0 + row * config.grid.spacing })
  gridField = gridPoints.map(() => ({ ax: 0, ay: 0, phi: 0 }))
}

function drawGridMesh(c) {
  if (!config.grid.show || !gridCols || !gridField.length) return
  function node(col, row) {
    const entry = gridField[row * gridCols + col]
    const bx = gridX0 + col * config.grid.spacing, by = gridY0 + row * config.grid.spacing
    if (!entry) return [bx, by]
    const { ax, ay, phi } = entry
    const mag = Math.sqrt(ax * ax + ay * ay)
    const s = mag > 1e-12 ? config.grid.maxDisp * Math.tanh(phi * 0.3) / mag : 0
    return [bx + ax * s, by + ay * s]
  }
  c.save()
  c.globalAlpha = config.grid.opacity
  c.strokeStyle = config.grid.color
  c.lineWidth = 0.7 / currentZoom
  c.setLineDash([])
  for (let row = 0; row < gridRows; row++) {
    c.beginPath()
    for (let col = 0; col < gridCols; col++) { const [x, y] = node(col, row); col === 0 ? c.moveTo(x, y) : c.lineTo(x, y) }
    c.stroke()
  }
  for (let col = 0; col < gridCols; col++) {
    c.beginPath()
    for (let row = 0; row < gridRows; row++) { const [x, y] = node(col, row); row === 0 ? c.moveTo(x, y) : c.lineTo(x, y) }
    c.stroke()
  }
  c.restore()
}

function render() {
  const W = cssW(), H = cssH()
  const horizonRWorld = config.physics.maxDist * Math.max(W, H)
  const horizonR = Math.min(W, H) / 2 - 15
  const bodies = engine.tick(W, H)
  bodyCount = bodies.length

  const cx = W / 2, cy = H / 2
  const targetZoom = horizonR / horizonRWorld
  if (!zoomReady) { currentZoom = targetZoom; zoomReady = true }
  else currentZoom += (targetZoom - currentZoom) * config.render.zoomLerp

  if (++frameCount % config.grid.interval === 0) gridField = engine.fieldAt(gridPoints)

  if (trailCtx && trailCanvas) {
    if (config.render.trails) {
      trailCtx.globalCompositeOperation = 'destination-in'
      trailCtx.fillStyle = `rgba(255,255,255,${1 - config.render.trailAlpha})`
      trailCtx.save(); trailCtx.setTransform(1, 0, 0, 1, 0, 0); trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height); trailCtx.restore()
      trailCtx.globalCompositeOperation = 'source-over'
    } else {
      trailCtx.save(); trailCtx.setTransform(1, 0, 0, 1, 0, 0); trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height); trailCtx.restore()
    }
    trailCtx.save(); trailCtx.translate(cx, cy); trailCtx.scale(currentZoom, currentZoom); trailCtx.translate(-cx, -cy)
    for (const b of bodies) { const speed = Math.hypot(b.vx, b.vy); trailCtx.fillStyle = bodyColor(b.mass, speed); trailCtx.beginPath(); trailCtx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); trailCtx.fill() }
    trailCtx.restore()
  }

  ctx.fillStyle = config.render.bgColor; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.translate(cx, cy); ctx.scale(currentZoom, currentZoom); ctx.translate(-cx, -cy); drawGridMesh(ctx); ctx.restore()
  if (trailCanvas) ctx.drawImage(trailCanvas, 0, 0, W, H)

  if (dragActive) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(currentZoom, currentZoom); ctx.translate(-cx, -cy)
    const dm = dragMass(); const tm = (dm - config.physics.massMin) / (config.physics.massMax - config.physics.massMin)
    const previewR = 4 + tm * 12
    ctx.strokeStyle = bodyColor(dm, 0); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.arc(dragX0, dragY0, previewR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
    drawArrow(ctx, dragX0, dragY0, dragX1, dragY1); ctx.restore()
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2.5, 2.5])
  ctx.beginPath(); ctx.arc(W / 2, H / 2, horizonR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])

  updateHud()
  rafId = requestAnimationFrame(render)
}

function updateHud() {
  document.getElementById('hud-count').textContent = `${bodyCount} bodies · ${engine.clusterCount} clusters`
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect()
  const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top
  const cx = cssW() / 2, cy = cssH() / 2
  return [(cssX - cx) / currentZoom + cx, (cssY - cy) / currentZoom + cy]
}

function dragMass() {
  const phase = (Date.now() - dragStartTime) / config.interaction.dragPeriod * Math.PI * 2
  return config.physics.massMin + (config.physics.massMax - config.physics.massMin) * (0.5 + 0.5 * Math.sin(phase))
}

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return
  const [x, y] = canvasCoords(e)
  dragActive = true; dragStartTime = Date.now(); dragX0 = dragX1 = x; dragY0 = dragY1 = y
  showHint = false; document.getElementById('hud-hint').classList.remove('visible')
})

canvas.addEventListener('mousemove', e => {
  if (!dragActive) return
  const [x, y] = canvasCoords(e); dragX1 = x; dragY1 = y
})

canvas.addEventListener('mouseup', e => {
  if (!dragActive) return
  const mass = dragMass(); dragActive = false
  const [x, y] = canvasCoords(e)
  const vx = (x - dragX0) * config.interaction.velocityScale
  const vy = (y - dragY0) * config.interaction.velocityScale
  engine.addBody(dragX0, dragY0, vx, vy, mass)
})

canvas.addEventListener('mouseleave', () => { dragActive = false })

canvas.addEventListener('contextmenu', e => {
  e.preventDefault()
  const [x, y] = canvasCoords(e)
  const [vx, vy] = engine.getCircularVelocity(x, y, cssW() / 2, cssH() / 2)
  const meanMass = Math.sqrt(config.physics.massMin * config.physics.massMax)
  engine.addBody(x, y, vx, vy, meanMass)
})

function onResize() {
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx.scale(dpr, dpr)
  ctx.fillStyle = config.render.bgColor; ctx.fillRect(0, 0, cssW(), cssH())
  trailCanvas = new OffscreenCanvas(canvas.width, canvas.height)
  trailCtx = trailCanvas.getContext('2d')
  trailCtx.scale(dpr, dpr)
  buildGridPoints(cssW(), cssH())
}

function onReset() { engine.reset(cssW(), cssH()) }

// ---- Modal ----
const modalEl = document.getElementById('modal')
const modalTabs = document.getElementById('modal-tabs')
const modalBody = document.getElementById('modal-body')

document.getElementById('hud-gear').addEventListener('click', () => openModal())

function openModal() {
  modalOpen = true; modalEl.style.display = 'flex'; renderTabs(); renderTabContent()
}

function closeModal() {
  modalOpen = false; modalEl.style.display = 'none'
}

function renderTabs() {
  modalTabs.innerHTML = ''
  for (const tab of TABS) {
    const btn = document.createElement('button')
    btn.className = 'modal-tab' + (tab === activeTab ? ' active' : '')
    btn.textContent = tab
    btn.addEventListener('click', () => { activeTab = tab; renderTabs(); renderTabContent() })
    modalTabs.appendChild(btn)
  }
}

function renderTabContent() {
  modalBody.innerHTML = ''
  if (activeTab === 'Physics') renderPhysics()
  else if (activeTab === 'Render') renderRender()
  else if (activeTab === 'Grid') renderGrid()
  else if (activeTab === 'Interaction') renderInteraction()
  else if (activeTab === 'Advanced') renderAdvanced()
}

const D = {
  n: 'Initial body count. Refill adds bodies up to this target without removing existing ones.',
  G: 'Gravitational constant. Controls force strength and sets the escape-velocity stickiness threshold.',
  dt: 'Integration timestep per frame. Larger = faster simulation but reduced accuracy.',
  massMin: 'Lower bound of the Gaussian mass distribution.',
  massMax: 'Upper bound of the Gaussian mass distribution.',
  maxDist: 'Removal horizon as a multiple of max(W,H). Bodies beyond this distance are deleted.',
  bgColor: 'Canvas background color — any valid CSS color (hex, rgb, hsl, rgba…).',
  hueSlowLight: 'Color hue (0–360°) for light, slow-moving bodies. Default 60° = yellow.',
  hueSlowHeavy: 'Color hue for heavy, slow-moving bodies. Default 0° = red.',
  hueFastLight: 'Color hue for light, fast-moving bodies. Default 180° = cyan.',
  hueFastHeavy: 'Color hue for heavy, fast-moving bodies. Default 240° = blue.',
  trails: 'Enable motion trails. Only particles trail — grid and horizon are always drawn fresh.',
  trailAlpha: 'Trail decay per frame (alpha multiplied by 1−this). Higher = faster fade.',
  radiusScale: 'Body radius multiplier. radius = min(radiusMax, radiusScale × ∛mass).',
  radiusMax: 'Maximum body radius in screen pixels.',
  speedMax: 'Speed (px/frame) that saturates the color hue shift.',
  zoomLerp: 'Fraction of zoom error corrected per frame — controls camera smoothing.',
  show: 'Toggle the spacetime fabric grid overlay.',
  spacing: 'World-pixel distance between grid nodes. Smaller = denser mesh, more expensive.',
  maxDisp: 'Maximum grid node displacement in world pixels at peak potential.',
  gridInterval: 'Frames between gravitational field recalculations for the grid.',
  gridColor: 'Grid line color — any valid CSS color.',
  opacity: 'Grid line opacity (0 = invisible, 1 = fully opaque).',
  dragPeriod: 'Duration (ms) of one full mass oscillation cycle while dragging to launch a body.',
  velocityScale: 'Multiplier converting drag-distance (px) to launch velocity (px/frame).',
  theta: 'Barnes-Hut opening angle θ. Lower = more accurate but slower (approaches O(N²)).',
  softening: 'Gravitational softening length (px). Prevents force singularities at very close range.',
  reframeLerp: 'Fraction of center-of-mass drift corrected per frame. Keeps the simulation centered.',
  clusterLink: 'Friends-of-Friends linking distance (px). Bodies within this range share a cluster.',
  clusterMin: 'Minimum body count to report a group as a distinct cluster.',
  clusterInterval: 'Frames between Friends-of-Friends cluster recalculations.',
  dmEnabled: 'Enable per-cluster dark matter halos. Each galaxy gets a Hernquist halo centered on its own center of mass, preventing tidal dispersal at large radii.',
  massFactor: 'Dark matter mass as a multiple of the cluster\'s visible mass. DM mass = massFactor × cluster mass. Typical observed galaxies: 5–10×.',
}

function cfgRow(label, infoKey, children) {
  const row = document.createElement('div'); row.className = 'cfg-row'
  const lbl = document.createElement('span'); lbl.className = 'cfg-label'; lbl.textContent = label; row.appendChild(lbl)
  row.appendChild(children)
  const info = document.createElement('button'); info.className = 'info-btn'; info.textContent = '?'
  info.addEventListener('mouseenter', e => showTip(e, D[infoKey]))
  info.addEventListener('mouseleave', hideTip)
  row.appendChild(info)
  return row
}

function cfgSlider(key, min, max, step, obj) {
  obj = obj || config
  const parts = key.split('.')
  function getV() { let v = obj; for (const p of parts) v = v[p]; return v }
  function setV(v) { let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; pushUrl() }
  const wrap = document.createElement('div'); wrap.style.display = 'contents'
  const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'cfg-slider'
  slider.min = min; slider.max = max; slider.step = step; slider.value = getV()
  slider.addEventListener('input', () => { setV(parseFloat(slider.value)); num.value = slider.value })
  wrap.appendChild(slider)
  const num = document.createElement('input'); num.type = 'number'; num.className = 'cfg-input'
  num.min = min; num.max = max; num.step = step; num.value = getV()
  num.addEventListener('change', () => { const v = parseFloat(num.value); if (!isNaN(v)) { setV(v); slider.value = v } })
  wrap.appendChild(num)
  return wrap
}

function cfgCheckbox(key, obj) {
  obj = obj || config
  const parts = key.split('.')
  function getV() { let v = obj; for (const p of parts) v = v[p]; return v }
  function setV(v) { let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; pushUrl() }
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'cfg-toggle'
  cb.checked = getV()
  cb.addEventListener('change', () => setV(cb.checked))
  return cb
}

function cfgColor(key) {
  const parts = key.split('.')
  function getV() { let v = config; for (const p of parts) v = v[p]; return v }
  function setV(v) { let o = config; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; pushUrl() }
  const wrap = document.createElement('div'); wrap.className = 'cfg-color-wrap'
  const input = document.createElement('input'); input.type = 'text'; input.className = 'cfg-color-text'; input.value = getV()
  input.addEventListener('change', () => { setV(input.value); swatch.style.background = input.value })
  wrap.appendChild(input)
  const swatch = document.createElement('span'); swatch.className = 'cfg-color-swatch'; swatch.style.background = getV()
  wrap.appendChild(swatch)
  return wrap
}

function cfgHue(key) {
  const parts = key.split('.')
  function getV() { let v = config; for (const p of parts) v = v[p]; return v }
  function setV(v) { let o = config; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; pushUrl() }
  const wrap = document.createElement('div'); wrap.style.display = 'contents'
  const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'cfg-slider'
  slider.min = 0; slider.max = 360; slider.step = 1; slider.value = getV()
  slider.addEventListener('input', () => { setV(parseInt(slider.value)); num.value = slider.value; swatch.style.background = `hsl(${slider.value},100%,50%)` })
  wrap.appendChild(slider)
  const num = document.createElement('input'); num.type = 'number'; num.className = 'cfg-input'
  num.min = 0; num.max = 360; num.step = 1; num.value = getV()
  num.addEventListener('change', () => { const v = parseInt(num.value); if (!isNaN(v)) { setV(v); slider.value = v; swatch.style.background = `hsl(${v},100%,50%)` } })
  wrap.appendChild(num)
  const swatch = document.createElement('span'); swatch.className = 'cfg-hue-swatch'; swatch.style.background = `hsl(${getV()},100%,50%)`
  wrap.appendChild(swatch)
  return wrap
}

function cfgDisabledRow(key, label, infoKey) {
  const row = document.createElement('div'); row.className = 'cfg-row cfg-disabled'
  const lbl = document.createElement('span'); lbl.className = 'cfg-label'; lbl.textContent = label; row.appendChild(lbl)
  const msg = document.createElement('span'); msg.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.35)'; msg.textContent = '(enable first)'
  row.appendChild(msg)
  return row
}

function renderPhysics() {
  modalBody.appendChild(cfgRow('Bodies (n)', 'n', cfgSlider('physics.n', 1, 50000, 1)))
  modalBody.appendChild(cfgRow('G', 'G', cfgSlider('physics.G', 0.0001, 0.5, 0.0001)))
  modalBody.appendChild(cfgRow('dt', 'dt', cfgSlider('physics.dt', 0.05, 2, 0.05)))
  modalBody.appendChild(cfgRow('Mass min', 'massMin', cfgSlider('physics.massMin', 0.1, config.physics.massMax - 0.1, 0.1)))
  modalBody.appendChild(cfgRow('Mass max', 'massMax', cfgSlider('physics.massMax', config.physics.massMin + 0.1, 10000, 0.1)))
  modalBody.appendChild(cfgRow('Horizon (×screen)', 'maxDist', cfgSlider('physics.maxDist', 0.1, 5, 0.1)))
  modalBody.appendChild(cfgRow('Dark matter', 'dmEnabled', cfgCheckbox('darkMatter.enabled')))
  if (config.darkMatter.enabled) {
    modalBody.appendChild(cfgRow('DM mass factor', 'massFactor', cfgSlider('darkMatter.massFactor', 1, 20, 0.5)))
  } else {
    modalBody.appendChild(cfgDisabledRow('darkMatter.massFactor', 'DM mass factor', 'massFactor'))
  }
}

function renderRender() {
  modalBody.appendChild(cfgRow('Background', 'bgColor', cfgColor('render.bgColor')))
  modalBody.appendChild(cfgRow('Light+slow hue', 'hueSlowLight', cfgHue('render.hueSlowLight')))
  modalBody.appendChild(cfgRow('Heavy+slow hue', 'hueSlowHeavy', cfgHue('render.hueSlowHeavy')))
  modalBody.appendChild(cfgRow('Light+fast hue', 'hueFastLight', cfgHue('render.hueFastLight')))
  modalBody.appendChild(cfgRow('Heavy+fast hue', 'hueFastHeavy', cfgHue('render.hueFastHeavy')))
  modalBody.appendChild(cfgRow('Motion trails', 'trails', cfgCheckbox('render.trails')))
  if (config.render.trails) {
    modalBody.appendChild(cfgRow('Trail alpha', 'trailAlpha', cfgSlider('render.trailAlpha', 0.01, 0.5, 0.01)))
  } else {
    modalBody.appendChild(cfgDisabledRow('render.trailAlpha', 'Trail alpha', 'trailAlpha'))
  }
  modalBody.appendChild(cfgRow('Radius scale', 'radiusScale', cfgSlider('render.radiusScale', 0.1, 5, 0.1)))
  modalBody.appendChild(cfgRow('Radius max (px)', 'radiusMax', cfgSlider('render.radiusMax', 0.5, 20, 0.5)))
  modalBody.appendChild(cfgRow('Speed max (px/frame)', 'speedMax', cfgSlider('render.speedMax', 1, 50, 1)))
  modalBody.appendChild(cfgRow('Zoom lerp', 'zoomLerp', cfgSlider('render.zoomLerp', 0.001, 0.2, 0.001)))
}

function renderGrid() {
  modalBody.appendChild(cfgRow('Show grid', 'show', cfgCheckbox('grid.show')))
  if (config.grid.show) {
    modalBody.appendChild(cfgRow('Spacing (px)', 'spacing', cfgSlider('grid.spacing', 5, 100, 1)))
    modalBody.appendChild(cfgRow('Max displacement', 'maxDisp', cfgSlider('grid.maxDisp', 1, 100, 1)))
    modalBody.appendChild(cfgRow('Update interval (f)', 'gridInterval', cfgSlider('grid.interval', 1, 30, 1)))
    modalBody.appendChild(cfgRow('Color', 'gridColor', cfgColor('grid.color')))
    modalBody.appendChild(cfgRow('Opacity', 'opacity', cfgSlider('grid.opacity', 0, 1, 0.01)))
  } else {
    modalBody.appendChild(cfgDisabledRow('grid.spacing', 'Spacing (px)', 'spacing'))
    modalBody.appendChild(cfgDisabledRow('grid.maxDisp', 'Max displacement', 'maxDisp'))
    modalBody.appendChild(cfgDisabledRow('grid.interval', 'Update interval (f)', 'gridInterval'))
    modalBody.appendChild(cfgDisabledRow('grid.color', 'Color', 'gridColor'))
    modalBody.appendChild(cfgDisabledRow('grid.opacity', 'Opacity', 'opacity'))
  }
}

function renderInteraction() {
  modalBody.appendChild(cfgRow('Drag period (ms)', 'dragPeriod', cfgSlider('interaction.dragPeriod', 100, 5000, 100)))
  modalBody.appendChild(cfgRow('Velocity scale', 'velocityScale', cfgSlider('interaction.velocityScale', 0.001, 0.1, 0.001)))
}

function renderAdvanced() {
  modalBody.appendChild(cfgRow('θ (Barnes-Hut)', 'theta', cfgSlider('advanced.theta', 0.1, 2, 0.05)))
  modalBody.appendChild(cfgRow('Softening (px)', 'softening', cfgSlider('advanced.softening', 0.1, 100, 0.1)))
  modalBody.appendChild(cfgRow('Reframe lerp', 'reframeLerp', cfgSlider('advanced.reframeLerp', 0.001, 0.5, 0.001)))
  modalBody.appendChild(cfgRow('Cluster link (px)', 'clusterLink', cfgSlider('advanced.clusterLink', 5, 500, 5)))
  modalBody.appendChild(cfgRow('Cluster min bodies', 'clusterMin', cfgSlider('advanced.clusterMin', 2, 100, 1)))
  modalBody.appendChild(cfgRow('Cluster interval (f)', 'clusterInterval', cfgSlider('advanced.clusterInterval', 10, 300, 10)))
}

// Tooltip
const tooltipEl = document.getElementById('tooltip')
function showTip(e, text) { tooltipEl.textContent = text; tooltipEl.style.left = (e.clientX + 14) + 'px'; tooltipEl.style.top = (e.clientY - 10) + 'px'; tooltipEl.style.display = 'block' }
function hideTip() { tooltipEl.textContent = ''; tooltipEl.style.display = 'none' }

// Modal footer buttons
document.getElementById('modal-reset').addEventListener('click', () => {
  resetConfig(); buildGridPoints(cssW(), cssH()); pushUrl(); renderTabContent(); renderTabs()
})

document.getElementById('modal-share').addEventListener('click', async () => {
  const b64 = encodeConfig()
  const url = b64 ? window.location.origin + window.location.pathname + '?' + b64 : window.location.origin + window.location.pathname
  await navigator.clipboard.writeText(url).catch(() => {})
  const toast = document.getElementById('toast')
  toast.classList.add('visible')
  clearTimeout(shareToastTimer)
  shareToastTimer = setTimeout(() => toast.classList.remove('visible'), 2200)
})

document.getElementById('modal-close').addEventListener('click', closeModal)
modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal() })

// Init
setupCanvas()
buildGridPoints(cssW(), cssH())
engine.init(cssW(), cssH())
rafId = requestAnimationFrame(render)
window.addEventListener('resize', onResize)
setTimeout(() => { document.getElementById('hud-hint').classList.remove('visible') }, 4000)
