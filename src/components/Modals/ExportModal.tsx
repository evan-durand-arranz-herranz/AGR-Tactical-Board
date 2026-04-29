import { useState, useCallback } from 'react'
import { X, Video, Download, Loader2 } from 'lucide-react'
import type { Combination, Frame, Player } from '../../types'

interface ExportModalProps {
  combo: Combination
  frames: Frame[]
  players: Player[]
  onClose: () => void
}

export default function ExportModal({ combo, frames, players, onClose }: ExportModalProps) {
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const sortedFrames = [...frames].sort((a, b) => a.order - b.order)
  const totalMs = sortedFrames.slice(0, -1).reduce((s, f) => s + f.duration / speed, 0)
  const videoSecs = (totalMs / 1000).toFixed(1)

  const handleExport = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress(0)
    try {
      const { exportVideo } = await import('../../utils/exportHelpers')
      await exportVideo(sortedFrames, players, combo, speed, p => setProgress(p))
      onClose()
    } catch (err) {
      console.error(err)
      setError("Une erreur est survenue lors de l'export.")
    } finally {
      setLoading(false)
    }
  }, [speed, sortedFrames, players, combo, onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[400px] rounded-2xl border border-white/10 p-6"
        style={{ background: '#1a1d2e', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-red-500" />
            <p className="text-white font-bold text-base" style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em' }}>
              Exporter — {combo.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Options */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-5 space-y-3">
          <div>
            <p className="text-gray-500 text-xs mb-2">Vitesse de lecture</p>
            <div className="flex gap-1.5">
              {([0.5, 1, 1.5, 2] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    speed === s
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <Row label="Format" value="Vidéo 1080p (1920 × 1080)" />
          <Row label="Qualité" value="16 Mbps / 60 fps" />
          <Row label="Durée" value={`~${videoSecs}s`} />
        </div>

        {/* Progress bar */}
        {loading && (
          <div className="mb-4">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-gray-500 text-xs text-center mt-1.5">{Math.round(progress * 100)}%</p>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-red-400 text-xs mb-4 text-center">{error}</p>}

        {/* Action button */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.03em' }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Enregistrement en cours…
            </>
          ) : (
            <>
              <Download size={16} />
              Enregistrer la vidéo
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  )
}
