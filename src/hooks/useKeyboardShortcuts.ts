import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { useTacticalStore } from '../store/tacticalStore'
import type { Tool } from '../types'

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  a: 'arrow',
  e: 'erase',
}

export function useKeyboardShortcuts(
  onPlay: () => void,
  onPause: () => void,
  onStop: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focused on an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const ui = useUIStore.getState()
      const tactical = useTacticalStore.getState()
      const combo = tactical.getActiveCombination()
      if (!combo) return

      const frames = [...combo.frames].sort((a, b) => a.order - b.order)
      const activeIdx = frames.findIndex(f => f.id === ui.activeFrameId)

      // Ctrl / Cmd combos
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            tactical.undo()
            return
          case 'y':
            e.preventDefault()
            tactical.redo()
            return
          case 's':
            e.preventDefault()
            // Save is localStorage-backed in Phase 5; no-op for now
            return
        }
      }

      // Single key shortcuts
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (ui.isPlaying) onPause()
          else onPlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (!ui.isPlaying && activeIdx > 0) {
            ui.setActiveFrameId(frames[activeIdx - 1].id)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (!ui.isPlaying && activeIdx < frames.length - 1) {
            ui.setActiveFrameId(frames[activeIdx + 1].id)
          }
          break
        case 'Delete':
        case 'Backspace':
          // Delete selected element
          if (ui.selectedElementId && ui.selectedElementType === 'event' && ui.activeFrameId) {
            tactical.removeEvent(ui.activeFrameId, ui.selectedElementId)
            ui.clearSelection()
          }
          break
        case 'Escape':
          // Quitter le mode présentation si actif, sinon désélectionner
          if (ui.isPresentationMode) {
            ui.togglePresentationMode()
          } else {
            ui.clearSelection()
          }
          break
        default: {
          const tool = TOOL_KEYS[e.key.toLowerCase()]
          if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
            ui.setActiveTool(tool)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onPlay, onPause, onStop])
}
