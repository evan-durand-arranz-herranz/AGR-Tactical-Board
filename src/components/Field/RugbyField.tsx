import React, { forwardRef, useRef, useCallback } from 'react'
import { FIELD } from '../../types'
import type { Frame, Player, FieldView, Position, FieldEvent } from '../../types'

// Stable reference to avoid infinite re-renders when hiddenPlayerIds is undefined
const EMPTY_HIDDEN: string[] = []
import { clampPosition, fromSVG } from '../../utils/fieldGeometry'
import { analyzeShape, svgArcPath } from '../../utils/shapeAnalysis'
import { useTacticalStore } from '../../store/tacticalStore'
import { useUIStore } from '../../store/uiStore'
import PlayerToken from './PlayerToken'

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN COMPLET (paysage) — 1000 × 700 SVG units
// ═══════════════════════════════════════════════════════════════════════════════

const F = {
  leftIngoal:   0,
  leftTry:      100,
  left10:       180,
  left22:       276,
  left40:       420,
  halfway:      500,
  right40:      580,
  right22:      724,
  right10:      820,
  rightTry:     900,
  rightIngoal:  1000,
  top:          0,
  bot:          700,
  fiveTop:      50,
  fiveBot:      650,
  fifteen_top:  150,
  fifteen_bot:  550,
  mid:          350,
  POST:         56,
} as const

const LINE = 'rgba(255,255,255,0.88)'
const LW   = 1.8

function FullFieldLines() {
  const half   = F.POST / 2
  const vLines = [F.leftTry, F.left10, F.left22, F.left40, F.halfway, F.right40, F.right22, F.right10, F.rightTry]
  const hLines = [F.fiveTop, F.fifteen_top, F.fifteen_bot, F.fiveBot]
  return (
    <g stroke={LINE} fill="none">
      <rect x={F.leftIngoal} y={F.top} width={F.rightIngoal} height={700} strokeWidth={LW} />
      <line x1={F.leftTry}  y1={F.top} x2={F.leftTry}  y2={F.bot} strokeWidth={2.5} />
      <line x1={F.rightTry} y1={F.top} x2={F.rightTry} y2={F.bot} strokeWidth={2.5} />
      <line x1={F.left10}  y1={F.top} x2={F.left10}  y2={F.bot} strokeWidth={LW} />
      <line x1={F.right10} y1={F.top} x2={F.right10} y2={F.bot} strokeWidth={LW} />
      <line x1={F.left22}  y1={F.top} x2={F.left22}  y2={F.bot} strokeWidth={LW} />
      <line x1={F.right22} y1={F.top} x2={F.right22} y2={F.bot} strokeWidth={LW} />
      <line x1={F.left40}  y1={F.top} x2={F.left40}  y2={F.bot} strokeWidth={LW} strokeDasharray="12 6" />
      <line x1={F.right40} y1={F.top} x2={F.right40} y2={F.bot} strokeWidth={LW} strokeDasharray="12 6" />
      <line x1={F.halfway} y1={F.top} x2={F.halfway} y2={F.bot} strokeWidth={LW} />
      <line x1={F.leftTry} y1={F.fiveTop} x2={F.rightTry} y2={F.fiveTop} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.6} />
      <line x1={F.leftTry} y1={F.fiveBot} x2={F.rightTry} y2={F.fiveBot} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.6} />
      <line x1={F.leftTry} y1={F.fifteen_top} x2={F.rightTry} y2={F.fifteen_top} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.5} />
      <line x1={F.leftTry} y1={F.fifteen_bot} x2={F.rightTry} y2={F.fifteen_bot} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.5} />
      {vLines.map(x => hLines.map(y => (
        <React.Fragment key={`c-${x}-${y}`}>
          <line x1={x - 7} y1={y} x2={x + 7} y2={y} strokeWidth={1.2} strokeOpacity={0.65} />
          <line x1={x} y1={y - 7} x2={x} y2={y + 7} strokeWidth={1.2} strokeOpacity={0.65} />
        </React.Fragment>
      )))}
      <line x1={F.halfway - 13} y1={F.mid} x2={F.halfway + 13} y2={F.mid} strokeWidth={2} />
      <line x1={F.halfway} y1={F.mid - 13} x2={F.halfway} y2={F.mid + 13} strokeWidth={2} />
      <circle cx={F.leftTry  + 14} cy={F.mid} r={3.5} fill={LINE} stroke="none" />
      <circle cx={F.rightTry - 14} cy={F.mid} r={3.5} fill={LINE} stroke="none" />
      <g opacity={0.8}>
        <line x1={F.leftTry - 42} y1={F.mid - half} x2={F.leftTry - 42} y2={F.mid + half} strokeWidth={2.5} />
        <line x1={F.leftTry - 42} y1={F.mid - half} x2={F.leftTry}       y2={F.mid - half} strokeWidth={2.5} />
        <line x1={F.leftTry - 42} y1={F.mid + half} x2={F.leftTry}       y2={F.mid + half} strokeWidth={2.5} />
      </g>
      <g opacity={0.8}>
        <line x1={F.rightTry + 42} y1={F.mid - half} x2={F.rightTry + 42} y2={F.mid + half} strokeWidth={2.5} />
        <line x1={F.rightTry}       y1={F.mid - half} x2={F.rightTry + 42} y2={F.mid - half} strokeWidth={2.5} />
        <line x1={F.rightTry}       y1={F.mid + half} x2={F.rightTry + 42} y2={F.mid + half} strokeWidth={2.5} />
      </g>
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMI-TERRAIN (portrait) — 700 × 620 SVG units
// ═══════════════════════════════════════════════════════════════════════════════

const H = {
  w: 700, tryY: 120, y10: 216, y22: 331, y40: 504, halfY: 600,
  leftX: 0, rightX: 700, five_l: 50, five_r: 650,
  fifteen_l: 150, fifteen_r: 550, midX: 350, postH: 28,
  viewBox: '-5 -10 715 630',
} as const

function HalfFieldLines() {
  const hLines = [H.tryY, H.y10, H.y22, H.y40, H.halfY]
  const vLines = [H.five_l, H.fifteen_l, H.fifteen_r, H.five_r]
  return (
    <g stroke={LINE} fill="none">
      <line x1={H.leftX} y1={0} x2={H.rightX} y2={0} strokeWidth={1.5} />
      <line x1={H.leftX}  y1={0} x2={H.leftX}  y2={H.halfY} strokeWidth={LW} />
      <line x1={H.rightX} y1={0} x2={H.rightX} y2={H.halfY} strokeWidth={LW} />
      <line x1={H.leftX} y1={H.tryY} x2={H.rightX} y2={H.tryY} strokeWidth={2.5} />
      <line x1={H.leftX} y1={H.y10}   x2={H.rightX} y2={H.y10}   strokeWidth={LW} />
      <line x1={H.leftX} y1={H.y22}   x2={H.rightX} y2={H.y22}   strokeWidth={LW} />
      <line x1={H.leftX} y1={H.y40}   x2={H.rightX} y2={H.y40}   strokeWidth={LW} strokeDasharray="12 6" />
      <line x1={H.leftX} y1={H.halfY} x2={H.rightX} y2={H.halfY} strokeWidth={LW} strokeDasharray="12 6" />
      <line x1={H.five_l}    y1={H.tryY} x2={H.five_l}    y2={H.halfY} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.6} />
      <line x1={H.five_r}    y1={H.tryY} x2={H.five_r}    y2={H.halfY} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.6} />
      <line x1={H.fifteen_l} y1={H.tryY} x2={H.fifteen_l} y2={H.halfY} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.5} />
      <line x1={H.fifteen_r} y1={H.tryY} x2={H.fifteen_r} y2={H.halfY} strokeWidth={1} strokeDasharray="8 5" strokeOpacity={0.5} />
      {vLines.map(x => hLines.map(y => (
        <React.Fragment key={`c-${x}-${y}`}>
          <line x1={x - 7} y1={y} x2={x + 7} y2={y} strokeWidth={1.2} strokeOpacity={0.65} />
          <line x1={x} y1={y - 7} x2={x} y2={y + 7} strokeWidth={1.2} strokeOpacity={0.65} />
        </React.Fragment>
      )))}
      {hLines.map(y => (
        <React.Fragment key={`hash-${y}`}>
          <line x1={H.leftX}  y1={y} x2={H.leftX  + 12} y2={y} strokeWidth={1.5} />
          <line x1={H.rightX} y1={y} x2={H.rightX - 12} y2={y} strokeWidth={1.5} />
        </React.Fragment>
      ))}
      <line x1={H.midX - 16} y1={H.halfY} x2={H.midX -  6} y2={H.halfY} strokeWidth={2.5} />
      <line x1={H.midX +  6} y1={H.halfY} x2={H.midX + 16} y2={H.halfY} strokeWidth={2.5} />
      <circle cx={H.midX} cy={H.tryY + 14} r={3.5} fill={LINE} stroke="none" />
      <g opacity={0.8}>
        <line x1={H.midX - H.postH} y1={H.tryY}      x2={H.midX - H.postH} y2={H.tryY - 38} strokeWidth={2.5} />
        <line x1={H.midX + H.postH} y1={H.tryY}      x2={H.midX + H.postH} y2={H.tryY - 38} strokeWidth={2.5} />
        <line x1={H.midX - H.postH} y1={H.tryY - 38} x2={H.midX + H.postH} y2={H.tryY - 38} strokeWidth={2.5} />
      </g>
    </g>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Coord conversion helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function normToFullSVG(norm: Position): { cx: number; cy: number } {
  return { cx: (norm.x / 100) * FIELD.WIDTH, cy: (norm.y / 100) * FIELD.HEIGHT }
}
export function normToHalfSVG(norm: Position): { cx: number; cy: number } {
  return { cx: (norm.y / 100) * H.w, cy: (norm.x / 50) * H.halfY }
}
export function fullSVGToNorm(svgX: number, svgY: number): Position {
  return clampPosition(fromSVG(svgX, svgY))
}
export function halfSVGToNorm(svgX: number, svgY: number): Position {
  return {
    x: Math.max(0, Math.min(55, (svgY / H.halfY) * 50)),
    y: Math.max(0, Math.min(100, (svgX / H.w) * 100)),
  }
}

// Delta in normalized space — does NOT clamp (needed for zone drag)
function fullSVGDeltaToNorm(dx: number, dy: number): Position {
  return { x: (dx / FIELD.WIDTH) * 100, y: (dy / FIELD.HEIGHT) * 100 }
}
function halfSVGDeltaToNorm(dx: number, dy: number): Position {
  return { x: (dy / H.halfY) * 50, y: (dx / H.w) * 100 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drag state (discriminated union)
// ═══════════════════════════════════════════════════════════════════════════════

type DragState =
  | {
      type: 'player'
      playerId: string
      wrapperEl: SVGGElement
      startSvgX: number; startSvgY: number
      origCx: number; origCy: number
      moved: boolean
      ballEl: SVGGElement | null
      origBallCx: number; origBallCy: number
    }
  | {
      type: 'group'
      playerIds: string[]
      wrapperEls: Map<string, SVGGElement>
      origPositions: Map<string, { svgCx: number; svgCy: number }>
      startSvgX: number; startSvgY: number
      moved: boolean
      ballEl: SVGGElement | null
      origBallCx: number; origBallCy: number
    }
  | {
      type: 'waypoint'
      playerId: string
      waypointIdx: 0 | 1
      waypointEl: SVGCircleElement
      pathEl: SVGPathElement | null
      prevCx: number; prevCy: number
      currCx: number; currCy: number
      wp0Cx: number; wp0Cy: number
      wp1Cx: number; wp1Cy: number
      wp0Norm: Position; wp1Norm: Position
      startSvgX: number; startSvgY: number
      origCx: number; origCy: number
      moved: boolean
    }
  | {
      type: 'ballwaypoint'
      waypointEl: SVGCircleElement
      pathEl: SVGPathElement | null
      fromCx: number; fromCy: number
      toCx: number; toCy: number
      startSvgX: number; startSvgY: number
      origCx: number; origCy: number
      moved: boolean
    }
  | {
      type: 'ball'
      ballEl: SVGGElement
      startSvgX: number; startSvgY: number
      origCx: number; origCy: number
      moved: boolean
    }
  | {
      type: 'zone'
      eventId: string
      zoneEl: SVGGElement
      origFrom?: Position; origTo?: Position
      origNormPoints?: Position[]
      startSvgX: number; startSvgY: number
      moved: boolean
    }

// ═══════════════════════════════════════════════════════════════════════════════
// Zone rendering helper
// ═══════════════════════════════════════════════════════════════════════════════

const FILL_OPACITY = 0.15

function ZoneShape({
  ev, normToSVG, isSelected, pointerEvts,
}: {
  ev: FieldEvent
  normToSVG: (n: Position) => { cx: number; cy: number }
  isSelected: boolean
  pointerEvts: React.CSSProperties['pointerEvents']
}) {
  const color = ev.color
  const selStroke = isSelected ? 'rgba(255,255,255,0.85)' : 'transparent'

  if (ev.shapeType === 'line') {
    const { cx: fx, cy: fy } = normToSVG(ev.from!)
    const { cx: tx, cy: ty } = normToSVG(ev.to!)
    return (
      <>
        <line x1={fx} y1={fy} x2={tx} y2={ty}
          stroke={color} strokeWidth={4} strokeOpacity={0.85} strokeLinecap="round"
          style={{ pointerEvents: pointerEvts }} />
        {isSelected && (
          <line x1={fx} y1={fy} x2={tx} y2={ty}
            stroke={selStroke} strokeWidth={7} strokeOpacity={0.5} strokeLinecap="round"
            strokeDasharray="8 4" style={{ pointerEvents: 'none' }} />
        )}
      </>
    )
  }

  if (ev.shapeType === 'rect' || ev.shapeType === 'ellipse') {
    const { cx: fx, cy: fy } = normToSVG(ev.from!)
    const { cx: tx, cy: ty } = normToSVG(ev.to!)
    const x1 = Math.min(fx, tx), y1 = Math.min(fy, ty)
    const bw = Math.abs(tx - fx), bh = Math.abs(ty - fy)
    if (ev.shapeType === 'rect') return (
      <>
        <rect x={x1} y={y1} width={bw} height={bh}
          fill={color} fillOpacity={FILL_OPACITY}
          stroke={color} strokeWidth={2} strokeOpacity={0.75}
          style={{ pointerEvents: pointerEvts }} />
        {isSelected && (
          <rect x={x1 - 2} y={y1 - 2} width={bw + 4} height={bh + 4}
            fill="none" stroke={selStroke} strokeWidth={2} strokeDasharray="6 3"
            style={{ pointerEvents: 'none' }} />
        )}
      </>
    )
    // ellipse
    return (
      <>
        <ellipse cx={(fx + tx) / 2} cy={(fy + ty) / 2} rx={bw / 2} ry={bh / 2}
          fill={color} fillOpacity={FILL_OPACITY}
          stroke={color} strokeWidth={2} strokeOpacity={0.75}
          style={{ pointerEvents: pointerEvts }} />
        {isSelected && (
          <ellipse cx={(fx + tx) / 2} cy={(fy + ty) / 2} rx={bw / 2 + 3} ry={bh / 2 + 3}
            fill="none" stroke={selStroke} strokeWidth={2} strokeDasharray="6 3"
            style={{ pointerEvents: 'none' }} />
        )}
      </>
    )
  }

  // arc — 3 normPoints: [start, mid, end]
  if (ev.shapeType === 'arc' && ev.normPoints?.length === 3) {
    const [p0, pm, p1] = ev.normPoints.map(p => { const { cx, cy } = normToSVG(p); return { x: cx, y: cy } })
    const d = svgArcPath(p0, pm, p1)
    return (
      <>
        <path d={d}
          fill="none" stroke={color} strokeWidth={4} strokeOpacity={0.85} strokeLinecap="round"
          style={{ pointerEvents: pointerEvts }} />
        {isSelected && (
          <path d={d}
            fill="none" stroke={selStroke} strokeWidth={8} strokeOpacity={0.5}
            strokeLinecap="round" strokeDasharray="8 4"
            style={{ pointerEvents: 'none' }} />
        )}
      </>
    )
  }

  // path — open freehand / zigzag
  if (!ev.normPoints || ev.normPoints.length < 2) return null
  const pts = ev.normPoints.map(p => normToSVG(p)).map(({ cx, cy }) => `${cx},${cy}`).join(' ')

  return (
    <>
      <polyline points={pts}
        fill="none" stroke={color} strokeWidth={4} strokeOpacity={0.85}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ pointerEvents: pointerEvts }} />
      {isSelected && (
        <polyline points={pts}
          fill="none" stroke={selStroke} strokeWidth={8} strokeOpacity={0.5}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 4"
          style={{ pointerEvents: 'none' }} />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RugbyField — composant principal
// ═══════════════════════════════════════════════════════════════════════════════

interface RugbyFieldProps {
  frame: Frame
  prevFrame?: Frame
  players: Player[]
  fieldView: FieldView
}

const RugbyField = forwardRef<SVGSVGElement, RugbyFieldProps>(
  ({ frame, prevFrame, players, fieldView }, ref) => {
    const internalRef = useRef<SVGSVGElement>(null)
    const svgEl = (ref as React.RefObject<SVGSVGElement | null>) ?? internalRef

    const {
      setPlayerPosition, _pushHistory, setWaypoints,
      setBallPosition, setBallWaypoint, removePlayerFromField, addEvent, removeEvent,
      togglePlayerHidden, updateEvent,
    } = useTacticalStore()
    const hiddenPlayerIds = useTacticalStore(s => {
      const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
      return c?.hiddenPlayerIds ?? EMPTY_HIDDEN
    })
    const {
      isPlaying, setZoom, zoom, activeTool, zoneShape,
      livePositions, liveBallPosition,
      selectedEntityIds, isBallSelected, setBallSelected,
    } = useUIStore()

    const isHalf = fieldView === 'half'

    const getPlayerPos = (playerId: string): Position | undefined => {
      if (isPlaying && livePositions) return livePositions[playerId] ?? frame.positions[playerId]
      return frame.positions[playerId]
    }

    const normToSVG = useCallback((norm: Position) => {
      return isHalf ? normToHalfSVG(norm) : normToFullSVG(norm)
    }, [isHalf])

    const clientToSVG = useCallback((clientX: number, clientY: number) => {
      const svg = svgEl.current
      if (!svg) return { svgX: 0, svgY: 0 }
      const pt  = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { svgX: 0, svgY: 0 }
      const p = pt.matrixTransform(ctm.inverse())
      return { svgX: p.x, svgY: p.y }
    }, [svgEl])

    const svgToNorm = useCallback((svgX: number, svgY: number): Position => {
      return isHalf ? halfSVGToNorm(svgX, svgY) : fullSVGToNorm(svgX, svgY)
    }, [isHalf])

    const svgDeltaToNorm = useCallback((dx: number, dy: number): Position => {
      return isHalf ? halfSVGDeltaToNorm(dx, dy) : fullSVGDeltaToNorm(dx, dy)
    }, [isHalf])

    // ── Drag state ────────────────────────────────────────────────────────────
    const dragState = useRef<DragState | null>(null)

    // ── Double-clic manuel (PointerEvent.detail non fiable dans Tauri/WebKit) ──
    const lastClickRef = useRef<{ playerId: string; time: number } | null>(null)

    // ── Rubber-band selection ─────────────────────────────────────────────────
    const rubberBandRef     = useRef<{ startSvgX: number; startSvgY: number } | null>(null)
    const rubberBandRectRef = useRef<SVGRectElement>(null)

    // ── Zone drawing state ────────────────────────────────────────────────────
    const zoneDrawingRef    = useRef<{ svgPoints: { x: number; y: number }[] } | null>(null)
    const zonePolylineRef   = useRef<SVGPolylineElement>(null)

    // ── Shape drawing state (rect / ellipse click-drag) ───────────────────────
    const shapeDrawingRef   = useRef<{ startSvgX: number; startSvgY: number; mode: 'rect' | 'ellipse'; color: string } | null>(null)
    const previewRectRef    = useRef<SVGRectElement>(null)
    const previewEllipseRef = useRef<SVGEllipseElement>(null)

    // Stable refs so closure-heavy callbacks can read current render values
    const visiblePlayersRef = useRef<Player[]>([])
    const normToSVGRef      = useRef(normToSVG)
    const getPlayerPosRef   = useRef(getPlayerPos)
    normToSVGRef.current    = normToSVG
    getPlayerPosRef.current = getPlayerPos

    // ── onPointerDown ──────────────────────────────────────────────────────────

    const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      if (isPlaying) return

      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY)

      // ── Mode effacement ────────────────────────────────────────────────────
      if (activeTool === 'erase') {
        const eventTarget = (e.target as Element).closest('[data-event-id]')
        if (eventTarget) {
          removeEvent(frame.id, eventTarget.getAttribute('data-event-id')!)
          return
        }
        const ballTarget = (e.target as Element).closest('[data-ball-token]')
        if (ballTarget) { setBallPosition(frame.id, null); return }
        const playerTarget = (e.target as Element).closest('[data-player-id]') as SVGElement | null
        if (playerTarget) {
          _pushHistory()
          removePlayerFromField(playerTarget.getAttribute('data-player-id')!)
        }
        return
      }

      // ── Dessin de zone / forme ─────────────────────────────────────────────
      if (activeTool === 'zone') {
        const onPlayer = (e.target as Element).closest('[data-player-id]')
        const onBall   = (e.target as Element).closest('[data-ball-token]')
        if (onPlayer || onBall) return

        if (zoneShape === 'rect' || zoneShape === 'ellipse') {
          // Click-drag shape drawing
          const color = useUIStore.getState().zoneColor
          shapeDrawingRef.current = { startSvgX: svgX, startSvgY: svgY, mode: zoneShape, color }
          if (zoneShape === 'rect') {
            const el = previewRectRef.current
            if (el) {
              el.setAttribute('x', String(svgX))
              el.setAttribute('y', String(svgY))
              el.setAttribute('width', '0')
              el.setAttribute('height', '0')
              el.setAttribute('stroke', color)
              el.setAttribute('visibility', 'visible')
            }
          } else {
            const el = previewEllipseRef.current
            if (el) {
              el.setAttribute('cx', String(svgX))
              el.setAttribute('cy', String(svgY))
              el.setAttribute('rx', '0')
              el.setAttribute('ry', '0')
              el.setAttribute('stroke', color)
              el.setAttribute('visibility', 'visible')
            }
          }
        } else {
          // Freehand drawing
          zoneDrawingRef.current = { svgPoints: [{ x: svgX, y: svgY }] }
          const pv = zonePolylineRef.current
          if (pv) {
            pv.setAttribute('points', `${svgX},${svgY}`)
            pv.setAttribute('visibility', 'visible')
          }
        }
        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        return
      }

      if (activeTool !== 'select') return

      // ── Points de contrôle (waypoints) ────────────────────────────────────
      const wpTarget = (e.target as Element).closest('[data-waypoint-id]') as SVGCircleElement | null
      if (wpTarget) {
        const fullId = wpTarget.getAttribute('data-waypoint-id')!
        const lastDash = fullId.lastIndexOf('-')
        const playerId = fullId.substring(0, lastDash)
        const waypointIdx = parseInt(fullId.substring(lastDash + 1)) as 0 | 1

        const currPos = frame.positions[playerId]
        const prevPos = prevFrame?.positions[playerId]
        if (!currPos || !prevPos) return

        const stored = frame.waypoints?.[playerId]
        const dx = currPos.x - prevPos.x; const dy = currPos.y - prevPos.y
        const wp0Norm: Position = stored?.[0] ?? { x: prevPos.x + dx / 3, y: prevPos.y + dy / 3 }
        const wp1Norm: Position = stored?.[1] ?? { x: prevPos.x + 2 * dx / 3, y: prevPos.y + 2 * dy / 3 }

        const { cx: w0x, cy: w0y } = normToSVG(wp0Norm)
        const { cx: w1x, cy: w1y } = normToSVG(wp1Norm)
        const { cx: pCx, cy: pCy } = normToSVG(prevPos)
        const { cx: cCx, cy: cCy } = normToSVG(currPos)
        const origCx = waypointIdx === 0 ? w0x : w1x
        const origCy = waypointIdx === 0 ? w0y : w1y

        const pathEl = svgEl.current?.querySelector(
          `[data-waypoint-path="${CSS.escape(playerId)}"]`
        ) as SVGPathElement | null

        dragState.current = {
          type: 'waypoint', playerId, waypointIdx, waypointEl: wpTarget, pathEl,
          prevCx: pCx, prevCy: pCy, currCx: cCx, currCy: cCy,
          wp0Cx: w0x, wp0Cy: w0y, wp1Cx: w1x, wp1Cy: w1y,
          wp0Norm, wp1Norm,
          startSvgX: svgX, startSvgY: svgY, origCx, origCy, moved: false,
        }
        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        e.stopPropagation()
        return
      }

      // ── Waypoint du ballon (coup de pied) ─────────────────────────────────
      const ballWpTarget = (e.target as Element).closest('[data-ball-waypoint]') as SVGCircleElement | null
      if (ballWpTarget && prevFrame?.ballPosition && frame.ballPosition) {
        const { cx: px, cy: py } = normToSVG(prevFrame.ballPosition)
        const { cx: bx, cy: by } = normToSVG(frame.ballPosition)
        const wpNorm = frame.ballWaypoint ?? {
          x: (prevFrame.ballPosition.x + frame.ballPosition.x) / 2,
          y: (prevFrame.ballPosition.y + frame.ballPosition.y) / 2,
        }
        const { cx: wpx, cy: wpy } = normToSVG(wpNorm)
        const pathEl = svgEl.current?.querySelector('[data-ball-waypoint-path]') as SVGPathElement | null
        dragState.current = {
          type: 'ballwaypoint', waypointEl: ballWpTarget, pathEl,
          fromCx: px, fromCy: py, toCx: bx, toCy: by,
          startSvgX: svgX, startSvgY: svgY, origCx: wpx, origCy: wpy, moved: false,
        }
        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        e.stopPropagation()
        return
      }

      // ── Ballon ─────────────────────────────────────────────────────────────
      const ballTarget = (e.target as Element).closest('[data-ball-token]') as SVGGElement | null
      if (ballTarget && frame.ballPosition) {
        const { cx, cy } = normToSVG(frame.ballPosition)
        dragState.current = {
          type: 'ball', ballEl: ballTarget,
          startSvgX: svgX, startSvgY: svgY, origCx: cx, origCy: cy, moved: false,
        }
        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        e.stopPropagation()
        return
      }

      // ── Zone (click to select + drag) ──────────────────────────────────────
      const zoneWrapper = (e.target as Element).closest('[data-zone-wrapper-id]') as SVGGElement | null
      if (zoneWrapper) {
        const eventId = zoneWrapper.getAttribute('data-zone-wrapper-id')!
        const ev = frame.events.find(x => x.id === eventId)
        if (!ev) return

        const currentSelected = useUIStore.getState().selectedEntityIds
        if (!currentSelected.includes(eventId)) {
          useUIStore.setState({ selectedEntityIds: [eventId], isBallSelected: false })
        }

        dragState.current = {
          type: 'zone', eventId, zoneEl: zoneWrapper,
          origFrom: ev.from ? { ...ev.from } : undefined,
          origTo: ev.to ? { ...ev.to } : undefined,
          origNormPoints: ev.normPoints ? ev.normPoints.map(p => ({ ...p })) : undefined,
          startSvgX: svgX, startSvgY: svgY, moved: false,
        }
        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        e.stopPropagation()
        return
      }

      // ── Joueur ─────────────────────────────────────────────────────────────
      const playerHit = (e.target as Element).closest('[data-player-id]') as SVGElement | null
      if (playerHit) {
        const playerId = playerHit.getAttribute('data-player-id')!

        // Double-clic → envoyer au banc (timer manuel car PointerEvent.detail est 0 dans Tauri/WebKit)
        const now = performance.now()
        const last = lastClickRef.current
        if (last && last.playerId === playerId && now - last.time < 400) {
          lastClickRef.current = null
          togglePlayerHidden(playerId)
          e.stopPropagation()
          return
        }
        lastClickRef.current = { playerId, time: now }

        const wrapper = playerHit.closest('[data-token-wrapper]') as SVGGElement | null
        if (!wrapper) return

        const currentSelectedIds = useUIStore.getState().selectedEntityIds
        // Only player IDs in selected (zones have event IDs, not position keys)
        const zoneEventIds = new Set(frame.events.map(ev => ev.id))
        const selectedPlayerIds = currentSelectedIds.filter(id => !zoneEventIds.has(id))

        if (selectedPlayerIds.length > 1 && selectedPlayerIds.includes(playerId)) {
          // ── Déplacement groupé ───────────────────────────────────────────
          const wrapperEls     = new Map<string, SVGGElement>()
          const origPositions  = new Map<string, { svgCx: number; svgCy: number }>()
          for (const pid of selectedPlayerIds) {
            const pos = getPlayerPosRef.current(pid)
            if (!pos) continue
            const wEl = svgEl.current?.querySelector(`[data-token-wrapper="${CSS.escape(pid)}"]`) as SVGGElement | null
            if (!wEl) continue
            const { cx, cy } = normToSVGRef.current(pos)
            wrapperEls.set(pid, wEl)
            origPositions.set(pid, { svgCx: cx, svgCy: cy })
          }
          let groupBallEl: SVGGElement | null = null
          let gOrigBallCx = 0, gOrigBallCy = 0
          if (frame.ballPosition) {
            const { cx: bx, cy: by } = normToSVG(frame.ballPosition)
            for (const pid of selectedPlayerIds) {
              const pos = getPlayerPosRef.current(pid)
              if (!pos) continue
              const { cx: px, cy: py } = normToSVGRef.current(pos)
              if ((bx - px) ** 2 + (by - py) ** 2 < 28 * 28) {
                groupBallEl = svgEl.current?.querySelector('[data-ball-token]') as SVGGElement ?? null
                gOrigBallCx = bx; gOrigBallCy = by
                break
              }
            }
          }
          dragState.current = {
            type: 'group', playerIds: selectedPlayerIds,
            wrapperEls, origPositions,
            startSvgX: svgX, startSvgY: svgY, moved: false,
            ballEl: groupBallEl, origBallCx: gOrigBallCx, origBallCy: gOrigBallCy,
          }
        } else {
          // ── Déplacement simple — on met à jour la sélection ──────────────
          useUIStore.setState({ selectedEntityIds: [playerId], isBallSelected: false })
          const currentPos = getPlayerPos(playerId) ?? { x: 50, y: 50 }
          const { cx, cy } = normToSVG(currentPos)
          let singleBallEl: SVGGElement | null = null
          let sOrigBallCx = 0, sOrigBallCy = 0
          if (frame.ballPosition) {
            const { cx: bx, cy: by } = normToSVG(frame.ballPosition)
            if ((bx - cx) ** 2 + (by - cy) ** 2 < 28 * 28) {
              singleBallEl = svgEl.current?.querySelector('[data-ball-token]') as SVGGElement ?? null
              sOrigBallCx = bx; sOrigBallCy = by
            }
          }
          dragState.current = {
            type: 'player', playerId, wrapperEl: wrapper,
            startSvgX: svgX, startSvgY: svgY, origCx: cx, origCy: cy, moved: false,
            ballEl: singleBallEl, origBallCx: sOrigBallCx, origBallCy: sOrigBallCy,
          }
        }

        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
        e.stopPropagation()
        return
      }

      // ── Espace vide — rubber-band ──────────────────────────────────────────
      useUIStore.setState({ selectedEntityIds: [], isBallSelected: false })
      rubberBandRef.current = { startSvgX: svgX, startSvgY: svgY }
      const rbEl = rubberBandRectRef.current
      if (rbEl) {
        rbEl.setAttribute('x', String(svgX))
        rbEl.setAttribute('y', String(svgY))
        rbEl.setAttribute('width', '0')
        rbEl.setAttribute('height', '0')
        rbEl.setAttribute('visibility', 'visible')
      }
      ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
    }, [isPlaying, activeTool, zoneShape, clientToSVG, svgToNorm, frame, prevFrame, normToSVG,
        setBallPosition, setBallWaypoint, removePlayerFromField, removeEvent, _pushHistory,
        livePositions, svgEl, togglePlayerHidden])

    // ── onPointerMove ──────────────────────────────────────────────────────────

    const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY)

      // Shape drawing preview (rect / ellipse)
      if (shapeDrawingRef.current) {
        const { startSvgX, startSvgY, mode } = shapeDrawingRef.current
        const x = Math.min(svgX, startSvgX), y = Math.min(svgY, startSvgY)
        const w = Math.abs(svgX - startSvgX),  h = Math.abs(svgY - startSvgY)
        if (mode === 'rect') {
          const el = previewRectRef.current
          if (el) {
            el.setAttribute('x', String(x));  el.setAttribute('y', String(y))
            el.setAttribute('width', String(w)); el.setAttribute('height', String(h))
          }
        } else {
          const el = previewEllipseRef.current
          if (el) {
            el.setAttribute('cx', String((svgX + startSvgX) / 2))
            el.setAttribute('cy', String((svgY + startSvgY) / 2))
            el.setAttribute('rx', String(w / 2)); el.setAttribute('ry', String(h / 2))
          }
        }
        return
      }

      // Zone drawing — update polyline preview
      if (zoneDrawingRef.current) {
        const last = zoneDrawingRef.current.svgPoints.at(-1)!
        if ((svgX - last.x) ** 2 + (svgY - last.y) ** 2 >= 9) {
          zoneDrawingRef.current.svgPoints.push({ x: svgX, y: svgY })
        }
        const pts = zoneDrawingRef.current.svgPoints.map(p => `${p.x},${p.y}`).join(' ')
        zonePolylineRef.current?.setAttribute('points', pts)
        return
      }

      // Rubber-band update
      if (rubberBandRef.current) {
        const { startSvgX, startSvgY } = rubberBandRef.current
        const x = Math.min(svgX, startSvgX)
        const y = Math.min(svgY, startSvgY)
        const w = Math.abs(svgX - startSvgX)
        const h = Math.abs(svgY - startSvgY)
        rubberBandRectRef.current?.setAttribute('x', String(x))
        rubberBandRectRef.current?.setAttribute('y', String(y))
        rubberBandRectRef.current?.setAttribute('width', String(w))
        rubberBandRectRef.current?.setAttribute('height', String(h))
        return
      }

      const ds = dragState.current
      if (!ds) return

      if (ds.type === 'zone') {
        const dx = svgX - ds.startSvgX
        const dy = svgY - ds.startSvgY
        ds.zoneEl.setAttribute('transform', `translate(${dx},${dy})`)
        if (!ds.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) ds.moved = true
        return
      }

      if (ds.type === 'group') {
        const dx = svgX - ds.startSvgX
        const dy = svgY - ds.startSvgY
        for (const [pid, el] of ds.wrapperEls) {
          const orig = ds.origPositions.get(pid)!
          el.setAttribute('transform', `translate(${orig.svgCx + dx},${orig.svgCy + dy})`)
        }
        if (ds.ballEl) {
          ds.ballEl.setAttribute('transform', `translate(${ds.origBallCx + dx},${ds.origBallCy + dy})`)
        }
        if (!ds.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) ds.moved = true
        return
      }

      const newCx = ds.origCx + (svgX - ds.startSvgX)
      const newCy = ds.origCy + (svgY - ds.startSvgY)

      if (ds.type === 'waypoint') {
        ds.waypointEl.setAttribute('cx', String(newCx))
        ds.waypointEl.setAttribute('cy', String(newCy))
        const w0Cx = ds.waypointIdx === 0 ? newCx : ds.wp0Cx
        const w0Cy = ds.waypointIdx === 0 ? newCy : ds.wp0Cy
        const w1Cx = ds.waypointIdx === 1 ? newCx : ds.wp1Cx
        const w1Cy = ds.waypointIdx === 1 ? newCy : ds.wp1Cy
        ds.pathEl?.setAttribute('d', `M ${ds.prevCx} ${ds.prevCy} L ${w0Cx} ${w0Cy} L ${w1Cx} ${w1Cy} L ${ds.currCx} ${ds.currCy}`)
      } else if (ds.type === 'ballwaypoint') {
        ds.waypointEl.setAttribute('cx', String(newCx))
        ds.waypointEl.setAttribute('cy', String(newCy))
        ds.pathEl?.setAttribute('d', `M ${ds.fromCx} ${ds.fromCy} Q ${newCx} ${newCy} ${ds.toCx} ${ds.toCy}`)
      } else if (ds.type === 'ball') {
        ds.ballEl.setAttribute('transform', `translate(${newCx},${newCy})`)
      } else {
        ds.wrapperEl.setAttribute('transform', `translate(${newCx},${newCy})`)
        if (ds.ballEl) {
          ds.ballEl.setAttribute('transform', `translate(${ds.origBallCx + newCx - ds.origCx},${ds.origBallCy + newCy - ds.origCy})`)
        }
      }

      if (!ds.moved && (Math.abs(newCx - ds.origCx) > 1 || Math.abs(newCy - ds.origCy) > 1)) {
        ds.moved = true
      }
    }, [clientToSVG])

    // ── onPointerUp ────────────────────────────────────────────────────────────

    const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY)
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)

      // Shape drawing commit (rect / ellipse)
      if (shapeDrawingRef.current) {
        const { startSvgX, startSvgY, mode, color } = shapeDrawingRef.current
        shapeDrawingRef.current = null
        previewRectRef.current?.setAttribute('visibility', 'hidden')
        previewEllipseRef.current?.setAttribute('visibility', 'hidden')

        const minX = Math.min(svgX, startSvgX), maxX = Math.max(svgX, startSvgX)
        const minY = Math.min(svgY, startSvgY), maxY = Math.max(svgY, startSvgY)
        if (maxX - minX < 10 && maxY - minY < 10) return

        addEvent(frame.id, {
          id: crypto.randomUUID(), type: 'zone', shapeType: mode,
          from: svgToNorm(minX, minY), to: svgToNorm(maxX, maxY), color,
        })
        return
      }

      // Freehand zone commit
      if (zoneDrawingRef.current) {
        const { svgPoints } = zoneDrawingRef.current
        zoneDrawingRef.current = null
        zonePolylineRef.current?.setAttribute('visibility', 'hidden')

        if (svgPoints.length < 3) return
        const result = analyzeShape(svgPoints)
        const { minX, minY, maxX, maxY } = result
        // Freehand only produces line, arc, path — reclassify rect/ellipse to path
        const shapeType = (result.shapeType === 'rect' || result.shapeType === 'ellipse')
          ? 'path' : result.shapeType

        if (maxX - minX < 10 && maxY - minY < 10) return  // too small

        const { zoneColor } = useUIStore.getState()
        const id = crypto.randomUUID()

        if (shapeType === 'line') {
          const [p0, p1] = result.points
          addEvent(frame.id, {
            id, type: 'zone', shapeType: 'line',
            from: svgToNorm(p0.x, p0.y),
            to:   svgToNorm(p1.x, p1.y),
            color: zoneColor,
          })
        } else {
          // arc / path — store normalized polyline points
          const normPoints = result.points.map(p => svgToNorm(p.x, p.y))
          addEvent(frame.id, {
            id, type: 'zone', shapeType,
            normPoints,
            from: normPoints[0],
            to:   normPoints[normPoints.length - 1],
            color: zoneColor,
          })
        }
        return
      }

      // Rubber-band commit
      if (rubberBandRef.current) {
        const { startSvgX, startSvgY } = rubberBandRef.current
        rubberBandRef.current = null
        rubberBandRectRef.current?.setAttribute('visibility', 'hidden')

        const minX = Math.min(svgX, startSvgX), maxX = Math.max(svgX, startSvgX)
        const minY = Math.min(svgY, startSvgY), maxY = Math.max(svgY, startSvgY)

        if (maxX - minX < 5 && maxY - minY < 5) return

        const inRect = visiblePlayersRef.current.filter(p => {
          const pos = getPlayerPosRef.current(p.id)
          if (!pos) return false
          const { cx, cy } = normToSVGRef.current(pos)
          return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
        })

        // Zones: check if centroid is inside rubber-band
        const zoneIds: string[] = []
        for (const ev of frame.events) {
          if (ev.type !== 'zone') continue
          let cx: number, cy: number
          if (ev.normPoints && ev.normPoints.length > 0) {
            const avg = ev.normPoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
            const svgPt = normToSVGRef.current({ x: avg.x / ev.normPoints.length, y: avg.y / ev.normPoints.length })
            cx = svgPt.cx; cy = svgPt.cy
          } else if (ev.from && ev.to) {
            const fPt = normToSVGRef.current(ev.from)
            const tPt = normToSVGRef.current(ev.to)
            cx = (fPt.cx + tPt.cx) / 2; cy = (fPt.cy + tPt.cy) / 2
          } else continue
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            zoneIds.push(ev.id)
          }
        }

        let ballInRect = false
        if (frame.ballPosition) {
          const { cx: bx, cy: by } = normToSVGRef.current(frame.ballPosition)
          ballInRect = bx >= minX && bx <= maxX && by >= minY && by <= maxY
        }

        const selectedEntityIds = [...inRect.map(p => p.id), ...zoneIds]
        useUIStore.setState({ selectedEntityIds, isBallSelected: ballInRect })
        return
      }

      const ds = dragState.current
      if (!ds) return
      dragState.current = null

      // Zone drag commit
      if (ds.type === 'zone') {
        ds.zoneEl.setAttribute('transform', '')
        if (!ds.moved) return
        const dx = svgX - ds.startSvgX
        const dy = svgY - ds.startSvgY
        const delta = svgDeltaToNorm(dx, dy)
        _pushHistory()
        const patch: Partial<FieldEvent> = {}
        if (ds.origFrom) patch.from = { x: ds.origFrom.x + delta.x, y: ds.origFrom.y + delta.y }
        if (ds.origTo)   patch.to   = { x: ds.origTo.x   + delta.x, y: ds.origTo.y   + delta.y }
        if (ds.origNormPoints) {
          patch.normPoints = ds.origNormPoints.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }))
        }
        updateEvent(frame.id, ds.eventId, patch)
        return
      }

      if (!ds.moved) {
        if (ds.type === 'ball') setBallSelected(true)
        return
      }

      if (ds.type === 'group') {
        const dx = svgX - ds.startSvgX
        const dy = svgY - ds.startSvgY
        _pushHistory()
        for (const pid of ds.playerIds) {
          const orig = ds.origPositions.get(pid)
          if (!orig) continue
          setPlayerPosition(frame.id, pid, svgToNorm(orig.svgCx + dx, orig.svgCy + dy))
        }
        return
      }

      const finalCx = ds.origCx + (svgX - ds.startSvgX)
      const finalCy = ds.origCy + (svgY - ds.startSvgY)
      const newPos = svgToNorm(finalCx, finalCy)

      if (ds.type === 'waypoint') {
        const pair: [Position, Position] = ds.waypointIdx === 0
          ? [newPos, ds.wp1Norm]
          : [ds.wp0Norm, newPos]
        setWaypoints(frame.id, ds.playerId, pair)
      } else if (ds.type === 'ballwaypoint') {
        setBallWaypoint(frame.id, newPos)
      } else if (ds.type === 'ball') {
        setBallPosition(frame.id, newPos)
      } else {
        _pushHistory()
        setPlayerPosition(frame.id, ds.playerId, newPos)
      }
    }, [clientToSVG, svgToNorm, svgDeltaToNorm, _pushHistory, setPlayerPosition, setWaypoints,
        setBallPosition, setBallWaypoint, addEvent, setBallSelected, updateEvent, frame])

    const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      setZoom(zoom * (e.deltaY > 0 ? 0.9 : 1.1))
    }, [zoom, setZoom])

    // ── Joueurs visibles ───────────────────────────────────────────────────────

    const visiblePlayers = players.filter(p => {
      if (hiddenPlayerIds.includes(p.id)) return false
      const pos = getPlayerPos(p.id)
      if (!pos) return false
      if (isHalf && pos.x > 53) return false
      return true
    })
    visiblePlayersRef.current = visiblePlayers

    // ── Porteur du ballon (anneau orange) ──────────────────────────────────────

    const effectiveBallPos = isPlaying ? liveBallPosition : (frame.ballPosition ?? null)
    let ballCarrierPlayerId: string | null = null
    if (effectiveBallPos) {
      const { cx: bx, cy: by } = normToSVG(effectiveBallPos)
      let minDist = 28
      for (const p of visiblePlayers) {
        const pos = getPlayerPos(p.id)
        if (!pos) continue
        const { cx, cy } = normToSVG(pos)
        const d = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2)
        if (d < minDist) { minDist = d; ballCarrierPlayerId = p.id }
      }
    }

    // ── Ghost trails ───────────────────────────────────────────────────────────

    interface TrailInfo {
      playerId: string; number: number; isAGR: boolean
      prevCx: number; prevCy: number
      currCx: number; currCy: number
      wp0Cx: number; wp0Cy: number
      wp1Cx: number; wp1Cy: number
    }
    const trails: TrailInfo[] = []
    if (prevFrame && !isPlaying) {
      for (const p of visiblePlayers) {
        const prevPos = prevFrame.positions[p.id]
        const currPos = frame.positions[p.id]
        if (!prevPos || !currPos) continue
        const { cx: pCx, cy: pCy } = normToSVG(prevPos)
        const { cx: cCx, cy: cCy } = normToSVG(currPos)
        const dxSq = (cCx - pCx) ** 2 + (cCy - pCy) ** 2
        if (dxSq < 100) continue

        const stored = frame.waypoints?.[p.id]
        const dx = currPos.x - prevPos.x; const dy = currPos.y - prevPos.y
        const wp0Norm = stored?.[0] ?? { x: prevPos.x + dx / 3, y: prevPos.y + dy / 3 }
        const wp1Norm = stored?.[1] ?? { x: prevPos.x + 2 * dx / 3, y: prevPos.y + 2 * dy / 3 }
        const { cx: w0x, cy: w0y } = normToSVG(wp0Norm)
        const { cx: w1x, cy: w1y } = normToSVG(wp1Norm)
        trails.push({ playerId: p.id, number: p.number, isAGR: p.team === 'AGR', prevCx: pCx, prevCy: pCy, currCx: cCx, currCy: cCy, wp0Cx: w0x, wp0Cy: w0y, wp1Cx: w1x, wp1Cy: w1y })
      }
    }

    // ── ViewBox & curseur ──────────────────────────────────────────────────────

    const viewBox = isHalf ? H.viewBox : '-130 -5 1270 720'
    const fieldCursor = activeTool === 'erase' || activeTool === 'zone'
      ? 'crosshair'
      : 'default'

    const zonePointerEvts: React.CSSProperties['pointerEvents'] =
      activeTool === 'erase' || activeTool === 'select' ? 'auto' : 'none'

    return (
      <svg
        ref={svgEl}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', cursor: isPlaying ? 'default' : fieldCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* Arrowhead marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.9)" />
          </marker>
        </defs>

        {isHalf ? (
          <>
            <rect x={-5} y={-10} width={715} height={640} fill="#0a0d14" />
            <rect x={H.leftX} y={0} width={H.w} height={H.tryY} fill="#2e5520" />
            <rect x={H.leftX} y={H.tryY} width={H.w} height={H.halfY - H.tryY} fill="#4a7c3f" />
            <HalfFieldLines />
          </>
        ) : (
          <>
            <rect x={-130} y={-5} width={1270} height={720} fill="#0a0d14" />
            <rect x={F.leftIngoal}  y={F.top} width={100} height={700} fill="#2e5520" />
            <rect x={F.rightTry}    y={F.top} width={100} height={700} fill="#2e5520" />
            <rect x={F.leftTry} y={F.top} width={800} height={700} fill="#4a7c3f" />
            <FullFieldLines />
          </>
        )}

        {/* ── Zones colorées ───────────────────────────────────────────────── */}
        {frame.events.filter(ev => ev.type === 'zone').map(ev => {
          const isSelected = selectedEntityIds.includes(ev.id)
          return (
            <g
              key={ev.id}
              data-zone-wrapper-id={ev.id}
              data-event-id={ev.id}
              style={{ cursor: activeTool === 'select' ? 'grab' : activeTool === 'erase' ? 'not-allowed' : 'default' }}
            >
              <ZoneShape
                ev={ev}
                normToSVG={normToSVG}
                isSelected={isSelected}
                pointerEvts={zonePointerEvts}
              />
            </g>
          )
        })}

        {/* ── Flèches dessinées (run events existants) ─────────────────────── */}
        {frame.events.filter(ev => ev.type !== 'zone' && ev.from && ev.to).map(ev => {
          const { cx: fx, cy: fy } = normToSVG(ev.from!)
          const { cx: tx, cy: ty } = normToSVG(ev.to!)
          return (
            <line
              key={ev.id}
              data-event-id={ev.id}
              x1={fx} y1={fy} x2={tx} y2={ty}
              stroke={ev.color} strokeWidth={2.5} strokeOpacity={0.9}
              markerEnd="url(#arrowhead)"
              style={{ pointerEvents: activeTool === 'erase' ? 'auto' : 'none' }}
            />
          )
        })}

        {/* ── Ghost trails ─────────────────────────────────────────────────── */}
        {trails.map(t => {
          const ghostFill   = t.isAGR ? 'rgba(220,38,38,0.22)'   : 'rgba(240,240,240,0.22)'
          const ghostStroke = t.isAGR ? 'rgba(220,38,38,0.55)'   : 'rgba(200,200,200,0.55)'
          const numFill     = t.isAGR ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'
          return (
            <g key={`trail-${t.playerId}`}>
              <path
                data-waypoint-path={t.playerId}
                d={`M ${t.prevCx} ${t.prevCy} L ${t.wp0Cx} ${t.wp0Cy} L ${t.wp1Cx} ${t.wp1Cy} L ${t.currCx} ${t.currCy}`}
                fill="none" stroke={ghostStroke} strokeWidth={1.8} strokeDasharray="7 4"
              />
              <circle cx={t.prevCx} cy={t.prevCy} r={16} fill={ghostFill} stroke={ghostStroke} strokeWidth={1.5} />
              <text x={t.prevCx} y={t.prevCy + 1} textAnchor="middle" dominantBaseline="middle"
                fill={numFill} fontSize={13} fontWeight="700" fontFamily="Rajdhani, sans-serif"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {t.number}
              </text>
              <circle
                data-waypoint-id={`${t.playerId}-0`}
                cx={t.wp0Cx} cy={t.wp0Cy} r={6}
                fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5}
                style={{ cursor: 'grab' }}
              />
              <circle
                data-waypoint-id={`${t.playerId}-1`}
                cx={t.wp1Cx} cy={t.wp1Cy} r={6}
                fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5}
                style={{ cursor: 'grab' }}
              />
            </g>
          )
        })}

        {/* ── Joueurs placés — AVANT le ballon pour z-order ────────────────── */}
        {visiblePlayers.map(player => {
          const pos = getPlayerPos(player.id)!
          const { cx, cy } = normToSVG(pos)
          const isSelected  = selectedEntityIds.includes(player.id)
          const hasBall     = ballCarrierPlayerId === player.id
          return (
            <g
              key={player.id}
              data-token-wrapper={player.id}
              transform={`translate(${cx},${cy})`}
              style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}
            >
              <PlayerToken player={player} cx={0} cy={0} />
              {hasBall && (
                <circle cx={0} cy={0} r={21} fill="none" stroke="#f97316" strokeWidth={2.5} />
              )}
              {isSelected && (
                <circle cx={0} cy={0} r={hasBall ? 26 : 22} fill="none"
                  stroke="rgba(255,255,255,0.85)" strokeWidth={1.8} strokeDasharray="5 3" />
              )}
            </g>
          )
        })}

        {/* ── Ballon — toujours par-dessus les joueurs ──────────────────────── */}
        {effectiveBallPos && (() => {
          const { cx: bx, cy: by } = normToSVG(effectiveBallPos)
          return (
            <g
              data-ball-token="true"
              transform={`translate(${bx},${by})`}
              style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}
            >
              <ellipse rx={14} ry={9} fill="#c8860a" stroke="#7c5410" strokeWidth={1.5} />
              <ellipse rx={5} ry={8} fill="none" stroke="#7c5410" strokeWidth={0.8} />
              <line x1={0} y1={-9} x2={0} y2={9} stroke="#7c5410" strokeWidth={0.8} />
              {isBallSelected && activeTool === 'select' && !isPlaying && (
                <ellipse rx={18} ry={13} fill="none" stroke="#facc15" strokeWidth={2} strokeDasharray="4 3" />
              )}
            </g>
          )
        })()}

        {/* ── Trajectoire du ballon + handle de courbure ───────────────────── */}
        {prevFrame?.ballPosition && frame.ballPosition && !isPlaying && (() => {
          const { cx: px, cy: py } = normToSVG(prevFrame.ballPosition)
          const { cx: bx, cy: by } = normToSVG(frame.ballPosition)
          const dSq = (bx - px) ** 2 + (by - py) ** 2
          if (dSq < 25) return null
          const wpNorm = frame.ballWaypoint ?? {
            x: (prevFrame.ballPosition.x + frame.ballPosition.x) / 2,
            y: (prevFrame.ballPosition.y + frame.ballPosition.y) / 2,
          }
          const { cx: wpx, cy: wpy } = normToSVG(wpNorm)
          return (
            <g style={{ pointerEvents: activeTool === 'select' ? 'auto' : 'none' }}>
              <ellipse cx={px} cy={py} rx={14} ry={9}
                fill="#c8860a" fillOpacity={0.18} stroke="#c8860a" strokeWidth={1} strokeOpacity={0.35} />
              <path
                data-ball-waypoint-path="true"
                d={`M ${px} ${py} Q ${wpx} ${wpy} ${bx} ${by}`}
                fill="none" stroke="#c8860a" strokeWidth={1.8} strokeDasharray="6 4" strokeOpacity={0.7}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                data-ball-waypoint="true"
                cx={wpx} cy={wpy} r={6}
                fill="rgba(200,134,10,0.9)" stroke="rgba(0,0,0,0.4)" strokeWidth={1.5}
                style={{ cursor: 'grab' }}
              />
            </g>
          )
        })()}

        {/* ── Preview zone en cours de dessin (polyline freehand) ──────────── */}
        <polyline
          ref={zonePolylineRef}
          points=""
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth={2}
          strokeDasharray="5 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          visibility="hidden"
          style={{ pointerEvents: 'none' }}
        />

        {/* ── Prévisualisation rect / ellipse ──────────────────────────────── */}
        <rect
          ref={previewRectRef}
          x={0} y={0} width={0} height={0}
          fill="rgba(255,255,255,0.07)"
          stroke="white" strokeWidth={2} strokeDasharray="5 3"
          visibility="hidden"
          style={{ pointerEvents: 'none' }}
        />
        <ellipse
          ref={previewEllipseRef}
          cx={0} cy={0} rx={0} ry={0}
          fill="rgba(255,255,255,0.07)"
          stroke="white" strokeWidth={2} strokeDasharray="5 3"
          visibility="hidden"
          style={{ pointerEvents: 'none' }}
        />

        {/* ── Rubber-band de sélection ─────────────────────────────────────── */}
        <rect
          ref={rubberBandRectRef}
          x={0} y={0} width={0} height={0}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.2}
          strokeDasharray="5 3"
          visibility="hidden"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    )
  }
)

RugbyField.displayName = 'RugbyField'
export default RugbyField
