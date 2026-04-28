import { Plus } from 'lucide-react'
import { useTacticalStore } from '../../store/tacticalStore'
import { useUIStore } from '../../store/uiStore'
import FrameThumb from './FrameThumb'
import PlaybackControls from './PlaybackControls'

interface TimelineProps {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

export default function Timeline({ onPlay, onPause, onStop }: TimelineProps) {
  const combo = useTacticalStore(s => s.getActiveCombination())
  const { addFrame, removeFrame, duplicateFrame } = useTacticalStore()
  const { activeFrameId, setActiveFrameId, isPlaying } = useUIStore()

  if (!combo) return null

  const frames = [...combo.frames].sort((a, b) => a.order - b.order)

  const handlePrevFrame = () => {
    const idx = frames.findIndex(f => f.id === activeFrameId)
    if (idx > 0) setActiveFrameId(frames[idx - 1].id)
  }

  const handleNextFrame = () => {
    const idx = frames.findIndex(f => f.id === activeFrameId)
    if (idx < frames.length - 1) setActiveFrameId(frames[idx + 1].id)
  }

  return (
    <div className="h-36 bg-[#0f1117] border-t border-white/5 flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <PlaybackControls
          onPlay={onPlay}
          onPause={onPause}
          onStop={onStop}
          onPrevFrame={handlePrevFrame}
          onNextFrame={handleNextFrame}
        />

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {frames.length} / 10 frames
          </span>
          <button
            onClick={() => {
              const id = addFrame()
              if (id) setActiveFrameId(id)
            }}
            disabled={isPlaying || frames.length >= 10}
            title="Ajouter une frame"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={13} /> Frame
          </button>
        </div>
      </div>

      {/* Frames strip */}
      <div className="flex-1 flex items-center gap-3 px-4 overflow-x-auto group">
        {frames.map((frame, i) => (
          <FrameThumb
            key={frame.id}
            frame={frame}
            players={combo.players}
            index={i}
            isActive={frame.id === activeFrameId}
            onClick={() => !isPlaying && setActiveFrameId(frame.id)}
            onDuplicate={() => {
              const id = duplicateFrame(frame.id)
              if (id) setActiveFrameId(id)
            }}
            onDelete={() => {
              const currentIdx = frames.findIndex(f => f.id === activeFrameId)
              removeFrame(frame.id)
              if (frame.id === activeFrameId) {
                const remaining = frames.filter(f => f.id !== frame.id)
                const next = remaining[Math.max(0, currentIdx - 1)]
                if (next) setActiveFrameId(next.id)
              }
            }}
            canDelete={frames.length > 1}
          />
        ))}
      </div>
    </div>
  )
}
