import { Play, Pause, Square, SkipBack, SkipForward, RefreshCw } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

interface PlaybackControlsProps {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPrevFrame: () => void
  onNextFrame: () => void
}

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2

export default function PlaybackControls({
  onPlay, onPause, onStop, onPrevFrame, onNextFrame,
}: PlaybackControlsProps) {
  const { isPlaying, playbackSpeed, playbackLoop, setPlaybackSpeed, setPlaybackLoop } = useUIStore()

  const speeds: PlaybackSpeed[] = [0.5, 1, 1.5, 2]

  return (
    <div className="flex items-center gap-2">
      {/* Frame navigation */}
      <button
        onClick={onPrevFrame}
        disabled={isPlaying}
        title="Frame précédente (←)"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <SkipBack size={16} />
      </button>

      {/* Play / Pause */}
      {isPlaying ? (
        <button
          onClick={onPause}
          title="Pause (Espace)"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm transition-colors"
        >
          <Pause size={15} /> Pause
        </button>
      ) : (
        <button
          onClick={onPlay}
          title="Play (Espace)"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors"
          style={{ animation: 'none' }}
        >
          <Play size={15} /> Play
        </button>
      )}

      {/* Stop */}
      <button
        onClick={onStop}
        title="Stop"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Square size={16} />
      </button>

      <button
        onClick={onNextFrame}
        disabled={isPlaying}
        title="Frame suivante (→)"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <SkipForward size={16} />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Speed */}
      <div className="flex items-center gap-1">
        {speeds.map(s => (
          <button
            key={s}
            onClick={() => setPlaybackSpeed(s)}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
              playbackSpeed === s
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Loop */}
      <button
        onClick={() => setPlaybackLoop(!playbackLoop)}
        title="Boucle"
        className={`p-1.5 rounded transition-colors ${playbackLoop ? 'text-red-400 bg-red-400/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
      >
        <RefreshCw size={14} />
      </button>
    </div>
  )
}
