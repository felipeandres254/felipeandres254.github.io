export const DEFAULT_CONFIG = {
  darkMatter: {
    enabled: true,
    massFactor: 2,
  },
  advanced: {
    clusterInterval: 60,
    clusterLink: 50,
    clusterMin: 5,
    reframeLerp: 0.05,
    softening: 10,
    theta: 0.5,
  },
  grid: {
    color: '#8800ff',
    interval: 5,
    maxDisp: 10,
    opacity: 0.5,
    show: true,
    spacing: 25,
  },
  interaction: {
    dragPeriod: 1500,
    velocityScale: 0.01,
  },
  physics: {
    dt: 0.5,
    G: 0.05,
    massMax: 100,
    massMin: 1,
    maxDist: 1,
    n: 5000,
  },
  render: {
    bgColor: '#060810',
    hueFastHeavy: 240,
    hueFastLight: 180,
    hueSlowHeavy: 0,
    hueSlowLight: 60,
    radiusMax: 2,
    radiusScale: 1.8,
    speedMax: 5,
    trailAlpha: 0.05,
    trails: true,
    zoomLerp: 0.05,
  },
}

function sortedKeys(obj) {
  const result = {}
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key]
    result[key] = val !== null && typeof val === 'object' && !Array.isArray(val)
      ? sortedKeys(val)
      : val
  }
  return result
}

function deepMerge(base, patch) {
  const result = { ...base }
  for (const key of Object.keys(patch)) {
    const pv = patch[key]
    const bv = base[key]
    if (pv !== null && typeof pv === 'object' && !Array.isArray(pv) &&
        bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      result[key] = deepMerge(bv, pv)
    } else if (pv !== undefined) {
      result[key] = pv
    }
  }
  return result
}

function deepDiff(base, current) {
  const result = {}
  for (const key of Object.keys(current)) {
    const bv = base[key], cv = current[key]
    if (cv !== null && typeof cv === 'object' && !Array.isArray(cv) &&
        bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      const nested = deepDiff(bv, cv)
      if (Object.keys(nested).length > 0) result[key] = nested
    } else if (cv !== bv) {
      result[key] = cv
    }
  }
  return result
}

function encode(cfg) {
  const patch = deepDiff(DEFAULT_CONFIG, cfg)
  if (Object.keys(patch).length === 0) return ''
  return btoa(JSON.stringify(sortedKeys(patch)))
}

function decode(raw) {
  try {
    return JSON.parse(atob(raw))
  } catch {
    return {}
  }
}

export function createConfig() {
  const initial = window.location.search.length > 1
    ? deepMerge(DEFAULT_CONFIG, decode(window.location.search.slice(1)))
    : JSON.parse(JSON.stringify(DEFAULT_CONFIG))

  return { config: initial, encodeConfig, resetConfig, pushUrl }

  function encodeConfig() {
    return encode(initial)
  }

  function resetConfig() {
    const d = DEFAULT_CONFIG
    Object.assign(initial.darkMatter, JSON.parse(JSON.stringify(d.darkMatter)))
    Object.assign(initial.advanced, JSON.parse(JSON.stringify(d.advanced)))
    Object.assign(initial.grid, JSON.parse(JSON.stringify(d.grid)))
    Object.assign(initial.interaction, JSON.parse(JSON.stringify(d.interaction)))
    Object.assign(initial.physics, JSON.parse(JSON.stringify(d.physics)))
    Object.assign(initial.render, JSON.parse(JSON.stringify(d.render)))
  }

  function pushUrl() {
    const b64 = encodeConfig()
    history.replaceState(null, '', b64 ? window.location.pathname + '?' + b64 : window.location.pathname)
  }
}
