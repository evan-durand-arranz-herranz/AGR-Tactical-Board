import { useRef, useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { useTacticalStore } from '../store/tacticalStore'
import { lerpPosition, easeInOut } from '../utils/fieldGeometry'
import type { Frame, Position } from '../types'

// Interpolation piecewise le long de prev → wp0 → wp1 → curr
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

    const uiState = useUIStore.getState()
    const speed = uiState.playbackSpeed
    const loop  = uiState.playbackLoop

    let currentFrameIdx = startFrameIdx
    let transitionStart = -1
    let transitionDuration = frames[currentFrameIdx].duration / speed

    // Snapshot positions, waypoints et position du ballon — jamais toucher au store pendant l'animation
    const originalPositions: Record<string, Position>[] = frames.map(f => ({ ...f.positions }))
    const originalWaypoints = frames.map(f =>
      f.waypoints ? (JSON.parse(JSON.stringify(f.waypoints)) as Record<string, [Position, Position]>) : undefined
    )
    const originalBallPositions: (Position | undefined)[] = frames.map(f =>
      f.ballPosition ? { ...f.ballPosition } : undefined
    )

    useUIStore.getState().setIsPlaying(true)
    useUIStore.getState().setActiveFrameId(frames[currentFrameIdx].id)

    const tick = (now: number) => {
      if (transitionStart < 0) transitionStart = now

      const elapsed = now - transitionStart
      const t = Math.min(elapsed / transitionDuration, 1)
      const easedT = easeInOut(t)

      const toFrame = frames[currentFrameIdx + 1]

      if (toFrame) {
        const combo = useTacticalStore.getState().getActiveCombination()
        if (combo) {
          // Joueurs — suit la trajectoire avec waypoints si disponible
          const newLive: Record<string, Position> = {}
          const destWaypoints = originalWaypoints[currentFrameIdx + 1]
          for (const player of combo.players) {
            const fromPos = originalPositions[currentFrameIdx][player.id]
            const toPos   = originalPositions[currentFrameIdx + 1]?.[player.id]
            if (fromPos && toPos) {
              const wps = destWaypoints?.[player.id]
              newLive[player.id] = wps
                ? interpolateAlongPath(fromPos, wps[0], wps[1], toPos, easedT)
                : lerpPosition(fromPos, toPos, easedT)
            } else if (fromPos) {
              newLive[player.id] = fromPos
            }
          }
          useUIStore.getState().setLivePositions(newLive)

          // Ballon — interpolation simple
          const fromBall = originalBallPositions[currentFrameIdx]
          const toBall   = originalBallPositions[currentFrameIdx + 1]
          if (fromBall && toBall) {
            useUIStore.getState().setLiveBallPosition(lerpPosition(fromBall, toBall, easedT))
          } else {
            useUIStore.getState().setLiveBallPosition(fromBall ?? null)
          }
        }
      }

      if (t >= 1) {
        const nextIdx = currentFrameIdx + 1
        if (nextIdx >= frames.length - 1) {
          if (loop) {
            currentFrameIdx = 0
            transitionStart = now
            transitionDuration = frames[0].duration / speed
            useUIStore.getState().setActiveFrameId(frames[0].id)
          } else {
            useUIStore.getState().setActiveFrameId(frames[frames.length - 1].id)
            useUIStore.getState().setLivePositions(null)
            useUIStore.getState().setLiveBallPosition(null)
            rafRef.current = null
            useUIStore.getState().setIsPlaying(false)
            return
          }
        } else {
          currentFrameIdx = nextIdx
          transitionStart = now
          transitionDuration = frames[currentFrameIdx].duration / speed
          useUIStore.getState().setActiveFrameId(frames[currentFrameIdx].id)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopAnimation])

  return { startAnimation, stopAnimation }
}
