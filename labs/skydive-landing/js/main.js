// ---- helpers ----
const NM_TO_DEG = 1 / 60
const FT_TO_NM = 0.3048 / 1852
const KG_TO_LB = 2.20462
const FT_TO_M = 0.3048
const LEG_ALT_FT = 250
const LEG_ALT_M = LEG_ALT_FT * FT_TO_M

function nmLat(nm) { return nm * NM_TO_DEG }
function nmLng(nm, lat) { return nm * NM_TO_DEG / Math.cos(lat * Math.PI / 180) }
function circlePolygon(lng, lat, radiusNm, steps = 72) {
  const pts = []; const dlat = nmLat(radiusNm); const dlng = nmLng(radiusNm, lat)
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * 2 * Math.PI; pts.push([lng + dlng * Math.sin(a), lat + dlat * Math.cos(a)]) }
  return pts
}
function circleLine(lng, lat, radiusNm, steps = 72) { return { type: 'Feature', geometry: { type: 'LineString', coordinates: circlePolygon(lng, lat, radiusNm) }, properties: {} } }
function lineFeature(coords) { return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} } }
function pointFeature(lng, lat, props = {}) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props } }

// ---- pattern builder ----
function buildPatternCoords(lng, lat, hdg, turn, offsetFt, dwLenFt) {
  const offsetNm = offsetFt * FT_TO_NM; const dwLenNm = dwLenFt * FT_TO_NM
  const hdgRad = hdg * Math.PI / 180; const side = turn === 'right' ? 1 : -1
  const fwdLng = Math.sin(hdgRad); const fwdLat = Math.cos(hdgRad)
  const perpLng = Math.cos(hdgRad) * side; const perpLat = -Math.sin(hdgRad) * side
  const dlat = nmLat(1); const dlng = nmLng(1, lat)
  const offLng = dlng * offsetNm * perpLng; const offLat = dlat * offsetNm * perpLat
  const halfDwLng = dlng * (dwLenNm / 2) * fwdLng; const halfDwLat = dlat * (dwLenNm / 2) * fwdLat
  const entryLng = lng + halfDwLng + offLng; const entryLat = lat + halfDwLat + offLat
  const exitLng = lng - halfDwLng + offLng; const exitLat = lat - halfDwLat + offLat
  const baseEndLng = exitLng - offLng; const baseEndLat = exitLat - offLat
  return [[entryLng, entryLat], [exitLng, exitLat], [baseEndLng, baseEndLat], [lng, lat]]
}

function abeamPoint(lng, lat, hdg, turn, offsetFt) {
  const offsetNm = offsetFt * FT_TO_NM; const hdgRad = hdg * Math.PI / 180
  const side = turn === 'right' ? 1 : -1
  const perpLng = Math.cos(hdgRad) * side; const perpLat = -Math.sin(hdgRad) * side
  const dlat = nmLat(1); const dlng = nmLng(1, lat)
  return [lng + dlng * offsetNm * perpLng, lat + dlat * offsetNm * perpLat]
}

// ---- config ----
let dropzones = []
let isMobile = window.innerWidth < 768

const cfg = {
  dzIndex: 0, targetType: 'student',
  dzLat: -27.07025125, dzLng: 152.38314497,
  targetLat: -27.06991982, targetLng: 152.38104249,
  jumprun: 90, finalHdg: 98, turnDir: 'right',
  glideRatio: 3.6, canopyArea: 230, exitWeight: 105,
  windDir: 260, windSpeed: 6,
  circles: [{ color: '#ff3333', radius: 1.0 }, { color: '#ffcc00', radius: 0.5 }],
  tileBrightness: -0.25, satelliteOpacity: 0.5, showParticles: true,
}

function applyDropzone(dz) {
  cfg.dzLat = dz.location[0]; cfg.dzLng = dz.location[1]
  cfg.jumprun = dz.jumprun; cfg.circles = JSON.parse(JSON.stringify(dz.circles))
  applyTarget(cfg.targetType)
}

function applyTarget(type) {
  const dz = dropzones[cfg.dzIndex]
  if (type === 'main') { cfg.targetLat = dz.mainTarget[0]; cfg.targetLng = dz.mainTarget[1] }
  else { cfg.targetLat = dz.studentTarget[0]; cfg.targetLng = dz.studentTarget[1] }
}

function wingLoading() { return cfg.exitWeight * KG_TO_LB / cfg.canopyArea }
function forwardSpeedMs() { const wl = wingLoading(); return Math.max(4.5, 7.6 + (wl - 0.8) * 7.6) }
function descentRateMs() { const wl = wingLoading(); return Math.max(1.5, 3.0 + (wl - 0.8) * 4.6) }
function patternScaleFt() { return forwardSpeedMs() * LEG_ALT_M / descentRateMs() / FT_TO_M }

// ---- state ----
let map = null, mapLoaded = false, particleRaf = 0, updateTimer = 0, targetDragging = false
let modalOpen = false, activeTab = 'Drop zone'
const TABS = ['Drop zone', 'Pattern', 'Wind & particles']

// ---- particles ----
let particles = []
function initParticles() {
  const w = window.innerWidth; const h = window.innerHeight
  particles = Array.from({ length: 500 }, () => ({ x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h), alpha: 1, size: 2 }))
}

const windCanvas = document.getElementById('wind-canvas')

function drawParticles() {
  if (!windCanvas) return
  const ctx = windCanvas.getContext('2d'); if (!ctx) return
  const dpr = window.devicePixelRatio || 1; const W = window.innerWidth; const H = window.innerHeight
  if (windCanvas.width !== W * dpr || windCanvas.height !== H * dpr) { windCanvas.width = W * dpr; windCanvas.height = H * dpr }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H)
  if (!cfg.showParticles) return
  const windTo = (cfg.windDir + 180) % 360; const windToRad = windTo * Math.PI / 180
  const speed = cfg.windSpeed / 10; const dx = Math.sin(windToRad) * speed; const dy = -Math.cos(windToRad) * speed
  for (const p of particles) {
    p.x += dx; p.y += dy
    if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10
    if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = '#9966ff'; ctx.fill()
  }
  // wind arrow
  const cx = 50, cy = 50
  ctx.save(); ctx.translate(cx, cy); const arrowRad = (windTo - 90) * Math.PI / 180
  ctx.rotate(arrowRad); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(18, 0); ctx.lineTo(14, 5); ctx.stroke()
  ctx.font = '10px Ubuntu Mono, monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText(`${cfg.windDir}°`, 0, 22); ctx.restore()
}

function particleLoop() { drawParticles(); particleRaf = requestAnimationFrame(particleLoop) }

// ---- map layer management ----
function upsertSource(id, feature) {
  if (!map) return
  const existing = map.getSource(id)
  if (existing) existing.setData(feature)
  else map.addSource(id, { type: 'geojson', data: feature })
}

function upsertLayer(id, source, type, paint, layout) {
  if (!map || map.getLayer(id)) return
  map.addLayer({ id, source, type, paint, layout: layout || {} })
}

function ensureCircles() {
  if (!map) return
  for (let i = 0; i < 20; i++) { if (map.getLayer(`circle-${i}-stroke`)) map.removeLayer(`circle-${i}-stroke`); if (map.getSource(`circle-${i}-src`)) map.removeSource(`circle-${i}-src`) }
  for (let i = 0; i < cfg.circles.length; i++) {
    const c = cfg.circles[i]
    upsertSource(`circle-${i}-src`, circleLine(cfg.dzLng, cfg.dzLat, c.radius))
    upsertLayer(`circle-${i}-stroke`, `circle-${i}-src`, 'line', { 'line-color': c.color, 'line-width': 5, 'line-opacity': 0.95 }, { 'line-join': 'round', 'line-cap': 'round' })
  }
}

function ensureCardinalLines() {
  if (!map) return
  const extent = nmLng(3, cfg.dzLat)
  const srcs = [
    { id: 'cardinal-ns', coords: [[cfg.dzLng, cfg.dzLat - extent * 1.5], [cfg.dzLng, cfg.dzLat + extent * 1.5]] },
    { id: 'cardinal-ew', coords: [[cfg.dzLng - extent * 1.5, cfg.dzLat], [cfg.dzLng + extent * 1.5, cfg.dzLat]] },
  ]
  for (const s of srcs) {
    upsertSource(s.id + '-src', lineFeature(s.coords))
    const g = Math.round(255 * cfg.satelliteOpacity)
    upsertLayer(s.id, s.id + '-src', 'line', { 'line-color': `rgb(${g},${g},${g})`, 'line-width': 5, 'line-opacity': 0.5 }, { 'line-join': 'round', 'line-cap': 'round' })
  }
}

function drawPattern(suffix, lng, lat, opacity) {
  if (!map) return
  const legLengthFt = cfg.glideRatio * 250
  const pts = buildPatternCoords(lng, lat, cfg.finalHdg, cfg.turnDir, legLengthFt, legLengthFt * 2)
  const abeam = abeamPoint(lng, lat, cfg.finalHdg, cfg.turnDir, legLengthFt)
  const pfx = suffix ? 'p-' + suffix : 'p'
  const lo = opacity
  const trimmedPts = [abeam, pts[1], pts[2], [lng, lat]]
  upsertSource(pfx + '-line-src', lineFeature(trimmedPts))
  upsertLayer(pfx + '-line', pfx + '-line-src', 'line', { 'line-color': '#336699', 'line-width': 5, 'line-opacity': lo }, { 'line-join': 'round', 'line-cap': 'round' })
  const hdgRad = cfg.finalHdg * Math.PI / 180
  const dlat = nmLat(1); const dlng = nmLng(1, lat)
  const arcRadiusNm = legLengthFt * FT_TO_NM
  const arcSteps = 24
  const aStart = hdgRad - Math.PI / 4
  const aEnd = hdgRad + Math.PI / 4
  const arcStart = [abeam[0] + dlng * arcRadiusNm * Math.sin(aStart), abeam[1] + dlat * arcRadiusNm * Math.cos(aStart)]
  const arcEnd = [abeam[0] + dlng * arcRadiusNm * Math.sin(aEnd), abeam[1] + dlat * arcRadiusNm * Math.cos(aEnd)]
  const radiusFeats = [lineFeature([abeam, arcStart]), lineFeature([abeam, arcEnd])]
  upsertSource(pfx + '-radius-src', { type: 'FeatureCollection', features: radiusFeats })
  upsertLayer(pfx + '-radius', pfx + '-radius-src', 'line', { 'line-color': '#336699', 'line-width': 5, 'line-opacity': lo }, { 'line-join': 'round', 'line-cap': 'round' })
  const arcCoords = []
  for (let i = 0; i <= arcSteps; i++) { const a = aStart + (i / arcSteps) * (Math.PI / 2); arcCoords.push([abeam[0] + dlng * arcRadiusNm * Math.sin(a), abeam[1] + dlat * arcRadiusNm * Math.cos(a)]) }
  const fillCoords = [abeam, ...arcCoords, abeam]
  upsertSource(pfx + '-arc-fill-src', { type: 'Feature', geometry: { type: 'Polygon', coordinates: [fillCoords] }, properties: {} })
  upsertLayer(pfx + '-arc-fill', pfx + '-arc-fill-src', 'fill', { 'fill-color': '#336699', 'fill-opacity': lo * 0.5 })
  upsertSource(pfx + '-arc-src', lineFeature(arcCoords))
  upsertLayer(pfx + '-arc', pfx + '-arc-src', 'line', { 'line-color': '#336699', 'line-width': 5, 'line-opacity': lo }, { 'line-join': 'round', 'line-cap': 'round' })
}

function ensurePattern() {
  if (!map) return
  const oldLayers = ['pattern-line', 'pattern-arc', 'pattern-radius', 'pattern-target-fill', 'pattern-target-stroke', 'pattern-waypoints', 'pattern-markers', 'pattern-3d', 'pattern-drops', 'wind-adapted-line', 'wind-adapted-arc', 'wind-adapted-arc-fill', 'wind-adapted-radius', 'p-nw-dw', 'p-nw-dw-arc', 'p-nw-dw-arc-fill', 'p-nw-dw-radius', 'p-nw-line', 'p-nw-arc', 'p-nw-arc-fill', 'p-nw-radius']
  const oldSources = ['pattern-line-src', 'pattern-arc-src', 'pattern-radius-src', 'pattern-target-src', 'pattern-waypoints-src', 'pattern-markers-src', 'pattern-3d-src', 'pattern-drops-src', 'wind-adapted-src', 'wind-adapted-arc-src', 'wind-adapted-arc-fill-src', 'wind-adapted-radius-src', 'p-nw-dw-src', 'p-nw-dw-arc-src', 'p-nw-dw-arc-fill-src', 'p-nw-dw-radius-src', 'p-nw-line-src', 'p-nw-arc-src', 'p-nw-arc-fill-src', 'p-nw-radius-src']
  for (const id of oldLayers) { if (map.getLayer(id)) map.removeLayer(id) }
  for (const id of oldSources) { if (map.getSource(id)) map.removeSource(id) }

  const legLengthFt = cfg.glideRatio * 250
  const nilPts = buildPatternCoords(cfg.targetLng, cfg.targetLat, cfg.finalHdg, cfg.turnDir, legLengthFt, legLengthFt * 2)
  const abeam = abeamPoint(cfg.targetLng, cfg.targetLat, cfg.finalHdg, cfg.turnDir, legLengthFt)
  const windToRad = ((cfg.windDir + 180) % 360) * Math.PI / 180
  const drPerLeg = cfg.windSpeed * 0.514444 * (250 * 0.3048) / descentRateMs() / 1852
  const dx = nmLng(drPerLeg, cfg.targetLat) * Math.sin(windToRad)
  const dy = nmLat(drPerLeg) * Math.cos(windToRad)
  const drExit = [nilPts[1][0] - dx, nilPts[1][1] - dy]
  const drStart = [nilPts[2][0] - dx, nilPts[2][1] - dy]
  const drAbeam = [abeam[0] - dx, abeam[1] - dy]
  upsertSource('wind-adapted-src', lineFeature([drAbeam, drExit, drStart, [cfg.targetLng, cfg.targetLat]]))
  upsertLayer('wind-adapted-line', 'wind-adapted-src', 'line', {
    'line-color': '#004488', 'line-width': 5, 'line-opacity': 1.0,
  }, { 'line-join': 'round', 'line-cap': 'round' })

  // arc
  const hdgRad = cfg.finalHdg * Math.PI / 180
  const dlat = nmLat(1); const dlng = nmLng(1, cfg.targetLat)
  const arcRadiusNm = legLengthFt * FT_TO_NM; const arcSteps = 24
  const aStart = hdgRad - Math.PI / 4; const aEnd = hdgRad + Math.PI / 4
  const arcCoords = []
  for (let i = 0; i <= arcSteps; i++) { const a = aStart + (i / arcSteps) * (Math.PI / 2); arcCoords.push([drAbeam[0] + dlng * arcRadiusNm * Math.sin(a), drAbeam[1] + dlat * arcRadiusNm * Math.cos(a)]) }
  const fillCoords = [drAbeam, ...arcCoords, drAbeam]
  upsertSource('wind-adapted-arc-fill-src', { type: 'Feature', geometry: { type: 'Polygon', coordinates: [fillCoords] }, properties: {} })
  upsertLayer('wind-adapted-arc-fill', 'wind-adapted-arc-fill-src', 'fill', { 'fill-color': '#004488', 'fill-opacity': 0.5 })
  upsertSource('wind-adapted-arc-src', lineFeature(arcCoords))
  upsertLayer('wind-adapted-arc', 'wind-adapted-arc-src', 'line', { 'line-color': '#004488', 'line-width': 5, 'line-opacity': 1.0 }, { 'line-join': 'round', 'line-cap': 'round' })
  upsertSource('wind-adapted-radius-src', { type: 'FeatureCollection', features: [
    lineFeature([drAbeam, [drAbeam[0] + dlng * arcRadiusNm * Math.sin(aStart), drAbeam[1] + dlat * arcRadiusNm * Math.cos(aStart)]]),
    lineFeature([drAbeam, [drAbeam[0] + dlng * arcRadiusNm * Math.sin(aEnd), drAbeam[1] + dlat * arcRadiusNm * Math.cos(aEnd)]]),
  ]})
  upsertLayer('wind-adapted-radius', 'wind-adapted-radius-src', 'line', { 'line-color': '#004488', 'line-width': 5, 'line-opacity': 1.0 })

  drawPattern('nw', cfg.targetLng, cfg.targetLat, 0.5)

  // target circle
  const targetNm = 5 / 1852
  const targetGeo = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(cfg.targetLng, cfg.targetLat, targetNm)] }, properties: {} }
  upsertSource('p-target-src', targetGeo)
  upsertLayer('p-target-fill', 'p-target-src', 'fill', { 'fill-color': '#ff4444', 'fill-opacity': 0.5 })
  upsertLayer('p-target-stroke', 'p-target-src', 'line', { 'line-color': '#ff4444', 'line-width': 2 })
}

function rebuildLayers() { if (!map || !mapLoaded) return; ensureCircles(); ensureCardinalLines(); ensurePattern(); updateHud() }

// ---- satellite opacity ----
function updateSatelliteOpacity() {
  if (!map || !mapLoaded) return
  map.setPaintProperty('satellite', 'raster-opacity', cfg.satelliteOpacity)
  const g = Math.round(255 * cfg.satelliteOpacity); const c = `rgb(${g},${g},${g})`
  map.setPaintProperty('cardinal-ns', 'line-color', c); map.setPaintProperty('cardinal-ew', 'line-color', c)
}

function updateTileBrightness() {
  if (!map || !mapLoaded) return
  const v = cfg.tileBrightness
  map.setPaintProperty('satellite', 'raster-brightness-min', v > 0 ? v : 0)
  map.setPaintProperty('satellite', 'raster-brightness-max', v < 0 ? 1 + v : 1)
}

function zoomToPattern() {
  if (!map) return
  const legLengthFt = cfg.glideRatio * 250
  const pts = buildPatternCoords(cfg.targetLng, cfg.targetLat, cfg.finalHdg, cfg.turnDir, legLengthFt, legLengthFt * 2)
  const abeam = abeamPoint(cfg.targetLng, cfg.targetLat, cfg.finalHdg, cfg.turnDir, legLengthFt)
  const allPts = [abeam, pts[1], pts[2], [cfg.targetLng, cfg.targetLat]]
  const lngs = allPts.map(p => p[0]); const lats = allPts.map(p => p[1])
  map.flyTo({ center: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2], duration: 600 })
}

function queueMapUpdate() { clearTimeout(updateTimer); updateTimer = setTimeout(rebuildLayers, 50) }

function deferUpdate() {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    if (!map || !mapLoaded) return; map.flyTo({ center: [cfg.dzLng, cfg.dzLat], zoom: 15, duration: 600 }); rebuildLayers()
  }, 50)
}

function updateHud() {
  const el = document.getElementById('hud-status')
  if (el) {
    const ws = cfg.windDir === 0 && cfg.windSpeed === 0 ? '-' : `${cfg.windDir}° @ ${cfg.windSpeed}kt`
    el.textContent = `${ws} · ${(cfg.glideRatio * 250 * 0.3048).toFixed(0)}m leg`
  }
}

// ---- modal/sidebar UI ----
function renderForm() {
  const container = isMobile ? document.getElementById('modal-body') : document.getElementById('sidebar')
  if (!container) return
  const isSidebar = !isMobile
  container.innerHTML = ''

  function row(label, children) {
    const r = document.createElement('div'); r.className = 'cfg-row'
    const l = document.createElement('span'); l.className = 'cfg-label'; l.textContent = label; r.appendChild(l)
    if (typeof children === 'string') { const s = document.createElement('span'); s.innerHTML = children; r.appendChild(s) }
    else r.appendChild(children)
    return r
  }

  function tab(name, fn) {
    if (isSidebar || activeTab === name) { fn() }
  }

  tab('Drop zone', () => {
    if (isSidebar) { const h = document.createElement('div'); h.className = 'section-header'; h.textContent = 'Drop zone'; container.appendChild(h) }
    const selRow = document.createElement('div'); selRow.className = 'cfg-row'
    const selLbl = document.createElement('span'); selLbl.className = 'cfg-label'; selLbl.textContent = 'Dropzone'; selRow.appendChild(selLbl)
    const sel = document.createElement('select'); sel.className = 'cfg-select'
    for (let i = 0; i < dropzones.length; i++) { const o = document.createElement('option'); o.value = i; o.textContent = dropzones[i].name; if (i === cfg.dzIndex) o.selected = true; sel.appendChild(o) }
    sel.addEventListener('change', () => { cfg.dzIndex = parseInt(sel.value); applyDropzone(dropzones[cfg.dzIndex]); deferUpdate(); updateHud() })
    selRow.appendChild(sel); container.appendChild(selRow)

    const tgtRow = document.createElement('div'); tgtRow.className = 'cfg-row'
    const tgtLbl = document.createElement('span'); tgtLbl.className = 'cfg-label'; tgtLbl.textContent = 'Target'; tgtRow.appendChild(tgtLbl)
    const tgtSel = document.createElement('select'); tgtSel.className = 'cfg-select'
    for (const v of ['main', 'student']) { const o = document.createElement('option'); o.value = v; o.textContent = v.charAt(0).toUpperCase() + v.slice(1); if (v === cfg.targetType) o.selected = true; tgtSel.appendChild(o) }
    tgtSel.addEventListener('change', () => { cfg.targetType = tgtSel.value; applyTarget(cfg.targetType); queueMapUpdate() })
    tgtRow.appendChild(tgtSel); container.appendChild(tgtRow)

    const jr = sliderRow('Jumprun', cfg.jumprun, 0, 360, 1, v => { cfg.jumprun = v })
    container.appendChild(jr)

    const so = sliderRow('Satellite opacity', cfg.satelliteOpacity, 0, 1, 0.05, v => { cfg.satelliteOpacity = v; updateSatelliteOpacity() })
    container.appendChild(so)
  })

  tab('Pattern', () => {
    if (isSidebar) { const h = document.createElement('div'); h.className = 'section-header'; h.textContent = 'Pattern'; container.appendChild(h) }

    const fh = sliderRow('Final heading', cfg.finalHdg, 0, 360, 1, v => { cfg.finalHdg = v; queueMapUpdate() })
    container.appendChild(fh)

    const td = selectRow('Turn direction', ['right', 'left'], cfg.turnDir, v => { cfg.turnDir = v; queueMapUpdate() })
    container.appendChild(td)

    const ca = sliderRow('Canopy (ft\u00B2)', cfg.canopyArea, 70, 350, 10, v => { cfg.canopyArea = v; queueMapUpdate() })
    container.appendChild(ca)

    const ew = sliderRow('Exit weight (kg)', cfg.exitWeight, 40, 160, 2, v => { cfg.exitWeight = v; queueMapUpdate() })
    container.appendChild(ew)

    const gr = sliderRow('Glide ratio', cfg.glideRatio, 1, 8, 0.1, v => { cfg.glideRatio = v; queueMapUpdate() })
    container.appendChild(gr)

    const info = document.createElement('div'); info.className = 'cfg-info'; info.id = 'cfg-info'
    container.appendChild(info)
  })

  tab('Wind & particles', () => {
    if (isSidebar) { const h = document.createElement('div'); h.className = 'section-header'; h.textContent = 'Wind & particles'; container.appendChild(h) }

    const wd = sliderRow('Wind direction', cfg.windDir, 0, 360, 1, v => { cfg.windDir = v; queueMapUpdate() })
    container.appendChild(wd)

    const ws = sliderRow('Wind speed (kt)', cfg.windSpeed, 0, 60, 1, v => { cfg.windSpeed = v; queueMapUpdate() })
    container.appendChild(ws)
  })

  function sliderRow(label, val, min, max, step, onChange) {
    const r = document.createElement('div'); r.className = 'cfg-row'
    const l = document.createElement('span'); l.className = 'cfg-label'; l.textContent = label; r.appendChild(l)
    const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'cfg-slider'
    slider.min = min; slider.max = max; slider.step = step; slider.value = val
    slider.addEventListener('input', () => { num.value = slider.value; onChange(parseFloat(slider.value)) })
    r.appendChild(slider)
    const num = document.createElement('input'); num.type = 'number'; num.className = 'cfg-input'
    num.min = min; num.max = max; num.step = step; num.value = val
    num.addEventListener('change', () => { const v = parseFloat(num.value); if (!isNaN(v)) { slider.value = v; onChange(v) } })
    r.appendChild(num)
    return r
  }

  function selectRow(label, options, current, onChange) {
    const r = document.createElement('div'); r.className = 'cfg-row'
    const l = document.createElement('span'); l.className = 'cfg-label'; l.textContent = label; r.appendChild(l)
    const s = document.createElement('select'); s.className = 'cfg-select'
    for (const o of options) { const opt = document.createElement('option'); opt.value = o; opt.textContent = o.charAt(0).toUpperCase() + o.slice(1); if (o === current) opt.selected = true; s.appendChild(opt) }
    s.addEventListener('change', () => onChange(s.value))
    r.appendChild(s); return r
  }
}

function updateCfgInfo() {
  const el = document.getElementById('cfg-info')
  if (!el) return
  el.innerHTML = `<span>WL ${wingLoading().toFixed(2)} psf</span>` +
    `<span>${forwardSpeedMs().toFixed(1)} m/s fwd</span>` +
    `<span>${descentRateMs().toFixed(1)} m/s desc</span>` +
    `<span>GR ${cfg.glideRatio.toFixed(1)}  →  ${(cfg.glideRatio * 250 * 0.3048).toFixed(0)}m leg</span>`
}

// ---- events ----
document.getElementById('hud-zoom')?.addEventListener('click', zoomToPattern)
document.getElementById('hud-wind-toggle')?.addEventListener('click', () => { cfg.showParticles = !cfg.showParticles; document.getElementById('hud-wind-toggle').textContent = cfg.showParticles ? '\u2261' : '\u2205' })
document.getElementById('hud-gear')?.addEventListener('click', () => {
  if (isMobile) { modalOpen = true; document.getElementById('modal').style.display = 'flex'; renderForm(); renderTabs() }
})
document.getElementById('modal-close')?.addEventListener('click', () => { modalOpen = false; document.getElementById('modal').style.display = 'none' })
document.getElementById('modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) { modalOpen = false; document.getElementById('modal').style.display = 'none' } })

function renderTabs() {
  const tabsEl = document.getElementById('modal-tabs'); if (!tabsEl) return
  tabsEl.innerHTML = ''
  for (const tab of TABS) {
    const btn = document.createElement('button'); btn.className = 'modal-tab' + (tab === activeTab ? ' active' : '')
    btn.textContent = tab
    btn.addEventListener('click', () => { activeTab = tab; renderTabs(); renderForm() })
    tabsEl.appendChild(btn)
  }
}

// ---- lifecycle ----
async function init() {
  try {
    const res = await fetch('dropzones.json')
    dropzones = await res.json()
  } catch {}
  if (!dropzones.length) return

  applyDropzone(dropzones[0])

  const token = document.querySelector('meta[name="mapbox-token"]')?.getAttribute('content') || ''
  if (!token) { console.warn('No Mapbox token set — add <meta name="mapbox-token" content="...">') }

  mapboxgl.accessToken = token
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [cfg.dzLng, cfg.dzLat],
    zoom: 15, maxZoom: 18, minZoom: 8,
  })

  map.on('load', () => {
    mapLoaded = true
    if (!map.getSource('satellite')) {
      map.addSource('satellite', {
        type: 'raster',
        tiles: [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=${token}`],
        tileSize: 256,
      })
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-opacity': cfg.satelliteOpacity } })
    }
    updateSatelliteOpacity()
    updateTileBrightness()
    rebuildLayers()

    // Target dragging
    map.on('mouseenter', 'p-target-fill', () => { map.getCanvas().style.cursor = 'grab' })
    map.on('mouseleave', 'p-target-fill', () => { map.getCanvas().style.cursor = '' })
    map.on('mousedown', 'p-target-fill', () => { targetDragging = true; map.dragPan.disable() })
    map.on('mousemove', (e) => {
      if (!targetDragging) return
      cfg.targetLat = e.lngLat.lat; cfg.targetLng = e.lngLat.lng
      clearTimeout(updateTimer); updateTimer = setTimeout(rebuildLayers, 30)
    })
    map.on('mouseup', () => { if (!targetDragging) return; targetDragging = false; map.dragPan.enable(); rebuildLayers() })

    renderForm()
    updateCfgInfo()
    updateHud()
    // Watch config info updates
    setInterval(updateCfgInfo, 500)
  })

  window.addEventListener('resize', () => {
    isMobile = window.innerWidth < 768
    if (isMobile) { document.getElementById('sidebar').style.display = 'none'; document.getElementById('modal').style.display = modalOpen ? 'flex' : 'none' }
    else { document.getElementById('sidebar').style.display = 'block'; document.getElementById('modal').style.display = 'none' }
    renderForm()
  })

  initParticles()
  particleLoop()
}

init()
