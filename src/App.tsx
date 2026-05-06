import { useEffect, useCallback, useRef } from 'react'
import { useTacticalStore } from './store/tacticalStore'
import { useUIStore } from './store/uiStore'
import type { Combination, Player, Position } from './types'
import { useAnimation } from './hooks/useAnimation'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useDragToPlace } from './hooks/useDragToPlace'
import RugbyField, { fullSVGToNorm, halfSVGToNorm } from './components/Field/RugbyField'
import MainToolbar from './components/Toolbar/MainToolbar'
import Timeline from './components/Timeline/Timeline'
import PlayerPool from './components/Panels/PlayerPool'
import LibraryPanel from './components/Panels/LibraryPanel'
import ExportModal from './components/Modals/ExportModal'

// ─── Barre de frame + toggle vue ─────────────────────────────────────────────

function FrameLabelBar({ label, index, total }: { label: string; index: number; total: number }) {
  const { fieldView, setFieldView } = useUIStore()
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 flex-shrink-0"
      style={{ background: '#12151f' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Frame</span>
        <span className="text-xs font-bold text-red-500 bg-red-950/40 px-2 py-0.5 rounded">
          {index + 1} / {total}
        </span>
        <span className="text-sm font-semibold text-white/80 ml-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          {label}
        </span>
      </div>

      {/* Toggle vue */}
      <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-white/10">
        <button onClick={() => setFieldView('full')}
          className={`px-3 py-1 text-xs font-semibold transition-colors ${fieldView === 'full' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
          Terrain complet
        </button>
        <button onClick={() => setFieldView('half')}
          className={`px-3 py-1 text-xs font-semibold transition-colors ${fieldView === 'half' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
          Demi-terrain
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-600">
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded">Espace</kbd> Play
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded">← →</kbd> Frames
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded">Ctrl+Z</kbd> Annuler
      </div>
    </div>
  )
}

// ─── Banc des joueurs cachés ──────────────────────────────────────────────────

function BenchStrip({ combo }: { combo: Combination }) {
  const togglePlayerHidden = useTacticalStore(s => s.togglePlayerHidden)
  const hiddenPlayers = combo.players.filter(p => combo.hiddenPlayerIds?.includes(p.id))

  if (hiddenPlayers.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-t border-white/5 flex-shrink-0"
      style={{ background: '#0d101a' }}
    >
      <span className="text-xs text-gray-600 mr-1 flex-shrink-0">Banc :</span>
      {hiddenPlayers.map(p => (
        <button
          key={p.id}
          onClick={() => togglePlayerHidden(p.id)}
          title={`Remettre le ${p.number} sur le terrain`}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all hover:scale-110 ${
            p.team === 'AGR'
              ? 'bg-red-950/60 border-red-700/50 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500'
              : 'bg-white/5 border-white/15 text-gray-500 hover:bg-white/20 hover:text-white'
          }`}
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          {p.number}
        </button>
      ))}
    </div>
  )
}

// ─── Ghost player ─────────────────────────────────────────────────────────────

function GhostPlayer({ ghostRef }: { ghostRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={ghostRef} style={{
      position: 'fixed', top: 0, left: 0,
      width: 36, height: 36, borderRadius: '50%',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 9999,
      border: '2px solid #991b1b',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      opacity: 0.92,
    }}>
      <span data-num style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif', userSelect: 'none' }} />
    </div>
  )
}

// ─── Layout partagé (normal + présentation) ───────────────────────────────────

function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {children}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const combo              = useTacticalStore(s => s.getActiveCombination())
  const placePlayer        = useTacticalStore(s => s.placePlayer)
  const placeBall          = useTacticalStore(s => s.placeBall)
  const togglePlayerHidden = useTacticalStore(s => s.togglePlayerHidden)

  const { activeFrameId, setActiveFrameId, isPresentationMode, fieldView, isExportModalOpen, toggleExportModal } = useUIStore()

  const { startAnimation, stopAnimation } = useAnimation()

  const svgRef = useRef<SVGSVGElement>(null)

  // Converter fieldView-aware : full ou demi selon le mode courant
  const toFieldPos = useCallback((svgX: number, svgY: number): Position | null => {
    if (fieldView === 'half') {
      return halfSVGToNorm(svgX, svgY)
    }
    return fullSVGToNorm(svgX, svgY)
  }, [fieldView])

  const handlePlace = useCallback((playerId: string, pos: Position) => {
    placePlayer(playerId, pos)
  }, [placePlayer])

  const handleBallPlace = useCallback((pos: Position) => {
    placeBall(pos)
  }, [placeBall])

  const { ghostRef, startDrag, startBallDrag } = useDragToPlace(svgRef, toFieldPos, handlePlace, handleBallPlace)

  const handlePoolDragStart = useCallback((player: Player, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    startDrag(player, e.clientX, e.clientY)
  }, [startDrag])

  const handlePoolBallDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    startBallDrag(e.clientX, e.clientY)
  }, [startBallDrag])

  const handleBenchFromPool = useCallback((player: Player) => {
    togglePlayerHidden(player.id)
  }, [togglePlayerHidden])

  // Frame initiale
  useEffect(() => {
    if (combo && !activeFrameId) {
      const first = combo.frames.find(f => f.order === 0) ?? combo.frames[0]
      if (first) setActiveFrameId(first.id)
    }
  }, [combo?.id, activeFrameId, setActiveFrameId])

  const frames      = combo ? [...combo.frames].sort((a, b) => a.order - b.order) : []
  const activeFrame = frames.find(f => f.id === activeFrameId) ?? frames[0]
  const activeIndex = frames.findIndex(f => f.id === activeFrame?.id)
  const prevFrame   = activeIndex > 0 ? frames[activeIndex - 1] : undefined

  const handlePlay = useCallback(() => {
    if (!combo || frames.length < 2) return
    startAnimation(frames, Math.max(0, activeIndex))
  }, [combo, frames, activeIndex, startAnimation])

  const handlePause = useCallback(() => {
    useUIStore.getState().setIsPlaying(false)
  }, [])

  const handleStop = useCallback(() => {
    stopAnimation()
    if (frames[0]) setActiveFrameId(frames[0].id)
  }, [stopAnimation, frames, setActiveFrameId])

  useKeyboardShortcuts(handlePlay, handlePause, handleStop)

  if (!combo || !activeFrame) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0d14' }}>
        <div className="text-gray-500 text-sm">Chargement…</div>
      </div>
    )
  }

  // ── Mode présentation ────────────────────────────────────────────────────

  if (isPresentationMode) {
    return (
      <div className="w-full h-full flex flex-col" style={{ background: '#0a0d14', overflow: 'hidden', position: 'relative' }}>
        <FieldLayout>
          {/* Pool aussi disponible en présentation */}
          <PlayerPool combo={combo} frame={activeFrame} onStartDrag={handlePoolDragStart} onStartBallDrag={handlePoolBallDragStart} onBench={handleBenchFromPool} />

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden flex items-center justify-center p-3">
              <RugbyField ref={svgRef} frame={activeFrame} prevFrame={prevFrame} players={combo.players} fieldView={fieldView} />
            </div>
            <BenchStrip combo={combo} />
          </div>
        </FieldLayout>

        {/* Barre minimale avec sortie */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 flex-shrink-0"
          style={{ background: '#0a0d14' }}>
          <Timeline onPlay={handlePlay} onPause={handlePause} onStop={handleStop} />
          <button
            onClick={() => useUIStore.getState().togglePresentationMode()}
            className="text-xs text-gray-500 hover:text-white transition-colors ml-4 flex-shrink-0"
            title="Quitter présentation (Échap)"
          >
            Échap — Quitter présentation
          </button>
        </div>

        <GhostPlayer ghostRef={ghostRef} />
        <LibraryPanel />
        {isExportModalOpen && (
          <ExportModal combo={combo} frames={frames} players={combo.players} onClose={toggleExportModal} />
        )}
      </div>
    )
  }

  // ── Mode normal ──────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0a0d14', overflow: 'hidden', position: 'relative' }}>
      <MainToolbar />
      <FrameLabelBar label={activeFrame.label} index={activeIndex} total={frames.length} />

      <FieldLayout>
        <PlayerPool combo={combo} frame={activeFrame} onStartDrag={handlePoolDragStart} onStartBallDrag={handlePoolBallDragStart} onBench={handleBenchFromPool} />

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden flex items-center justify-center p-3">
            <RugbyField ref={svgRef} frame={activeFrame} prevFrame={prevFrame} players={combo.players} fieldView={fieldView} />
          </div>
          <BenchStrip combo={combo} />
        </div>
      </FieldLayout>

      <Timeline onPlay={handlePlay} onPause={handlePause} onStop={handleStop} />

      <GhostPlayer ghostRef={ghostRef} />
      <LibraryPanel />
      {isExportModalOpen && (
        <ExportModal combo={combo} frames={frames} players={combo.players} onClose={toggleExportModal} />
      )}
    </div>
  )
}
