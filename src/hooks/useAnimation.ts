import { useRef, useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { useTacticalStore } from '../store/tacticalStore'
import { lerpPosition, easeInOut } from '../utils/fieldGeometry'
import type { Frame, Position } from '../types'

function quadBezier(p0: Position, p1: Position, p2: Position, t: number): Position {
  const u = 1 - t
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y }
}

function interpolateAlongPath(
  p0: Position, p1: Position, p2: Position, p3: Position,
  t: number,
): Position {
  const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y)
  const total = d01 + d12 + d23
  if (total < 0.001) return lerpPosition(p0, p3, t)

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

export function useAnimation() {
  const rafRef = useRef<number | null>(null)

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    useUIStore.getState().setIsPlaying(false)
    useUIStore.getState().setLivePositions(null)
    useUIStore.getState().setLiveBallPosition(null)
  }, [])

  const startAnimation = useCallback((frames: Frame[], startFrameIdx = 0) => {
    if (frames.length < 2) return
    stopAnimation()

    const { playbackSpeed: speed, playbackLoop: loop } = useUIStore.getState()

    const startIdx = startFrameIdx
    const endIdx   = frames.length - 1

    // Snapshot immutable data upfront — never read the store during the tick
    const origPositions = frames.map(f => ({ ...f.positions }))
    const origWaypoints = frames.map(f =>
      f.waypoints ? (JSON.parse(JSON.stringify(f.waypoints)) as Record<string, [Position, Position]>) : undefined
    )
    const origBallPos = frames.map(f => f.ballPosition ? { ...f.ballPosition } : undefined)
    const origBallWp  = frames.map(f => f.ballWaypoint  ? { ...f.ballWaypoint  } : undefined)

    // Per-transition durations (ms) from startIdx to endIdx
    const durations: number[] = []
    for (let i = startIdx; i < endIdx; i++) durations.push(frames[i].duration / speed)
    const totalDuration = durations.reduce((s, d) => s + d, 0)

    // Cumulative time at the start of each transition
    const cumTimes: number[] = [0]
    for (const d of durations) cumTimes.push(cumTimes[cumTimes.length - 1] + d)

    useUIStore.getState().setIsPlaying(true)
    useUIStore.getState().setActiveFrameId(frames[startIdx].id)

    let animStart  = -1
    let lastTransIdx = 0

    const tick = (now: number) => {
      if (animStart < 0) animStart = now

      // Global ease applied once — gives continuous velocity at intermediate frames
      const rawT        = Math.min((now - animStart) / totalDuration, 1)
      const easedMs     = easeInOut(rawT) * totalDuration

      // Find which transition the eased time falls in
      let transIdx = durations.length - 1
      let localT   = 1
      let rem      = Math.min(easedMs, totalDuration)
      for (let i = 0; i < durations.length; i++) {
        if (rem <= durations[i] || i === durations.length - 1) {
          transIdx = i
          localT   = durations[i] > 0 ? Math.min(rem / durations[i], 1) : 1
          break
        }
        rem -= durations[i]
      }

      const frameIdx = startIdx + transIdx

      // Advance the active-frame indicator when we cross a boundary
      if (transIdx > lastTransIdx) {
        lastTransIdx = transIdx
        useUIStore.getState().setActiveFrameId(frames[frameIdx].id)
      }

      const combo = useTacticalStore.getState().getActiveCombination()
      if (combo) {
        const destWaypoints = origWaypoints[frameIdx + 1]

        // ── Players ────────────────────────────────────────────────────────
        const newLive: Record<string, Position> = {}
        for (const player of combo.players) {
          const fromPos = origPositions[frameIdx]?.[player.id]
          const toPos   = origPositions[frameIdx + 1]?.[player.id]
          if (fromPos && toPos) {
            const wps = destWaypoints?.[player.id]
            newLive[player.id] = wps
              ? interpolateAlongPath(fromPos, wps[0], wps[1], toPos, localT)
              : lerpPosition(fromPos, toPos, localT)
          } else if (fromPos) {
            newLive[player.id] = fromPos
          }
        }
        useUIStore.getState().setLivePositions(newLive)

        // ── Ball: own waypoint > carrier waypoints > linear ────────────────
        const fromBall = origBallPos[frameIdx]
        const toBall   = origBallPos[frameIdx + 1]
        if (fromBall && toBall) {
          const ballWp = origBallWp[frameIdx + 1]
          if (ballWp) {
            useUIStore.getState().setLiveBallPosition(quadBezier(fromBall, ballWp, toBall, localT))
          } else {
            let carrierId: string | null = null
            let minDistSq = 16
            for (const player of combo.players) {
              const fp = origPositions[frameIdx][player.id]
              if (!fp) continue
              const dx = fromBall.x - fp.x, dy = fromBall.y - fp.y
              const dsq = dx * dx + dy * dy
              if (dsq < minDistSq) { minDistSq = dsq; carrierId = player.id }
            }
            const carrierWps  = carrierId ? destWaypoints?.[carrierId] : null
            const fromCarrier = carrierId ? origPositions[frameIdx][carrierId] : null
            const toCarrier   = carrierId ? origPositions[frameIdx + 1]?.[carrierId] : null
            if (carrierWps && fromCarrier && toCarrier) {
              const ip = interpolateAlongPath(fromCarrier, carrierWps[0], carrierWps[1], toCarrier, localT)
              useUIStore.getState().setLiveBallPosition({
                x: ip.x + (fromBall.x - fromCarrier.x),
                y: ip.y + (fromBall.y - fromCarrier.y),
              })
            } else {
              useUIStore.getState().setLiveBallPosition(lerpPosition(fromBall, toBall, localT))
            }
          }
        } else {
          useUIStore.getState().setLiveBallPosition(fromBall ?? null)
        }
      }

      if (rawT >= 1) {
        if (loop) {
          animStart    = now
          lastTransIdx = 0
          useUIStore.getState().setActiveFrameId(frames[startIdx].id)
        } else {
          useUIStore.getState().setActiveFrameId(frames[endIdx].id)
          useUIStore.getState().setLivePositions(null)
          useUIStore.getState().setLiveBallPosition(null)
          rafRef.current = null
          useUIStore.getState().setIsPlaying(false)
          return
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopAnimation])

  return { startAnimation, stopAnimation }
}
