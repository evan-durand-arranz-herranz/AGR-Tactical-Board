import type { Frame, Player, Position } from '../types'
import { easeInOut } from './fieldGeometry'

export const EXPORT_W = 1920
export const EXPORT_H = 1080

// ── Full-field (viewBox "-130 -5 1270 720") ───────────────────────────────────
const VB  = { minX: -130, minY: -5, w: 1270, h: 720 }
const SX  = EXPORT_W / VB.w
const SY  = EXPORT_H / VB.h

const F = {
  leftIngoal: 0, leftTry: 100, left10: 180, left22: 276, left40: 420,
  halfway: 500,
  right40: 580, right22: 724, right10: 820, rightTry: 900, rightIngoal: 1000,
  top: 0, bot: 700,
  fiveTop: 50, fiveBot: 650, fifteen_top: 150, fifteen_bot: 550,
  mid: 350, POST: 56,
}

// ── Half-field (viewBox "-5 -10 715 630") ────────────────────────────────────
const VBH = { minX: -5, minY: -10, w: 715, h: 630 }
// Preserve aspect ratio (meet) — same logic as SVG preserveAspectRatio
const SH  = Math.min(EXPORT_W / VBH.w, EXPORT_H / VBH.h)
const txH = (EXPORT_W - VBH.w * SH) / 2 + (-VBH.minX) * SH
const tyH = (EXPORT_H - VBH.h * SH) / 2 + (-VBH.minY) * SH

const H = {
  w: 700, tryY: 120, y10: 216, y22: 331, y40: 504, halfY: 600,
  five_l: 50, five_r: 650, fifteen_l: 150, fifteen_r: 550, midX: 350, postH: 28,
}

function setupTransform(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(SX, 0, 0, SY, -VB.minX * SX, -VB.minY * SY)
}
function setupHalfTransform(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(SH, 0, 0, SH, txH, tyH)
}

function normToSVG(pos: Position) {
  return { x: pos.x / 100 * 1000, y: pos.y / 100 * 700 }
}
function normToHalfSVG(pos: Position) {
  return { x: (pos.y / 100) * H.w, y: (pos.x / 50) * H.halfY }
}

function ln(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}

function drawHalfFieldLines(ctx: CanvasRenderingContext2D) {
  const LINE = 'rgba(255,255,255,0.88)'
  const LW   = 1.8

  ctx.fillStyle = '#2e5520'
  ctx.fillRect(0, 0, H.w, H.tryY)
  ctx.fillStyle = '#4a7c3f'
  ctx.fillRect(0, H.tryY, H.w, H.halfY - H.tryY)

  ctx.strokeStyle = LINE; ctx.setLineDash([]); ctx.globalAlpha = 1

  // Border
  ctx.lineWidth = LW
  ln(ctx, 0, 0, 0, H.halfY)
  ln(ctx, H.w, 0, H.w, H.halfY)
  ln(ctx, 0, 0, H.w, 0)

  ctx.lineWidth = 2.5; ln(ctx, 0, H.tryY, H.w, H.tryY)
  ctx.lineWidth = LW
  ln(ctx, 0, H.y10, H.w, H.y10)
  ln(ctx, 0, H.y22, H.w, H.y22)

  ctx.setLineDash([12, 6])
  ln(ctx, 0, H.y40, H.w, H.y40)
  ln(ctx, 0, H.halfY, H.w, H.halfY)
  ctx.setLineDash([])

  ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.setLineDash([8, 5])
  ln(ctx, H.five_l, H.tryY, H.five_l, H.halfY)
  ln(ctx, H.five_r, H.tryY, H.five_r, H.halfY)
  ctx.globalAlpha = 0.5
  ln(ctx, H.fifteen_l, H.tryY, H.fifteen_l, H.halfY)
  ln(ctx, H.fifteen_r, H.tryY, H.fifteen_r, H.halfY)
  ctx.setLineDash([]); ctx.globalAlpha = 1

  // Posts
  ctx.lineWidth = 2.5
  ln(ctx, H.midX - H.postH, H.tryY, H.midX - H.postH, H.tryY - 38)
  ln(ctx, H.midX + H.postH, H.tryY, H.midX + H.postH, H.tryY - 38)
  ln(ctx, H.midX - H.postH, H.tryY - 38, H.midX + H.postH, H.tryY - 38)
}

export async function ensureFonts(): Promise<void> {
  await document.fonts.ready
}

export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  players: Player[],
  opts: { label?: string; comboName?: string; fieldView?: 'full' | 'half' } = {}
) {
  const isHalf = opts.fieldView === 'half'

  // ── Background ────────────────────────────────────────────────────────────
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0a0d14'
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)

  if (isHalf) {
    // ── Demi-terrain ─────────────────────────────────────────────────────
    setupHalfTransform(ctx)
    drawHalfFieldLines(ctx)

    const toSVG = normToHalfSVG

    for (const ev of frame.events) {
      if (!ev.from || !ev.to) continue
      const { x: fx, y: fy } = toSVG(ev.from)
      const { x: tx, y: ty } = toSVG(ev.to)
      const angle = Math.atan2(ty - fy, tx - fx)
      ctx.strokeStyle = ev.color || '#ffffff'
      ctx.lineWidth = 2.5; ctx.setLineDash([])
      ln(ctx, fx, fy, tx, ty)
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(tx - 14 * Math.cos(angle - 0.4), ty - 14 * Math.sin(angle - 0.4))
      ctx.lineTo(tx - 14 * Math.cos(angle + 0.4), ty - 14 * Math.sin(angle + 0.4))
      ctx.closePath(); ctx.fillStyle = ev.color || '#ffffff'; ctx.fill()
    }

    for (const player of players) {
      const pos = frame.positions[player.id]
      if (!pos || pos.x < -3 || pos.x > 55) continue
      const { x: cx, y: cy } = toSVG(pos)
      ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2)
      ctx.fillStyle = player.team === 'AGR' ? '#dc2626' : '#f0f0f0'
      ctx.fill()
      ctx.strokeStyle = player.team === 'AGR' ? '#991b1b' : '#444444'
      ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke()
      ctx.fillStyle = player.team === 'AGR' ? '#ffffff' : '#111111'
      ctx.font = '700 13px "Rajdhani", sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(player.number), cx, cy + 0.5)
    }

    if (frame.ballPosition && frame.ballPosition.x <= 55) {
      const { x: bx, y: by } = toSVG(frame.ballPosition)
      ctx.beginPath(); ctx.ellipse(bx, by, 14, 9, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#c8860a'; ctx.fill()
      ctx.strokeStyle = '#7c5410'; ctx.lineWidth = 1.5; ctx.stroke()
    }
  } else {
    // ── Terrain complet ────────────────────────────────────────────────────
    setupTransform(ctx)

    ctx.fillStyle = '#2e5520'
    ctx.fillRect(F.leftIngoal, F.top, F.leftTry,                  F.bot)
    ctx.fillRect(F.rightTry,   F.top, F.rightIngoal - F.rightTry, F.bot)
    ctx.fillStyle = '#4a7c3f'
    ctx.fillRect(F.leftTry, F.top, F.rightTry - F.leftTry, F.bot)

    const LINE = 'rgba(255,255,255,0.88)'
    ctx.strokeStyle = LINE; ctx.setLineDash([]); ctx.lineWidth = 1.8
    ctx.strokeRect(F.leftIngoal, F.top, F.rightIngoal, F.bot)

    ctx.lineWidth = 2.5
    ln(ctx, F.leftTry,  F.top, F.leftTry,  F.bot)
    ln(ctx, F.rightTry, F.top, F.rightTry, F.bot)

    ctx.lineWidth = 1.8
    for (const x of [F.left10, F.left22, F.right22, F.right10, F.halfway])
      ln(ctx, x, F.top, x, F.bot)

    ctx.setLineDash([12, 6])
    ln(ctx, F.left40,  F.top, F.left40,  F.bot)
    ln(ctx, F.right40, F.top, F.right40, F.bot)
    ctx.setLineDash([])

    ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.setLineDash([8, 5])
    ln(ctx, F.leftTry, F.fiveTop,     F.rightTry, F.fiveTop)
    ln(ctx, F.leftTry, F.fiveBot,     F.rightTry, F.fiveBot)
    ctx.globalAlpha = 0.5
    ln(ctx, F.leftTry, F.fifteen_top, F.rightTry, F.fifteen_top)
    ln(ctx, F.leftTry, F.fifteen_bot, F.rightTry, F.fifteen_bot)
    ctx.setLineDash([]); ctx.globalAlpha = 1

    ctx.lineWidth = 2
    ln(ctx, F.halfway - 13, F.mid, F.halfway + 13, F.mid)
    ln(ctx, F.halfway, F.mid - 13, F.halfway, F.mid + 13)

    ctx.lineWidth = 2.5
    const ph = F.POST / 2
    ln(ctx, F.leftTry - 42, F.mid - ph, F.leftTry - 42, F.mid + ph)
    ln(ctx, F.leftTry - 42, F.mid - ph, F.leftTry,       F.mid - ph)
    ln(ctx, F.leftTry - 42, F.mid + ph, F.leftTry,       F.mid + ph)
    ln(ctx, F.rightTry + 42, F.mid - ph, F.rightTry + 42, F.mid + ph)
    ln(ctx, F.rightTry,       F.mid - ph, F.rightTry + 42, F.mid - ph)
    ln(ctx, F.rightTry,       F.mid + ph, F.rightTry + 42, F.mid + ph)

    for (const ev of frame.events) {
      if (!ev.from || !ev.to) continue
      const { x: fx, y: fy } = normToSVG(ev.from)
      const { x: tx, y: ty } = normToSVG(ev.to)
      const angle = Math.atan2(ty - fy, tx - fx)
      ctx.strokeStyle = ev.color || '#ffffff'
      ctx.lineWidth = 2.5; ctx.setLineDash([])
      ln(ctx, fx, fy, tx, ty)
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(tx - 14 * Math.cos(angle - 0.4), ty - 14 * Math.sin(angle - 0.4))
      ctx.lineTo(tx - 14 * Math.cos(angle + 0.4), ty - 14 * Math.sin(angle + 0.4))
      ctx.closePath(); ctx.fillStyle = ev.color || '#ffffff'; ctx.fill()
    }

    for (const player of players) {
      const pos = frame.positions[player.id]
      if (!pos || pos.x < -3 || pos.x > 103) continue
      const { x: cx, y: cy } = normToSVG(pos)
      ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2)
      ctx.fillStyle = player.team === 'AGR' ? '#dc2626' : '#f0f0f0'
      ctx.fill()
      ctx.strokeStyle = player.team === 'AGR' ? '#991b1b' : '#444444'
      ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke()
      ctx.fillStyle = player.team === 'AGR' ? '#ffffff' : '#111111'
      ctx.font = '700 13px "Rajdhani", sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(player.number), cx, cy + 0.5)
    }

    if (frame.ballPosition) {
      const { x: bx, y: by } = normToSVG(frame.ballPosition)
      ctx.beginPath(); ctx.ellipse(bx, by, 14, 9, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#c8860a'; ctx.fill()
      ctx.strokeStyle = '#7c5410'; ctx.lineWidth = 1.5; ctx.stroke()
    }
  }

  ctx.restore()

  // ── Label overlay (in pixel space) ────────────────────────────────────────
  if (opts.label || opts.comboName) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, EXPORT_W, 54)
    const text = [opts.comboName, opts.label].filter(Boolean).join('  ·  ')
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 22px "Rajdhani", sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 24, 27)
  }
}

function quadBezier(p0: Position, p1: Position, p2: Position, t: number): Position {
  const u = 1 - t
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y }
}

function interpolateAlongPath(
  p0: Position, p1: Position, p2: Position, p3: Position, t: number
): Position {
  const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y)
  const total = d01 + d12 + d23
  if (total < 0.001) return { x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t }
  const tDist = t * total
  if (tDist <= d01) {
    const s = d01 > 0 ? tDist / d01 : 0
    return { x: p0.x + s * (p1.x - p0.x), y: p0.y + s * (p1.y - p0.y) }
  } else if (tDist <= d01 + d12) {
    const s = d12 > 0 ? (tDist - d01) / d12 : 0
    return { x: p1.x + s * (p2.x - p1.x), y: p1.y + s * (p2.y - p1.y) }
  } else {
    const s = d23 > 0 ? (tDist - d01 - d12) / d23 : 0
    return { x: p2.x + s * (p3.x - p2.x), y: p2.y + s * (p3.y - p2.y) }
  }
}

export function renderInterpolatedToCanvas(
  ctx: CanvasRenderingContext2D,
  fromFrame: Frame,
  toFrame: Frame,
  players: Player[],
  t: number,
  opts: { comboName?: string; fieldView?: 'full' | 'half' } = {}
) {
  const positions: Record<string, Position> = {}
  const waypoints = toFrame.waypoints

  for (const p of players) {
    const from = fromFrame.positions[p.id]
    const to   = toFrame.positions[p.id]
    if (from && to) {
      const wps = waypoints?.[p.id]
      if (wps) {
        const dx = to.x - from.x, dy = to.y - from.y
        const wp0 = wps[0] ?? { x: from.x + dx / 3, y: from.y + dy / 3 }
        const wp1 = wps[1] ?? { x: from.x + 2 * dx / 3, y: from.y + 2 * dy / 3 }
        positions[p.id] = interpolateAlongPath(from, wp0, wp1, to, t)
      } else {
        positions[p.id] = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      }
    } else if (from) {
      positions[p.id] = from
    }
  }

  const fromBall = fromFrame.ballPosition
  const toBall   = toFrame.ballPosition
  let ballPosition: Position | undefined
  if (fromBall && toBall) {
    if (toFrame.ballWaypoint) {
      ballPosition = quadBezier(fromBall, toFrame.ballWaypoint, toBall, t)
    } else {
      let carrierId: string | null = null
      let minDistSq = 16
      for (const p of players) {
        const fp = fromFrame.positions[p.id]
        if (!fp) continue
        const dx = fromBall.x - fp.x, dy = fromBall.y - fp.y
        const dsq = dx * dx + dy * dy
        if (dsq < minDistSq) { minDistSq = dsq; carrierId = p.id }
      }
      const carrierWps = carrierId ? toFrame.waypoints?.[carrierId] : null
      const fromCarrier = carrierId ? fromFrame.positions[carrierId] : null
      const toCarrier   = carrierId ? toFrame.positions[carrierId] : null
      if (carrierWps && fromCarrier && toCarrier) {
        const ip = interpolateAlongPath(fromCarrier, carrierWps[0], carrierWps[1], toCarrier, t)
        ballPosition = { x: ip.x + (fromBall.x - fromCarrier.x), y: ip.y + (fromBall.y - fromCarrier.y) }
      } else {
        ballPosition = { x: fromBall.x + (toBall.x - fromBall.x) * t, y: fromBall.y + (toBall.y - fromBall.y) * t }
      }
    }
  } else {
    ballPosition = fromBall
  }

  renderFrameToCanvas(ctx, { ...fromFrame, positions, ballPosition, events: toFrame.events }, players, {
    label: toFrame.label, comboName: opts.comboName, fieldView: opts.fieldView,
  })
}

// Re-export for video use
export { easeInOut }
