class QuadNode {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h
    this.cx = 0; this.cy = 0; this.totalMass = 0
    this.body = null
    this.nw = null; this.ne = null; this.sw = null; this.se = null
  }

  get isLeaf() { return this.nw === null }

  contains(b) {
    return b.x >= this.x && b.x < this.x + this.w && b.y >= this.y && b.y < this.y + this.h
  }

  subdivide() {
    const hw = this.w / 2, hh = this.h / 2
    this.nw = new QuadNode(this.x, this.y, hw, hh)
    this.ne = new QuadNode(this.x + hw, this.y, hw, hh)
    this.sw = new QuadNode(this.x, this.y + hh, hw, hh)
    this.se = new QuadNode(this.x + hw, this.y + hh, hw, hh)
  }

  insert(b) {
    if (!this.contains(b)) return false
    if (this.isLeaf) {
      if (this.body === null) { this.body = b; return true }
      if (this.w < 1) return true
      const existing = this.body
      this.body = null
      this.subdivide()
      this._insertIntoChild(existing)
    }
    return this._insertIntoChild(b)
  }

  _insertIntoChild(b) {
    return !!(this.nw?.insert(b) || this.ne?.insert(b) || this.sw?.insert(b) || this.se?.insert(b))
  }

  computeMass() {
    if (this.isLeaf) {
      if (this.body) { this.cx = this.body.x; this.cy = this.body.y; this.totalMass = this.body.mass }
      else { this.cx = 0; this.cy = 0; this.totalMass = 0 }
      return
    }
    this.totalMass = 0; this.cx = 0; this.cy = 0
    for (const child of [this.nw, this.ne, this.sw, this.se]) {
      child.computeMass()
      if (child.totalMass > 0) {
        const newTotal = this.totalMass + child.totalMass
        this.cx = (this.cx * this.totalMass + child.cx * child.totalMass) / newTotal
        this.cy = (this.cy * this.totalMass + child.cy * child.totalMass) / newTotal
        this.totalMass = newTotal
      }
    }
  }

  calcForce(b, outFx, outFy, G, THETA, SOFTENING) {
    if (this.totalMass === 0) return
    if (this.isLeaf && this.body === b) return
    const dx = this.cx - b.x, dy = this.cy - b.y
    const dist2 = dx * dx + dy * dy
    const dist = Math.sqrt(dist2)
    if (this.isLeaf || (dist > 0 && this.w / dist < THETA)) {
      const r2 = dist2 + SOFTENING * SOFTENING
      const r = Math.sqrt(r2)
      const f = G * b.mass * this.totalMass / r2
      outFx[0] += f * dx / r; outFy[0] += f * dy / r
      return
    }
    this.nw?.calcForce(b, outFx, outFy, G, THETA, SOFTENING)
    this.ne?.calcForce(b, outFx, outFy, G, THETA, SOFTENING)
    this.sw?.calcForce(b, outFx, outFy, G, THETA, SOFTENING)
    this.se?.calcForce(b, outFx, outFy, G, THETA, SOFTENING)
  }

  calcPotential(x, y, G, THETA, SOFTENING) {
    if (this.totalMass === 0) return 0
    const dx = this.cx - x, dy = this.cy - y
    const dist2 = dx * dx + dy * dy
    const dist = Math.sqrt(dist2)
    if (this.isLeaf || (dist > 0 && this.w / dist < THETA)) {
      return G * this.totalMass / Math.sqrt(dist2 + SOFTENING * SOFTENING)
    }
    return (this.nw?.calcPotential(x, y, G, THETA, SOFTENING) ?? 0)
         + (this.ne?.calcPotential(x, y, G, THETA, SOFTENING) ?? 0)
         + (this.sw?.calcPotential(x, y, G, THETA, SOFTENING) ?? 0)
         + (this.se?.calcPotential(x, y, G, THETA, SOFTENING) ?? 0)
  }
}

function bodyRadius(mass, radiusScale, radiusMax) {
  return Math.min(radiusMax, radiusScale * Math.cbrt(mass))
}

function buildTree(bodies, cx, cy) {
  let maxDist = 1
  for (const b of bodies) {
    const d = Math.max(Math.abs(b.x - cx), Math.abs(b.y - cy))
    if (d > maxDist) maxDist = d
  }
  const size = maxDist * 2.2 + 1
  const root = new QuadNode(cx - size / 2, cy - size / 2, size, size)
  for (const b of bodies) root.insert(b)
  root.computeMass()
  return root
}

function normalMass(massMin, massMax) {
  const mean = (massMin + massMax) / 2
  const std = (massMax - massMin) / 6
  const u1 = Math.random(), u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
  return Math.max(massMin, Math.min(massMax, mean + std * z))
}

function sampleHexagon(cx, cy, R) {
  const k = Math.floor(Math.random() * 6)
  const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3
  let r1 = Math.random(), r2 = Math.random()
  if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2 }
  return [cx + r1 * R * Math.cos(a0) + r2 * R * Math.cos(a1), cy + r1 * R * Math.sin(a0) + r2 * R * Math.sin(a1)]
}

function reframeToCom(bs, cx, cy) {
  if (bs.length === 0) return
  let tm = 0, comX = 0, comY = 0, comVx = 0, comVy = 0
  for (const b of bs) { tm += b.mass; comX += b.x * b.mass; comY += b.y * b.mass; comVx += b.vx * b.mass; comVy += b.vy * b.mass }
  const offX = cx - comX / tm, offY = cy - comY / tm
  const dvx = comVx / tm, dvy = comVy / tm
  for (const b of bs) { b.x += offX; b.y += offY; b.vx -= dvx; b.vy -= dvy }
}

function smoothReframeToCom(bs, cx, cy, lerp) {
  if (bs.length === 0) return
  let tm = 0, comX = 0, comY = 0, comVx = 0, comVy = 0
  for (const b of bs) { tm += b.mass; comX += b.x * b.mass; comY += b.y * b.mass; comVx += b.vx * b.mass; comVy += b.vy * b.mass }
  const offX = (cx - comX / tm) * lerp, offY = (cy - comY / tm) * lerp
  const dvx = (comVx / tm) * lerp, dvy = (comVy / tm) * lerp
  for (const b of bs) { b.x += offX; b.y += offY; b.vx -= dvx; b.vy -= dvy }
}

export function createGravityEngine(config) {
  let bodies = []
  let nextId = 0
  let tickCount = 0
  let lastTree = null
  let clusterCountVal = 1
  let dmBodyCluster = new Map()
  let dmClusterStats = new Map()

  function handleCollisions() {
    const { G, massMin, massMax } = config.physics
    const { softening } = config.advanced
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dist2 = dx * dx + dy * dy
        const minDist = a.radius + b.radius
        if (dist2 >= minDist * minDist) continue
        const dist = Math.sqrt(dist2)
        if (dist < 1e-10) continue
        const nx = dx / dist, ny = dy / dist
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        const overlap = minDist - dist
        const fa = b.mass / (a.mass + b.mass)
        const fb = 1 - fa
        a.x -= nx * overlap * fa; a.y -= ny * overlap * fa
        b.x += nx * overlap * fb; b.y += ny * overlap * fb
        if (vn <= 0) continue
        const vEsc = Math.sqrt(2 * G * (a.mass + b.mass) / minDist)
        const restitution = vn < vEsc ? 0 : 1
        const J = (1 + restitution) * a.mass * b.mass / (a.mass + b.mass) * vn
        a.vx -= J / a.mass * nx; a.vy -= J / a.mass * ny
        b.vx += J / b.mass * nx; b.vy += J / b.mass * ny
      }
    }
  }

  function findClusters() {
    const { clusterLink, clusterMin } = config.advanced
    const n = bodies.length
    if (n === 0) { dmBodyCluster.clear(); dmClusterStats.clear(); return 0 }
    const parent = new Int32Array(n), size = new Int32Array(n).fill(1)
    for (let i = 0; i < n; i++) parent[i] = i
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const l2 = clusterLink * clusterLink
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = bodies[j].x - bodies[i].x
        if (dx * dx > l2) continue
        const dy = bodies[j].y - bodies[i].y
        if (dx * dx + dy * dy >= l2) continue
        const ra = find(i), rb = find(j)
        if (ra !== rb) { parent[ra] = rb; size[rb] += size[ra] }
      }
    }
    const rootAccum = new Map()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      if (size[r] < clusterMin) continue
      let acc = rootAccum.get(r)
      if (!acc) { acc = { sx: 0, sy: 0, sm: 0, indices: [] }; rootAccum.set(r, acc) }
      acc.sx += bodies[i].x * bodies[i].mass; acc.sy += bodies[i].y * bodies[i].mass
      acc.sm += bodies[i].mass; acc.indices.push(i)
    }
    dmBodyCluster = new Map(); dmClusterStats = new Map()
    for (const [root, acc] of rootAccum) {
      const comX = acc.sx / acc.sm, comY = acc.sy / acc.sm
      let rms2 = 0
      for (const i of acc.indices) { const dx = bodies[i].x - comX, dy = bodies[i].y - comY; rms2 += (dx * dx + dy * dy) * bodies[i].mass; dmBodyCluster.set(bodies[i].id, root) }
      dmClusterStats.set(root, { totalMass: acc.sm, scaleRadius: Math.max(10, Math.sqrt(rms2 / acc.sm)) })
    }
    return rootAccum.size
  }

  function spawnInitialBody(cx, cy, rInit, omega, vCircRef) {
    const { massMin, massMax } = config.physics
    const { radiusScale, radiusMax } = config.render
    const mass = normalMass(massMin, massMax)
    const [x, y] = sampleHexagon(cx, cy, rInit)
    const dx = x - cx, dy = y - cy
    const vx = -dy * omega + (Math.random() - 0.5) * vCircRef * 0.05
    const vy = dx * omega + (Math.random() - 0.5) * vCircRef * 0.05
    return { id: nextId++, x, y, vx, vy, mass, radius: bodyRadius(mass, radiusScale, radiusMax) }
  }

  function initParams(width, height) {
    const { G, massMin, massMax, maxDist, n } = config.physics
    const cx = width / 2, cy = height / 2
    const rInit = maxDist * Math.max(width, height)
    const totalMass = n * (massMin + massMax) / 2
    const rRef = rInit * 0.5
    const vCircRef = Math.sqrt(G * totalMass / rRef)
    const omega = (vCircRef / rRef) * 0.5
    return { cx, cy, rInit, omega, vCircRef }
  }

  function init(width, height) {
    bodies = []; nextId = 0
    const { cx, cy, rInit, omega, vCircRef } = initParams(width, height)
    for (let i = 0; i < config.physics.n; i++) bodies.push(spawnInitialBody(cx, cy, rInit, omega, vCircRef))
    reframeToCom(bodies, cx, cy)
  }

  function tick(width, height) {
    if (bodies.length === 0) return bodies
    const { G, dt, maxDist } = config.physics
    const { theta, softening, reframeLerp, clusterInterval } = config.advanced
    const cx = width / 2, cy = height / 2
    const tree = buildTree(bodies, cx, cy)
    lastTree = tree
    const fx = [0], fy = [0]
    for (const b of bodies) {
      fx[0] = 0; fy[0] = 0
      tree.calcForce(b, fx, fy, G, theta, softening)
      b.vx += fx[0] / b.mass * dt; b.vy += fy[0] / b.mass * dt
      b.x += b.vx * dt; b.y += b.vy * dt
    }
    handleCollisions()
    if (config.darkMatter.enabled && dmBodyCluster.size > 0) {
      const comAccum = new Map()
      for (const b of bodies) {
        const ci = dmBodyCluster.get(b.id)
        if (ci === undefined) continue
        let ca = comAccum.get(ci)
        if (!ca) { ca = { sx: 0, sy: 0, sm: 0 }; comAccum.set(ci, ca) }
        ca.sx += b.x * b.mass; ca.sy += b.y * b.mass; ca.sm += b.mass
      }
      for (const b of bodies) {
        const ci = dmBodyCluster.get(b.id)
        if (ci === undefined) continue
        const stats = dmClusterStats.get(ci); const ca = comAccum.get(ci)
        if (!stats || !ca || ca.sm === 0) continue
        const comX = ca.sx / ca.sm, comY = ca.sy / ca.sm
        const dx = comX - b.x, dy = comY - b.y; const r = Math.sqrt(dx * dx + dy * dy)
        if (r < 1e-6) continue
        const acc_dm = G * config.darkMatter.massFactor * stats.totalMass / ((r + stats.scaleRadius) * (r + stats.scaleRadius))
        b.vx += acc_dm * dx / r * dt; b.vy += acc_dm * dy / r * dt
      }
    }
    const maxD = Math.max(width, height) * maxDist
    const maxD2 = maxD * maxD
    bodies = bodies.filter(b => { const dx = b.x - cx, dy = b.y - cy; return dx * dx + dy * dy < maxD2 })
    smoothReframeToCom(bodies, cx, cy, reframeLerp)
    if (++tickCount % clusterInterval === 0) clusterCountVal = findClusters()
    return bodies
  }

  function getCircularVelocity(x, y, cx, cy) {
    const { G } = config.physics
    const totalMass = bodies.reduce((s, b) => s + b.mass, 0)
    const dx = x - cx, dy = y - cy; const r = Math.sqrt(dx * dx + dy * dy)
    if (r < 1) return [0, 0]
    const vCirc = Math.sqrt(G * totalMass / r)
    return [-dy / r * vCirc, dx / r * vCirc]
  }

  function addBody(x, y, vx, vy, mass) {
    const { radiusScale, radiusMax } = config.render
    const body = { id: nextId++, x, y, vx, vy, mass, radius: bodyRadius(mass, radiusScale, radiusMax) }
    bodies.push(body)
    return body
  }

  function reset(width, height) {
    const { cx, cy, rInit, omega, vCircRef } = initParams(width, height)
    const toAdd = Math.max(0, config.physics.n - bodies.length)
    for (let i = 0; i < toAdd; i++) bodies.push(spawnInitialBody(cx, cy, rInit, omega, vCircRef))
  }

  function fieldAt(points) {
    const { G } = config.physics; const { theta, softening } = config.advanced
    if (!lastTree) return points.map(() => ({ ax: 0, ay: 0, phi: 0 }))
    const fx = [0], fy = [0]
    return points.map(({ x, y }) => {
      fx[0] = 0; fy[0] = 0
      lastTree.calcForce({ id: -1, x, y, vx: 0, vy: 0, mass: 1, radius: 0 }, fx, fy, G, theta, softening)
      return { ax: fx[0], ay: fy[0], phi: lastTree.calcPotential(x, y, G, theta, softening) }
    })
  }

  return { init, tick, addBody, reset, fieldAt, get clusterCount() { return clusterCountVal }, getCircularVelocity }
}
