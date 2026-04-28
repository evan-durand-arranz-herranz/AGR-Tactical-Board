import React, { forwardRef, useRef, useCallback } from 'react'
import { FIELD } from '../../types'
import type { Frame, Player, FieldView, Position } from '../../types'
import { clampPosition, fromSVG } from '../../utils/fieldGeometry'
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
      type: 'ball'
      ballEl: SVGGElement
      startSvgX: number; startSvgY: number
      origCx: number; origCy: number
      moved: boolean
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
      setBallPosition, removePlayerFromField, addEvent, removeEvent,
    } = useTacticalStore()
    const { isPlaying, setZoom, zoom, activeTool, livePositions, liveBallPosition } = useUIStore()

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
      const rect = svg.getBoundingClientRect()
      const vb   = svg.viewBox.baseVal
      return {
        svgX: (clientX - rect.left) / rect.width  * vb.width  + vb.x,
        svgY: (clientY - rect.top)  / rect.height * vb.height + vb.y,
      }
    }, [svgEl])

    const svgToNorm = useCallback((svgX: number, svgY: number): Position => {
      return isHalf ? halfSVGToNorm(svgX, svgY) : fullSVGToNorm(svgX, svgY)
    }, [isHalf])

    // ── Drag state (joueurs, waypoints, ballon) ────────────────────────────────

    const dragState    = useRef<DragState | null>(null)

    // ── Arrow drawing state ────────────────────────────────────────────────────

    const arrowDrawing = useRef<{ fromNorm: Position; fromSvgX: number; fromSvgY: number } | null>(null)
    const previewArrowRef = useRef<SVGLineElement>(null)

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

      // ── Mode dessin de flèche ──────────────────────────────────────────────
      if (activeTool === 'arrow') {
        arrowDrawing.current = { fromNorm: svgToNorm(svgX, svgY), fromSvgX: svgX, fromSvgY: svgY }
        if (previewArrowRef.current) {
          previewArrowRef.current.setAttribute('visibility', 'visible')
          previewArrowRef.current.setAttribute('x1', String(svgX))
          previewArrowRef.current.setAttribute('y1', String(svgY))
          previewArrowRef.current.setAttribute('x2', String(svgX))
          previewArrowRef.current.setAttribute('y2', String(svgY))
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

      // ── Joueur ─────────────────────────────────────────────────────────────
      const target = (e.target as Element).closest('[data-player-id]') as SVGElement | null
      if (!target) return
      const playerId = target.getAttribute('data-player-id')!
      const wrapper = target.closest('[data-token-wrapper]') as SVGGElement | null
      if (!wrapper) return
      const currentPos = getPlayerPos(playerId) ?? { x: 50, y: 50 }
      const { cx, cy } = normToSVG(currentPos)
      dragState.current = {
        type: 'player', playerId, wrapperEl: wrapper,
        startSvgX: svgX, startSvgY: svgY, origCx: cx, origCy: cy, moved: false,
      }
      ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
      e.stopPropagation()
    }, [isPlaying, activeTool, clientToSVG, svgToNorm, frame, prevFrame, normToSVG,
        setBallPosition, removePlayerFromField, removeEvent, _pushHistory, livePositions, svgEl])

    // ── onPointerMove ──────────────────────────────────────────────────────────

    const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY)

      // Arrow drawing preview
      if (arrowDrawing.current) {
        previewArrowRef.current?.setAttribute('x2', String(svgX))
        previewArrowRef.current?.setAttribute('y2', String(svgY))
        return
      }

      const ds = dragState.current
      if (!ds) return
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
      } else if (ds.type === 'ball') {
        ds.ballEl.setAttribute('transform', `translate(${newCx},${newCy})`)
      } else {
        ds.wrapperEl.setAttribute('transform', `translate(${newCx},${newCy})`)
      }

      if (!ds.moved && (Math.abs(newCx - ds.origCx) > 1 || Math.abs(newCy - ds.origCy) > 1)) {
        ds.moved = true
      }
    }, [clientToSVG])

    // ── onPointerUp ────────────────────────────────────────────────────────────

    const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      const { svgX, svgY } = clientToSVG(e.clientX, e.clientY)
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)

      // Arrow drawing commit
      if (arrowDrawing.current) {
        const { fromNorm, fromSvgX, fromSvgY } = arrowDrawing.current
        arrowDrawing.current = null
        if (previewArrowRef.current) previewArrowRef.current.setAttribute('visibility', 'hidden')
        const dSq = (svgX - fromSvgX) ** 2 + (svgY - fromSvgY) ** 2
        if (dSq < 100) return
        const toNorm = svgToNorm(svgX, svgY)
        addEvent(frame.id, {
          id: crypto.randomUUID(),
          type: 'run',
          from: fromNorm,
          to: toNorm,
          color: '#ffffff',
        })
        return
      }

      const ds = dragState.current
      if (!ds) return
      dragState.current = null
      if (!ds.moved) return

      const finalCx = ds.origCx + (svgX - ds.startSvgX)
      const finalCy = ds.origCy + (svgY - ds.startSvgY)
      const newPos = svgToNorm(finalCx, finalCy)

      if (ds.type === 'waypoint') {
        const pair: [Position, Position] = ds.waypointIdx === 0
          ? [newPos, ds.wp1Norm]
          : [ds.wp0Norm, newPos]
        setWaypoints(frame.id, ds.playerId, pair)
      } else if (ds.type === 'ball') {
        setBallPosition(frame.id, newPos)
      } else {
        _pushHistory()
        setPlayerPosition(frame.id, ds.playerId, newPos)
      }
    }, [clientToSVG, svgToNorm, _pushHistory, setPlayerPosition, setWaypoints, setBallPosition, addEvent, frame.id])

    const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      setZoom(zoom * (e.deltaY > 0 ? 0.9 : 1.1))
    }, [zoom, setZoom])

    // ── Joueurs visibles ───────────────────────────────────────────────────────

    const visiblePlayers = players.filter(p => {
      const pos = getPlayerPos(p.id)
      if (!pos) return false
      if (isHalf && pos.x > 53) return false
      return true
    })

    // ── Ghost trails (2 waypoints, piecewise linear) ───────────────────────────

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

    // ── ViewBox ────────────────────────────────────────────────────────────────

    const viewBox = isHalf ? H.viewBox : '-130 -5 1270 720'
    const fieldCursor = activeTool === 'erase' ? 'crosshair' : activeTool === 'arrow' ? 'crosshair' : 'default'

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

        {/* ── Flèches dessinées ────────────────────────────────────────────── */}
        {frame.events.filter(ev => ev.from && ev.to).map(ev => {
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

        {/* Flèche en cours de dessin (preview) */}
        <line
          ref={previewArrowRef}
          x1={0} y1={0} x2={0} y2={0}
          stroke="rgba(255,255,255,0.75)" strokeWidth={2.5}
          markerEnd="url(#arrowhead)"
          visibility="hidden"
          style={{ pointerEvents: 'none' }}
        />

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

        {/* ── Ghost ballon ──────────────────────────────────────────────────── */}
        {prevFrame?.ballPosition && frame.ballPosition && !isPlaying && (() => {
          const { cx: px, cy: py } = normToSVG(prevFrame.ballPosition)
          const { cx: bx, cy: by } = normToSVG(frame.ballPosition)
          const dSq = (bx - px) ** 2 + (by - py) ** 2
          if (dSq < 25) return null
          return (
            <line x1={px} y1={py} x2={bx} y2={by}
              stroke="#c8860a" strokeWidth={1.8} strokeDasharray="6 4" strokeOpacity={0.7} />
          )
        })()}

        {/* ── Ballon indépendant ───────────────────────────────────────────── */}
        {(isPlaying ? liveBallPosition : frame.ballPosition) && (() => {
          const effectiveBallPos = (isPlaying ? liveBallPosition : frame.ballPosition)!
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
            </g>
          )
        })()}

        {/* ── Joueurs placés ───────────────────────────────────────────────── */}
        {visiblePlayers.map(player => {
          const pos = getPlayerPos(player.id)!
          const { cx, cy } = normToSVG(pos)
          return (
            <g key={player.id} data-token-wrapper={player.id} transform={`translate(${cx},${cy})`}
              style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}>
              <PlayerToken player={player} cx={0} cy={0} />
            </g>
          )
        })}
      </svg>
    )
  }
)

RugbyField.displayName = 'RugbyField'
export default RugbyField
