import { useRef, useEffect, useCallback } from 'react'
import type { Player, Position } from '../types'

type DragItem = { kind: 'player'; player: Player } | { kind: 'ball' }

export interface DragToPlaceHandlers {
  ghostRef: React.RefObject<HTMLDivElement | null>
  startDrag: (player: Player, clientX: number, clientY: number) => void
  startBallDrag: (clientX: number, clientY: number) => void
}

export function useDragToPlace(
  svgRef: React.RefObject<SVGSVGElement | null>,
  toFieldPos: (svgX: number, svgY: number) => Position | null,
  onPlace: (playerId: string, pos: Position) => void,
  onPlaceBall?: (pos: Position) => void,
): DragToPlaceHandlers {
  const ghostRef   = useRef<HTMLDivElement | null>(null)
  const dragging   = useRef<DragItem | null>(null)
  const converterRef   = useRef(toFieldPos)
  const onPlaceBallRef = useRef(onPlaceBall)
  useEffect(() => { converterRef.current = toFieldPos },   [toFieldPos])
  useEffect(() => { onPlaceBallRef.current = onPlaceBall }, [onPlaceBall])

  const updateGhostPos = useCallback((clientX: number, clientY: number) => {
    const el = ghostRef.current
    if (!el) return
    el.style.left = `${clientX - 18}px`
    el.style.top  = `${clientY - 18}px`
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      updateGhostPos(e.clientX, e.clientY)
    }

    const onUp = (e: PointerEvent) => {
      const item = dragging.current
      dragging.current = null
      if (ghostRef.current) ghostRef.current.style.display = 'none'
      if (!item) return

      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom
      if (!inside) return

      const vb   = svg.viewBox.baseVal
      const svgX = (e.clientX - rect.left) / rect.width  * vb.width  + vb.x
      const svgY = (e.clientY - rect.top)  / rect.height * vb.height + vb.y
      const pos  = converterRef.current(svgX, svgY)
      if (!pos) return

      if (item.kind === 'ball') {
        onPlaceBallRef.current?.(pos)
      } else {
        onPlace(item.player.id, pos)
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)
    }
  }, [svgRef, onPlace, updateGhostPos])

  const startDrag = useCallback((player: Player, clientX: number, clientY: number) => {
    dragging.current = { kind: 'player', player }
    const el = ghostRef.current
    if (!el) return
    el.style.background  = player.team === 'AGR' ? '#dc2626' : '#f0f0f0'
    el.style.color       = player.team === 'AGR' ? '#ffffff' : '#111111'
    el.style.borderColor = player.team === 'AGR' ? '#991b1b' : '#444444'
    const span = el.querySelector<HTMLSpanElement>('[data-num]')
    if (span) { span.textContent = String(player.number); span.style.fontSize = '14px' }
    el.style.display = 'flex'
    updateGhostPos(clientX, clientY)
  }, [updateGhostPos])

  const startBallDrag = useCallback((clientX: number, clientY: number) => {
    dragging.current = { kind: 'ball' }
    const el = ghostRef.current
    if (!el) return
    el.style.background  = '#c8860a'
    el.style.borderColor = '#7c5410'
    el.style.color       = 'transparent'
    const span = el.querySelector<HTMLSpanElement>('[data-num]')
    if (span) { span.textContent = '🏉'; span.style.fontSize = '18px' }
    el.style.display = 'flex'
    updateGhostPos(clientX, clientY)
  }, [updateGhostPos])

  return { ghostRef, startDrag, startBallDrag }
}
