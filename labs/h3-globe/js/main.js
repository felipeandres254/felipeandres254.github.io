const DEFAULTS = { res: 2, k: 2 }
const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const MAX_CELLS = 20000
const CENTER = [0, 23.43594]

const HIDE_LAYERS = [
  'boundary_country_outline', 'boundary_country_inner', 'boundary_state', 'boundary_county',
  'waterway_label', 'watername_ocean', 'watername_sea', 'watername_lake', 'watername_lake_line',
  'place_hamlet', 'place_suburbs', 'place_villages', 'place_town',
  'place_country_2', 'place_country_1', 'place_state', 'place_continent',
  'place_city_r6', 'place_city_r5', 'place_city_dot_r7', 'place_city_dot_r4',
  'place_city_dot_r2', 'place_city_dot_z7', 'place_capital_dot_z7',
  'poi_stadium', 'poi_park',
  'roadname_minor', 'roadname_sec', 'roadname_pri', 'roadname_major',
  'housenumber',
]

let map = null
let res = 2
let k = 2
let hoverCell = null
let lastHoverPoint = null
let pendingGridFlush = null

const els = {
  res: document.getElementById('hud-res'),
  resVal: document.getElementById('hud-res-val'),
  k: document.getElementById('hud-k'),
  kVal: document.getElementById('hud-k-val'),
  point: document.getElementById('hud-point'),
  info: document.getElementById('info'),
  infoId: document.getElementById('info-id'),
  infoPoint: document.getElementById('info-point'),
  infoCenter: document.getElementById('info-center'),
  infoRes: document.getElementById('info-res'),
  infoArea: document.getElementById('info-area'),
  infoBase: document.getElementById('info-base'),
  infoPent: document.getElementById('info-pent'),
  infoCopy: document.getElementById('info-copy'),
  infoClose: document.getElementById('info-close'),
  reset: document.getElementById('hud-reset'),
}

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
}

function initState() {
  const p = new URLSearchParams(location.hash.slice(1))
  res = clampInt(p.get('res'), 0, 15, DEFAULTS.res)
  k = clampInt(p.get('k'), 0, 4, DEFAULTS.k)
}

function setHud(msg) {
  els.point.textContent = msg
}

function fmtLatLng(lat, lng) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function syncControls() {
  els.res.value = String(res)
  els.resVal.textContent = String(res)
  els.k.value = String(k)
  els.kVal.textContent = String(k)
}

function updateHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  p.set('res', String(res))
  p.set('k', String(k))
  history.replaceState(null, '', `#${p.toString()}`)
}

// ---- Grid (all cells of the current resolution visible in the viewport) ----
function gridBounds() {
  const b = map.getBounds()
  let w = b.getWest()
  let e = b.getEast()
  // normalize to a start lng and a signed width (may wrap across the antimeridian)
  let width = e - w
  if (width <= 0) width += 360
  return {
    w,
    e,
    s: Math.max(b.getSouth(), -89.99),
    n: Math.min(b.getNorth(), 89.99),
    width,
  }
}

function gridStepDeg(res) {
  // edge length avg km, converted to degrees and reduced to guarantee overlap
  const edgeKm = h3.getHexagonEdgeLengthAvg(res, 'km')
  const deg = edgeKm / 111
  return Math.max(deg * 0.7, 0.01)
}

function sampleLng(lat, lng, seen) {
  const cell = h3.latLngToCell(lat, ((lng + 180) % 360) - 180, res)
  seen.add(cell)
}

function drawGrid() {
  if (!map || !map.getSource('grid')) return
  const { w, s, n, width } = gridBounds()
  const step = gridStepDeg(res)
  const seen = new Set()
  let capped = false
  outer:
  for (let lat = s; lat <= n; lat += step) {
    for (let lng = w; lng <= w + width; lng += step) {
      if (seen.size > MAX_CELLS) { capped = true; break outer }
      sampleLng(lat, lng, seen)
    }
  }
  if (capped) {
    setHud(`grid too dense — zoom in or lower res`)
    map.getSource('grid').setData({ type: 'FeatureCollection', features: [] })
    return
  }
  const features = [...seen].map((id) => gridFeature(id))
  map.getSource('grid').setData({ type: 'FeatureCollection', features })
  setHud(`${features.length.toLocaleString()} cells @ res ${res}`)
}

function unwrapRing(ring, centerLng) {
  return ring.map(([lng, lat]) => {
    let d = lng - centerLng
    while (d > 180) d -= 360
    while (d < -180) d += 360
    return [centerLng + d, lat]
  })
}

function cellBoundary(id) {
  const [, centerLng] = h3.cellToLatLng(id)
  return [unwrapRing(h3.cellToBoundary(id, true), centerLng)]
}

function gridFeature(id) {
  return {
    type: 'Feature',
    properties: { id, pentagon: h3.isPentagon(id) },
    geometry: { type: 'Polygon', coordinates: cellBoundary(id) },
  }
}

function scheduleGrid() {
  if (pendingGridFlush) return
  pendingGridFlush = window.setTimeout(() => {
    pendingGridFlush = null
    drawGrid()
  }, 120)
}

function setHover(cell) {
  const src = map.getSource('hover')
  if (!src) return
  if (hoverCell === cell) return
  hoverCell = cell
  renderHover(cell)
  const center = h3.cellToLatLng(cell)
  setHud(`${cell} @ res ${h3.getResolution(cell)} · ring k=${k}`)
}

function renderHover(cell) {
  const src = map.getSource('hover')
  if (!src) return
  const features = [{
    type: 'Feature',
    properties: { kind: 'sel' },
    geometry: { type: 'Polygon', coordinates: cellBoundary(cell) },
  }]
  if (k > 0) {
    for (const n of h3.gridDisk(cell, k)) {
      if (h3.getResolution(n) !== res) continue
      if (n === cell) continue
      features.push({
        type: 'Feature',
        properties: { kind: 'ring' },
        geometry: { type: 'Polygon', coordinates: cellBoundary(n) },
      })
    }
  }
  src.setData({ type: 'FeatureCollection', features })
}

function clearHover() {
  hoverCell = null
  const src = map && map.getSource('hover')
  if (src) src.setData({ type: 'FeatureCollection', features: [] })
}

function showInfo(lat, lng, cell) {
  const center = h3.cellToLatLng(cell)
  const centerLat = center[0]
  const centerLng = center[1]
  els.infoId.textContent = cell
  els.infoPoint.textContent = fmtLatLng(lat ?? centerLat, lng ?? centerLng)
  els.infoCenter.textContent = fmtLatLng(centerLat, centerLng)
  els.infoRes.textContent = String(h3.getResolution(cell))
  els.infoArea.textContent = `${h3.cellArea(cell, 'km2').toLocaleString()} km²`
  els.infoBase.textContent = String(h3.getBaseCellNumber(cell))
  const pent = h3.isPentagon(cell)
  els.infoPent.textContent = pent ? 'yes' : 'no'
  els.infoPent.style.color = pent ? '#ef4444' : '#0088ff'
  els.info.style.display = 'block'
}

function addRes0Layer() {
  const features = h3.getRes0Cells().map((id) => gridFeature(id))
  map.addSource('res0', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  })
  map.addLayer({
    id: 'res0-line', type: 'line', source: 'res0',
    paint: { 'line-color': '#000000', 'line-width': 1, 'line-opacity': 1 },
  })
}

function addLayers() {
  for (const id of HIDE_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
  }
  addRes0Layer()
  map.addSource('grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('hover', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'grid-fill', type: 'fill', source: 'grid',
    paint: {
      'fill-color': ['case', ['get', 'pentagon'], '#ff8c42', '#ffffff'],
      'fill-opacity': 0.08,
    },
  })
  map.addLayer({
    id: 'grid-border', type: 'line', source: 'grid',
    paint: {
      'line-color': ['case', ['get', 'pentagon'], '#ef4444', '#0088ff'],
      'line-width': ['case', ['get', 'pentagon'], 1.5, 1],
      'line-opacity': 0.6,
    },
  })
  map.addLayer({
    id: 'hover-fill', type: 'fill', source: 'hover',
    filter: ['==', ['get', 'kind'], 'sel'],
    paint: { 'fill-color': '#0088ff', 'fill-opacity': 0.45 },
  })
  map.addLayer({
    id: 'hover-ring', type: 'fill', source: 'hover',
    filter: ['==', ['get', 'kind'], 'ring'],
    paint: { 'fill-color': '#0088ff', 'fill-opacity': 0.18 },
  })
  map.addLayer({
    id: 'hover-border', type: 'line', source: 'hover',
    filter: ['==', ['get', 'kind'], 'sel'],
    paint: { 'line-color': '#0055cc', 'line-width': 2, 'line-opacity': 1 },
  })
}

function bindUi() {
  els.res.addEventListener('input', () => {
    res = Number(els.res.value)
    els.resVal.textContent = String(res)
    updateHash()
    drawGrid()
    clearHover()
  })
  els.k.addEventListener('input', () => {
    k = Number(els.k.value)
    els.kVal.textContent = String(k)
    updateHash()
    if (lastHoverPoint) {
      hoverCell = null
      onMapMove({ lngLat: lastHoverPoint })
    }
  })
  els.reset.addEventListener('click', () => {
    map.flyTo({ center: CENTER, zoom: 2, duration: 1000 })
  })
  els.infoCopy.addEventListener('click', () => {
    const id = els.infoId.textContent
    if (!id) return
    navigator.clipboard.writeText(id).then(() => {
      els.infoCopy.textContent = 'copied'
      setTimeout(() => { els.infoCopy.textContent = 'copy index' }, 1200)
    })
  })
  els.infoClose.addEventListener('click', () => {
    els.info.style.display = 'none'
  })
}

function onMapMove(e) {
  if (!map.getSource('hover')) return
  const { lat, lng } = e.lngLat
  lastHoverPoint = { lat, lng }
  const cell = h3.latLngToCell(lat, lng, res)
  setHover(cell)
}

function onMapClick(e) {
  const { lat, lng } = e.lngLat
  const cell = h3.latLngToCell(lat, lng, res)
  showInfo(lat, lng, cell)
}

function init() {
  initState()
  map = new maplibregl.Map({
    container: 'map',
    style: STYLE,
    center: CENTER,
    zoom: 2,
  })

  map.on('load', () => {
    map.setProjection({ type: 'globe' })
    addLayers()
    bindUi()
    syncControls()
    drawGrid()
    map.on('click', onMapClick)
    map.on('mousemove', onMapMove)
    map.on('mouseleave', clearHover)
    map.on('moveend', scheduleGrid)
    map.on('idle', scheduleGrid)
  })
}

init()