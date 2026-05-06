type Point = { x: number; y: number }

export interface ShapeResult {
  shapeType: 'rect' | 'ellipse' | 'line' | 'path' | 'arc'
  minX: number; minY: number; maxX: number; maxY: number
  /** Key points:
   *  line    — [start, end]
   *  arc     — [start, midpoint, end]
   *  others  — RDP-simplified outline
   */
  points: Point[]
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

// Rect: interior angles in [70°, 110°]  →  |cos| < 0.342
const RECT_ANGLE_COS    = 0.34
// Rect: opposite sides within ~20° of parallel  →  |sin| < 0.35
const RECT_PARALLEL     = 0.35
// Soft close: 25% of diagonal (user didn't quite close the shape)
const SOFT_CLOSE_RATIO  = 0.25
const SOFT_CLOSE_MIN    = 40           // px
// Minimum confidence to force-close as rect or ellipse
const SCORE_RECT_MIN    = 0.5
const SCORE_ELLIPSE_MIN = 0.4
// Nearly-complete circle: swept > 270° → force ellipse instead of arc
const ARC_SWEEP_ELLIPSE = Math.PI * 1.5

// ─── Entry point ──────────────────────────────────────────────────────────────

export function analyzeShape(raw: Point[]): ShapeResult {
  if (raw.length < 2) {
    const p = raw[0] ?? { x: 0, y: 0 }
    return { shapeType: 'line', minX: p.x, minY: p.y, maxX: p.x, maxY: p.y, points: [p, p] }
  }

  const xs = raw.map(p => p.x), ys = raw.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = maxX - minX, h = maxY - minY
  // diagonal is computed BEFORE any closure check (Bug #5)
  const diagonal = Math.sqrt(w * w + h * h)
  const bbox = { minX, minY, maxX, maxY }

  if (diagonal < 5) {
    return { shapeType: 'line', ...bbox, points: [raw[0], raw[raw.length - 1]] }
  }

  const first = raw[0], last = raw[raw.length - 1]
  const closureDist = Math.hypot(last.x - first.x, last.y - first.y)

  // Hard closure: endpoint within max(20px, 8% diagonal)
  const isClosed  = closureDist < Math.max(20, diagonal * 0.08)
  // Soft closure: user almost closed it — try both branches and pick best
  const softClose = !isClosed && closureDist < Math.max(SOFT_CLOSE_MIN, diagonal * SOFT_CLOSE_RATIO)

  // ── Open branch: line → nearly-complete circle → arc → soft-close → path ──
  if (!isClosed) {
    // 1. Straight line
    if (maxSegmentDeviation(raw, first, last) < 15) {
      return { shapeType: 'line', ...bbox, points: [first, last] }
    }

    // 2. Nearly-complete circle (gap < 90° between start and end ≡ arc > 270°) → ellipse.
    //    Guard: reject paths with sharp corners (rectangles, L-shapes, etc.)
    const kasaPts = evenlySpaced(raw, 20)
    if (kasaPts.length >= 6 && detectCorners(raw).length <= 2) {
      const circ = fitCircle(kasaPts)
      if (circ && circ.r >= 10 && circ.r <= 3000) {
        const meanErr = raw.reduce((s, p) =>
          s + Math.abs(Math.hypot(p.x - circ.cx, p.y - circ.cy) - circ.r), 0) / raw.length
        if (meanErr / circ.r < 0.22) {
          // Gap angle = min of the two arc spans between first and last point angles.
          // gap < π/2 (90°) means the stroke covers > 270° of the fitted circle.
          const aFirst = Math.atan2(raw[0].y - circ.cy, raw[0].x - circ.cx)
          const aLast  = Math.atan2(raw[raw.length - 1].y - circ.cy, raw[raw.length - 1].x - circ.cx)
          const cwSpan = ((aLast - aFirst) + 2 * Math.PI) % (2 * Math.PI)
          const gap    = Math.min(cwSpan, 2 * Math.PI - cwSpan)
          if (gap < Math.PI / 2) {   // arc covers > 270°
            return { shapeType: 'ellipse', ...bbox, points: rdp(raw, 20) }
          }
        }
      }
    }

    // 3. Arc (max half-circle)
    const arcPts = tryArcFit(raw)
    if (arcPts) return { shapeType: 'arc', ...bbox, points: arcPts }

    // 4. Soft close: score as rect or ellipse if confidence is high enough
    if (softClose) {
      const sRect    = scoreRect(raw)
      const sEllipse = scoreEllipse(raw)
      if (sRect >= SCORE_RECT_MIN && sRect >= sEllipse) {
        return { shapeType: 'rect', ...bbox, points: rdp(raw, 20) }
      }
      if (sEllipse >= SCORE_ELLIPSE_MIN) {
        return { shapeType: 'ellipse', ...bbox, points: rdp(raw, 20) }
      }
    }

    // 5. 3-point RDP → implicit rectangle (3 sides visible, 4th side missing)
    const simplified3 = rdp(raw, 20)
    if (simplified3.length === 3) {
      const angles = computeAnglesAt3Pts(simplified3)
      const rightAngles = angles.filter(a => Math.abs(a - 90) < 20).length
      if (rightAngles >= 2) {
        const [A, B, C] = simplified3
        const D = { x: A.x + C.x - B.x, y: A.y + C.y - B.y }
        const pts4 = [A, B, C, D]
        if (isRectLike(pts4)) {
          const xs4 = pts4.map(p => p.x), ys4 = pts4.map(p => p.y)
          return {
            shapeType: 'rect',
            minX: Math.min(...xs4), maxX: Math.max(...xs4),
            minY: Math.min(...ys4), maxY: Math.max(...ys4),
            points: pts4,
          }
        }
      }
    }

    // 6. Fallback: zigzag path
    return { shapeType: 'path', ...bbox, points: rdp(raw, 12) }
  }

  // ── Closed branch: rectangle → ellipse → path ─────────────────────────────

  // 1. Rectangle: try progressively coarser RDP until we get EXACTLY 4 corners.
  //    For closed strokes, RDP returns both endpoints (≈ same corner), giving n+1
  //    points — deduplicate when the first and last are closer than eps.
  //    Stop as soon as count === 4 (Bug #4: don't continue past first match).
  for (const eps of [15, 20, 25, 30, 40]) {
    let pts = rdp(raw, eps)
    // Deduplicate closed-path endpoints
    if (pts.length >= 2 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < eps * 1.5) {
      pts = pts.slice(0, -1)
    }
    if (pts.length === 4) {
      // Guard: 4 equidistant points on a circle also form right angles → isRectLike passes.
      // Only classify as rect when the raw stroke has actual sharp corners.
      // Use a robust corner detector (large window, strict threshold) so jitter on a
      // circle doesn't create false corners.
      if (isRectLike(pts) && hasRealSharpCorners(raw)) {
        return { shapeType: 'rect', ...bbox, points: pts }
      }
      break  // 4 corners but didn't pass rect — no point trying larger eps
    }
  }

  // 2. Ellipse: smooth closed curve with consistent radii
  if (isEllipseLike(raw)) {
    return { shapeType: 'ellipse', ...bbox, points: rdp(raw, 20) }
  }

  // 2b. Kasa-based ellipse fallback: for heavily jittered circles where detectCorners
  //     creates false corners (breaking isEllipseLike) but the Kasa fit is tight.
  //     Only fires when the stroke has no real sharp corners (i.e., not a rect).
  if (!hasRealSharpCorners(raw)) {
    const kasaPts = evenlySpaced(raw, 20)
    if (kasaPts.length >= 6) {
      const circ = fitCircle(kasaPts)
      if (circ && circ.r >= 10 && circ.r <= 3000) {
        const meanErr = raw.reduce((s, p) =>
          s + Math.abs(Math.hypot(p.x - circ.cx, p.y - circ.cy) - circ.r), 0) / raw.length
        if (meanErr / circ.r < 0.18) {
          return { shapeType: 'ellipse', ...bbox, points: rdp(raw, 20) }
        }
      }
    }
  }

  // 3. Fallback: closed freehand path
  return { shapeType: 'path', ...bbox, points: rdp(raw, 20) }
}

// ─── Shape validators ─────────────────────────────────────────────────────────

function isRectLike(pts: Point[]): boolean {
  // At least 3 of 4 interior angles in [70°, 110°]
  let rightAngles = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[(i + 3) % 4], b = pts[i], c = pts[(i + 1) % 4]
    const dx1 = a.x - b.x, dy1 = a.y - b.y
    const dx2 = c.x - b.x, dy2 = c.y - b.y
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2)
    if (l1 < 1 || l2 < 1) continue
    if (Math.abs((dx1 * dx2 + dy1 * dy2) / (l1 * l2)) < RECT_ANGLE_COS) rightAngles++
  }
  if (rightAngles < 3) return false

  // At least one pair of opposite sides roughly parallel
  return parallelPair(pts[0], pts[1], pts[2], pts[3])
      || parallelPair(pts[1], pts[2], pts[3], pts[0])
}

// Check if segment a→b is roughly parallel to segment c→d
function parallelPair(a: Point, b: Point, c: Point, d: Point): boolean {
  const dx1 = b.x - a.x, dy1 = b.y - a.y
  const dx2 = d.x - c.x, dy2 = d.y - c.y
  const cross = Math.abs(dx1 * dy2 - dy1 * dx2)
  const len   = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2)
  return len > 0 && cross / len < RECT_PARALLEL
}

function isEllipseLike(raw: Point[]): boolean {
  // Few sharp corners
  const corners = detectCorners(raw)
  if (corners.length > 2) return false

  // Distances from centroid should be consistent (low CV)
  const sampled = downsample(raw, 15)
  const cx = sampled.reduce((s, p) => s + p.x, 0) / sampled.length
  const cy = sampled.reduce((s, p) => s + p.y, 0) / sampled.length
  const dists = sampled.map(p => Math.hypot(p.x - cx, p.y - cy))
  const mean  = dists.reduce((s, d) => s + d, 0) / dists.length
  if (mean < 5) return false
  const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length
  return Math.sqrt(variance) / mean < 0.30
}

// ─── Confidence scoring (for soft-close disambiguation) ───────────────────────

function scoreRect(pts: Point[]): number {
  for (const eps of [15, 20, 25, 30, 40]) {
    let simplified = rdp(pts, eps)
    // If the path's endpoints are very close (open near-closed stroke), merge them
    if (simplified.length >= 2) {
      const first = simplified[0], last = simplified[simplified.length - 1]
      if (Math.hypot(first.x - last.x, first.y - last.y) < eps * 2) {
        simplified = simplified.slice(0, -1)
      }
    }
    if (simplified.length === 4) {
      const angleScore    = countRightAngles(simplified) / 4
      const parallelScore = (parallelPair(simplified[0], simplified[1], simplified[2], simplified[3]) ||
                             parallelPair(simplified[1], simplified[2], simplified[3], simplified[0])) ? 1 : 0
      return angleScore * 0.7 + parallelScore * 0.3
    }
  }
  return 0
}

function countRightAngles(pts: Point[]): number {
  let count = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[(i + 3) % 4], b = pts[i], c = pts[(i + 1) % 4]
    const dx1 = a.x - b.x, dy1 = a.y - b.y
    const dx2 = c.x - b.x, dy2 = c.y - b.y
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2)
    if (l1 < 1 || l2 < 1) continue
    if (Math.abs((dx1 * dx2 + dy1 * dy2) / (l1 * l2)) < RECT_ANGLE_COS) count++
  }
  return count
}

function scoreEllipse(pts: Point[]): number {
  const sampled = downsample(pts, 15)
  if (sampled.length < 4) return 0
  const cx = sampled.reduce((s, p) => s + p.x, 0) / sampled.length
  const cy = sampled.reduce((s, p) => s + p.y, 0) / sampled.length
  const dists = sampled.map(p => Math.hypot(p.x - cx, p.y - cy))
  const mean  = dists.reduce((s, d) => s + d, 0) / dists.length
  if (mean < 5) return 0
  const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length
  const cv = Math.sqrt(variance) / mean
  if (cv > 0.45) return 0
  return 1 - (cv / 0.45)
}

// ─── Corner detectors ─────────────────────────────────────────────────────────

// Robust check used to guard rect detection: requires REAL sharp corners (≥ 3 of 4 rect corners).
// Uses a wider window and stricter threshold than detectCorners to be immune to stroke jitter,
// so a jittered freehand circle with false local direction-changes is not mistaken for a rect.
function hasRealSharpCorners(raw: Point[]): boolean {
  const sampled = downsample(raw, 12)
  const n = sampled.length
  if (n < 7) return false

  // n/8 caps each WINDOW span at ~45° of arc on a circle, preventing small circles
  // (where n/5 would span ~72°–90°) from generating false 81°-threshold corners.
  const WINDOW    = Math.max(2, Math.min(6, Math.floor(n / 8)))
  const THRESHOLD = Math.PI * 0.45   // ~81° — immune to circle jitter, catches rect/L-shape corners
  const MIN_GAP   = 25

  let cornerCount = 0
  let lastCorner  = { x: -Infinity, y: -Infinity }

  for (let i = WINDOW; i < n - WINDOW; i++) {
    const dx1 = sampled[i].x - sampled[i - WINDOW].x
    const dy1 = sampled[i].y - sampled[i - WINDOW].y
    const dx2 = sampled[i + WINDOW].x - sampled[i].x
    const dy2 = sampled[i + WINDOW].y - sampled[i].y
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2)
    if (l1 < 1 || l2 < 1) continue
    const cos = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (l1 * l2)))
    if (Math.acos(cos) > THRESHOLD &&
        Math.hypot(sampled[i].x - lastCorner.x, sampled[i].y - lastCorner.y) > MIN_GAP) {
      cornerCount++
      lastCorner = sampled[i]
    }
  }
  return cornerCount >= 2   // at least 2 real sharp corners → likely a rect, not a circle
}

function detectCorners(raw: Point[]): Point[] {
  const sampled = downsample(raw, 12)
  const n = sampled.length
  if (n < 5) return sampled

  const WINDOW    = Math.max(2, Math.min(3, Math.floor(n / 6)))
  const THRESHOLD = Math.PI * 0.28   // ~50° direction change
  const MIN_GAP   = 25               // px between distinct corners

  const corners: Point[] = []
  let lastCorner = { x: -Infinity, y: -Infinity }

  for (let i = WINDOW; i < n - WINDOW; i++) {
    const dx1 = sampled[i].x - sampled[i - WINDOW].x
    const dy1 = sampled[i].y - sampled[i - WINDOW].y
    const dx2 = sampled[i + WINDOW].x - sampled[i].x
    const dy2 = sampled[i + WINDOW].y - sampled[i].y
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2)
    if (l1 < 1 || l2 < 1) continue
    const cos = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (l1 * l2)))
    if (Math.acos(cos) > THRESHOLD &&
        Math.hypot(sampled[i].x - lastCorner.x, sampled[i].y - lastCorner.y) > MIN_GAP) {
      corners.push(sampled[i])
      lastCorner = sampled[i]
    }
  }
  return corners
}

// ─── Arc fitting ──────────────────────────────────────────────────────────────

function tryArcFit(raw: Point[]): Point[] | null {
  if (raw.length < 8) return null
  const pts = evenlySpaced(raw, 20)
  if (pts.length < 6) return null

  const circ = fitCircle(pts)
  if (!circ || circ.r < 10 || circ.r > 3000) return null

  // Mean radial error < 22% of radius
  const meanErr = pts.reduce((s, p) =>
    s + Math.abs(Math.hypot(p.x - circ.cx, p.y - circ.cy) - circ.r), 0) / pts.length
  if (meanErr / circ.r > 0.22) return null

  // Curvature sign consistency ≥ 70%
  // Only count triplets where |cross| > 1e-6 to avoid collinear noise (Bug #6)
  const sampled = downsample(raw, 8)
  let pos = 0, neg = 0
  for (let i = 1; i < sampled.length - 1; i++) {
    const dx1 = sampled[i].x - sampled[i-1].x, dy1 = sampled[i].y - sampled[i-1].y
    const dx2 = sampled[i+1].x - sampled[i].x, dy2 = sampled[i+1].y - sampled[i].y
    const cross = dx1 * dy2 - dy1 * dx2
    if (cross > 1e-6) pos++; else if (cross < -1e-6) neg++
  }
  const total = pos + neg
  if (total === 0 || Math.max(pos, neg) / total < 0.70) return null
  // Require sufficient curvature density — rejects L-shapes and other piecewise-linear paths
  // that have only 1-2 triplets with meaningful cross product
  if (total < Math.max(3, Math.floor((sampled.length - 2) * 0.25))) return null

  // ⚠️ CRITICAL: reject arcs that span more than a half-circle (Bug #2)
  const mid = raw[Math.floor(raw.length / 2)]
  const { cx, cy } = circ
  const a0     = Math.atan2(raw[0].y - cy, raw[0].x - cx)
  const am     = Math.atan2(mid.y - cy, mid.x - cx)
  const a1     = Math.atan2(raw[raw.length - 1].y - cy, raw[raw.length - 1].x - cx)
  const span01 = ((a1 - a0) + 2 * Math.PI) % (2 * Math.PI)  // CW span p0→p1
  const span0m = ((am - a0) + 2 * Math.PI) % (2 * Math.PI)  // CW span p0→pm
  // Determine actual traversal direction: is pm on the CW or CCW arc?
  const spanAngle = span0m < span01 ? span01 : (2 * Math.PI - span01)
  if (spanAngle > Math.PI) return null

  return [raw[0], mid, raw[raw.length - 1]]
}

// Kasa algebraic circle fit (numerically stable via centroid shift)
function fitCircle(pts: Point[]): { cx: number; cy: number; r: number } | null {
  const n  = pts.length
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  const ps = pts.map(p => ({ x: p.x - mx, y: p.y - my }))

  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0
  for (const { x, y } of ps) {
    Suu += x*x; Svv += y*y; Suv += x*y
    Suuu += x*x*x; Svvv += y*y*y; Suvv += x*y*y; Svuu += y*x*x
  }
  const rhs1 = Suuu + Suvv, rhs2 = Svvv + Svuu
  const det  = 4 * (Suu * Svv - Suv * Suv)
  // det is always ≥ 0 (Cauchy-Schwarz); reject if degenerate (Bug #3)
  if (det < 1e-8) return null
  const uc = (2 * Svv * rhs1 - 2 * Suv * rhs2) / det
  const vc = (2 * Suu * rhs2 - 2 * Suv * rhs1) / det
  const r  = Math.sqrt(uc*uc + vc*vc + (Suu + Svv) / n)
  if (!isFinite(r) || r <= 0) return null
  return { cx: uc + mx, cy: vc + my, r }
}

// ─── SVG arc path — exported for rendering ────────────────────────────────────

export function svgArcPath(p0: Point, pm: Point, p1: Point): string {
  const circ = circumscribedCircle(p0, pm, p1)
  if (!circ) return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`
  const { cx, cy, r } = circ

  const a0 = Math.atan2(p0.y - cy, p0.x - cx)
  const am = Math.atan2(pm.y - cy, pm.x - cx)
  const a1 = Math.atan2(p1.y - cy, p1.x - cx)

  // Angular spans in the "increasing angle" direction (CW in SVG Y-down coords)
  const span01 = ((a1 - a0) + 2 * Math.PI) % (2 * Math.PI)
  const span0m = ((am - a0) + 2 * Math.PI) % (2 * Math.PI)

  const rx = Math.round(r * 100) / 100
  const ex = Math.round(p1.x * 100) / 100
  const ey = Math.round(p1.y * 100) / 100

  if (span0m < span01) {
    // pm on CW arc → sweep=1
    return `M ${p0.x} ${p0.y} A ${rx} ${rx} 0 ${span01 > Math.PI ? 1 : 0} 1 ${ex} ${ey}`
  } else {
    // pm on CCW arc → sweep=0; CCW span = 2π - span01
    return `M ${p0.x} ${p0.y} A ${rx} ${rx} 0 ${span01 < Math.PI ? 1 : 0} 0 ${ex} ${ey}`
  }
}

// Canvas arc — exported for renderToCanvas
export function canvasArcPath(
  ctx: CanvasRenderingContext2D,
  p0: Point, pm: Point, p1: Point,
): void {
  const circ = circumscribedCircle(p0, pm, p1)
  if (!circ) { ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); return }
  const { cx, cy, r } = circ
  const a0    = Math.atan2(p0.y - cy, p0.x - cx)
  const am    = Math.atan2(pm.y - cy, pm.x - cx)
  const a1    = Math.atan2(p1.y - cy, p1.x - cx)
  const span01 = ((a1 - a0) + 2 * Math.PI) % (2 * Math.PI)
  const span0m = ((am - a0) + 2 * Math.PI) % (2 * Math.PI)
  ctx.arc(cx, cy, r, a0, a1, span0m >= span01)  // ccw = true when pm on CCW arc
}

function circumscribedCircle(p1: Point, p2: Point, p3: Point): { cx: number; cy: number; r: number } | null {
  const ax = p2.x - p1.x, ay = p2.y - p1.y
  const bx = p3.x - p1.x, by = p3.y - p1.y
  const D  = 2 * (ax * by - ay * bx)
  if (Math.abs(D) < 1e-10) return null
  const ux = (by * (ax*ax + ay*ay) - ay * (bx*bx + by*by)) / D
  const uy = (ax * (bx*bx + by*by) - bx * (ax*ax + ay*ay)) / D
  return { cx: p1.x + ux, cy: p1.y + uy, r: Math.hypot(ux, uy) }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rdp(pts: Point[], eps: number): Point[] {
  if (pts.length <= 2) return [...pts]
  const start = pts[0], end = pts[pts.length - 1]
  let maxDist = 0, maxIdx = 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptSegDist(pts[i], start, end)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > eps) {
    const left  = rdp(pts.slice(0, maxIdx + 1), eps)
    const right = rdp(pts.slice(maxIdx), eps)
    return [...left.slice(0, -1), ...right]
  }
  return [start, end]
}

function ptSegDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx*dx + dy*dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq))
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy))
}

function maxSegmentDeviation(pts: Point[], a: Point, b: Point): number {
  return Math.max(...pts.map(p => ptSegDist(p, a, b)))
}

function downsample(pts: Point[], minDist: number): Point[] {
  if (pts.length === 0) return []
  const result = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], last = result[result.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) result.push(p)
  }
  return result
}

function evenlySpaced(pts: Point[], n: number): Point[] {
  if (pts.length <= n) return pts
  const result: Point[] = []
  for (let i = 0; i < n; i++) {
    result.push(pts[Math.round((i / (n - 1)) * (pts.length - 1))])
  }
  return result
}

// Returns interior angles in degrees at each of the 3 points
function computeAnglesAt3Pts(pts: Point[]): number[] {
  const computeAngle = (center: Point, p1: Point, p2: Point): number => {
    const dx1 = p1.x - center.x, dy1 = p1.y - center.y
    const dx2 = p2.x - center.x, dy2 = p2.y - center.y
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2)
    if (l1 < 1 || l2 < 1) return 0
    const cos = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (l1 * l2)))
    return (Math.acos(cos) * 180) / Math.PI
  }
  const [A, B, C] = pts
  return [
    computeAngle(A, B, C),
    computeAngle(B, A, C),
    computeAngle(C, A, B),
  ]
}
