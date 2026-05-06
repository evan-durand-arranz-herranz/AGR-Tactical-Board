import { describe, it, expect } from 'vitest'
import { analyzeShape, svgArcPath } from './shapeAnalysis'

// ─── Geometry helpers ──────────────────────────────────────────────────────────

function circle(cx: number, cy: number, r: number, n = 64, start = 0, end = 2 * Math.PI) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * (end - start)
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

// Approximate a circle with slight random jitter to simulate freehand drawing
function jitteredCircle(cx: number, cy: number, r: number, n = 48, amplitude = 4) {
  let seed = 42
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    const jr = r + (rng() - 0.5) * amplitude * 2
    pts.push({ x: cx + jr * Math.cos(a), y: cy + jr * Math.sin(a) })
  }
  return pts
}

// Approximate a square with slight jitter
function jitteredSquare(cx: number, cy: number, s: number, amplitude = 5) {
  const h = s / 2
  const corners = [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
    { x: cx - h, y: cy - h },  // close it
  ]
  let seed = 7
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }
  const pts = []
  for (let i = 0; i < corners.length - 1; i++) {
    const p0 = corners[i], p1 = corners[i + 1]
    for (let t = 0; t < 1; t += 0.1) {
      pts.push({
        x: p0.x + t * (p1.x - p0.x) + (rng() - 0.5) * amplitude * 2,
        y: p0.y + t * (p1.y - p0.y) + (rng() - 0.5) * amplitude * 2,
      })
    }
  }
  pts.push(corners[corners.length - 1])
  return pts
}

// Straight horizontal line with slight jitter
function jitteredLine(x0: number, y0: number, x1: number, y1: number, n = 20, amplitude = 3) {
  let seed = 13
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push({
      x: x0 + t * (x1 - x0) + (rng() - 0.5) * amplitude * 2,
      y: y0 + t * (y1 - y0) + (rng() - 0.5) * amplitude * 2,
    })
  }
  return pts
}

// Semi-circle (0 → π)
function semicircle(cx: number, cy: number, r: number) {
  return circle(cx, cy, r, 40, 0, Math.PI)
}

// Arc spanning ~230° (between 180° and 270°) → should fallback to path
function largeArc(cx: number, cy: number, r: number) {
  return circle(cx, cy, r, 60, 0, (230 / 180) * Math.PI)
}
// Arc spanning ~300° (> 270°) → should be ellipse
function nearlyCompleteArc(cx: number, cy: number, r: number) {
  return circle(cx, cy, r, 60, 0, (300 / 180) * Math.PI)
}

// Zigzag
function zigzag() {
  return [
    { x: 100, y: 300 }, { x: 150, y: 200 }, { x: 200, y: 300 },
    { x: 250, y: 200 }, { x: 300, y: 300 }, { x: 350, y: 200 },
  ]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeShape — line', () => {
  it('detects a straight horizontal line', () => {
    const pts = jitteredLine(100, 300, 700, 300, 30, 3)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('line')
    expect(r.points).toHaveLength(2)
  })

  it('detects a diagonal line', () => {
    const pts = jitteredLine(100, 100, 700, 600, 30, 3)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('line')
  })
})

describe('analyzeShape — rect', () => {
  it('detects a closed jittered square as rect with non-zero bbox', () => {
    const pts = jitteredSquare(400, 350, 200, 4)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('rect')
    expect(r.maxX - r.minX).toBeGreaterThan(0)
    expect(r.maxY - r.minY).toBeGreaterThan(0)
  })

  it('stores from/to bounding box coordinates', () => {
    const pts = jitteredSquare(500, 350, 160, 3)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('rect')
    expect(r.minX).toBeLessThan(r.maxX)
    expect(r.minY).toBeLessThan(r.maxY)
  })
})

describe('analyzeShape — ellipse', () => {
  it('detects a closed jittered circle as ellipse', () => {
    const pts = jitteredCircle(400, 350, 120, 48, 6)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('ellipse')
  })

  it('detects a clean closed circle as ellipse', () => {
    const pts = circle(400, 350, 150, 64)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('ellipse')
  })
})

describe('analyzeShape — arc', () => {
  it('detects a semi-circle as arc (spanAngle ≤ π)', () => {
    const pts = semicircle(400, 350, 150)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('arc')
    expect(r.points).toHaveLength(3)
  })

  it('arc result has exactly [start, mid, end] points', () => {
    const pts = semicircle(400, 350, 100)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('arc')
    expect(r.points[0]).toEqual(pts[0])
    expect(r.points[2]).toEqual(pts[pts.length - 1])
  })

  it('rejects arc > 180° (230°) and falls back to path (Bug #2)', () => {
    const pts = largeArc(400, 350, 150)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('path')
  })
})

describe('analyzeShape — path (zigzag)', () => {
  it('classifies a zigzag as path', () => {
    const r = analyzeShape(zigzag())
    expect(r.shapeType).toBe('path')
  })
})

describe('analyzeShape — nearly-complete circle → ellipse', () => {
  it('classifies a 300° arc as ellipse (> 270° → nearly-complete circle)', () => {
    const pts = nearlyCompleteArc(400, 350, 120)
    const r = analyzeShape(pts)
    expect(r.shapeType).toBe('ellipse')
  })
})

describe('analyzeShape — soft close rect', () => {
  it('detects unclosed rectangle with a 15% gap as rect', () => {
    // Draw 3.5 sides of a 200×160 rectangle (leave a 30px gap, diagonal ≈ 256)
    const pts: { x: number; y: number }[] = []
    // left side
    for (let y = 100; y <= 260; y += 5) pts.push({ x: 200, y })
    // bottom
    for (let x = 200; x <= 400; x += 5) pts.push({ x, y: 260 })
    // right side
    for (let y = 260; y >= 100; y -= 5) pts.push({ x: 400, y })
    // top — stop 30px short of start (gap/diagonal ≈ 11.7%, within SOFT_CLOSE_RATIO=25%)
    for (let x = 400; x >= 230; x -= 5) pts.push({ x, y: 100 })
    const r = analyzeShape(pts)
    // Soft-close triggers rect detection
    expect(r.shapeType).toBe('rect')
    expect(r.maxX - r.minX).toBeGreaterThan(50)
    expect(r.maxY - r.minY).toBeGreaterThan(50)
  })
})

describe('analyzeShape — 3-point implicit rect', () => {
  it('L-shape is NOT classified as arc (piecewise-linear, low curvature density)', () => {
    // L-shape: A(100,100)→B(300,100)→C(300,300) — two perpendicular segments
    const pts: { x: number; y: number }[] = []
    for (let x = 100; x <= 300; x += 5) pts.push({ x, y: 100 })
    for (let y = 100; y <= 300; y += 5) pts.push({ x: 300, y })
    const r = analyzeShape(pts)
    // Arc detection must be rejected for this piecewise-linear shape
    expect(r.shapeType).not.toBe('arc')
    expect(['rect', 'path', 'line']).toContain(r.shapeType)
  })
})

describe('svgArcPath', () => {
  it('generates a valid SVG arc path string', () => {
    const p0 = { x: 250, y: 350 }
    const pm = { x: 400, y: 200 }
    const p1 = { x: 550, y: 350 }
    const d = svgArcPath(p0, pm, p1)
    expect(d).toMatch(/^M \d/)
    expect(d).toContain(' A ')
  })

  it('falls back to a line if points are collinear', () => {
    const p0 = { x: 0, y: 0 }
    const pm = { x: 100, y: 0 }
    const p1 = { x: 200, y: 0 }
    const d = svgArcPath(p0, pm, p1)
    // circumscribedCircle returns null for collinear points → fallback to L
    expect(d).toContain(' L ')
  })
})

describe('analyzeShape — edge cases', () => {
  it('handles a single point', () => {
    const r = analyzeShape([{ x: 100, y: 100 }])
    expect(r.shapeType).toBe('line')
  })

  it('handles two points', () => {
    const r = analyzeShape([{ x: 0, y: 0 }, { x: 100, y: 100 }])
    expect(r.shapeType).toBe('line')
  })

  it('handles a tiny stroke (diagonal < 5px)', () => {
    const r = analyzeShape([{ x: 100, y: 100 }, { x: 102, y: 101 }, { x: 101, y: 103 }])
    expect(r.shapeType).toBe('line')
  })
})
