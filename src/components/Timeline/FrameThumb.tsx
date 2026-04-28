import React, { useState, useRef, useEffect } from 'react'
import { Copy, Trash2, Clock } from 'lucide-react'
import type { Frame, Player } from '../../types'
import { useTacticalStore } from '../../store/tacticalStore'

interface FrameThumbProps {
  frame: Frame
  players: Player[]
  index: number
  isActive: boolean
  onClick: () => void
  onDuplicate: () => void
  onDelete: () => void
  canDelete: boolean
}

// ─── Miniature SVG ────────────────────────────────────────────────────────────

function FrameMiniature({ frame, players }: { frame: Frame; players: Player[] }) {
  const scaleX = (x: number) => (x / 100) * 120
  const scaleY = (y: number) => (y / 100) * 84

  return (
    <svg viewBox="0 0 120 84" width={120} height={84} style={{ display: 'block' }}>
      {/* En-buts */}
      <rect width={120} height={84} fill="#2e5520" />
      {/* Terrain */}
      <rect x={12} width={96} height={84} fill="#4a7c3f" />
      {/* Lignes simplifiées */}
      <line x1={12}  y1={0} x2={12}  y2={84} stroke="rgba(255,255,255,0.6)" strokeWidth={0.9} />
      <line x1={108} y1={0} x2={108} y2={84} stroke="rgba(255,255,255,0.6)" strokeWidth={0.9} />
      <line x1={60}  y1={0} x2={60}  y2={84} stroke="rgba(255,255,255,0.35)" strokeWidth={0.7} />
      <line x1={34}  y1={0} x2={34}  y2={84} stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
      <line x1={86}  y1={0} x2={86}  y2={84} stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
      <line x1={20}  y1={0} x2={20}  y2={84} stroke="rgba(255,255,255,0.18)" strokeWidth={0.4} />
      <line x1={100} y1={0} x2={100} y2={84} stroke="rgba(255,255,255,0.18)" strokeWidth={0.4} />
      {/* Joueurs */}
      {players.map(player => {
        const pos = frame.positions[player.id]
        if (!pos) return null
        if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) return null
        return (
          <circle key={player.id}
            cx={scaleX(pos.x)} cy={scaleY(pos.y)} r={3.5}
            fill={player.team === 'AGR' ? '#dc2626' : '#f0f0f0'}
            stroke={player.team === 'AGR' ? '#991b1b' : '#666'}
            strokeWidth={0.5}
          />
        )
      })}
    </svg>
  )
}

// ─── FrameThumb ───────────────────────────────────────────────────────────────

export default function FrameThumb({
  frame, players, index, isActive, onClick, onDuplicate, onDelete, canDelete,
}: FrameThumbProps) {
  const { updateFrameLabel, updateFrameDuration } = useTacticalStore()
  const [editingLabel, setEditingLabel] = useState(false)
  const [showDuration, setShowDuration] = useState(false)
  const [labelDraft, setLabelDraft] = useState(frame.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelDraft(frame.label) }, [frame.label])

  useEffect(() => {
    if (editingLabel && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingLabel])

  const commitLabel = () => {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== frame.label) updateFrameLabel(frame.id, trimmed)
    else setLabelDraft(frame.label)
    setEditingLabel(false)
  }

  const durationSec = (frame.duration / 1000).toFixed(1)

  return (
    <div className={`
      relative flex-shrink-0 w-32 rounded-lg overflow-hidden cursor-pointer transition-all duration-150
      ${isActive
        ? 'ring-2 ring-red-500 shadow-lg shadow-red-900/40'
        : 'ring-1 ring-white/10 hover:ring-white/25'}
    `}
      onClick={onClick}
    >
      <FrameMiniature frame={frame} players={players} />

      {/* Overlay */}
      <div className={`
        absolute inset-0 flex flex-col justify-between p-1.5
        ${isActive ? 'bg-red-950/20' : 'bg-black/30 hover:bg-black/20'}
        transition-colors duration-150
      `}>
        {/* Top row: index + action buttons */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white bg-black/50 rounded px-1 leading-5">
            {index + 1}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); setShowDuration(v => !v) }}
              title="Durée de transition"
              className="p-0.5 rounded bg-black/60 text-white/70 hover:text-blue-300 hover:bg-black/90"
            >
              <Clock size={10} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDuplicate() }}
              title="Dupliquer"
              className="p-0.5 rounded bg-black/60 text-white/70 hover:text-white hover:bg-black/90"
            >
              <Copy size={10} />
            </button>
            {canDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                title="Supprimer"
                className="p-0.5 rounded bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/90"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom: label (editable) */}
        <div>
          {editingLabel ? (
            <input
              ref={inputRef}
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') { setLabelDraft(frame.label); setEditingLabel(false) }
                e.stopPropagation()
              }}
              onClick={e => e.stopPropagation()}
              className="w-full text-xs text-white font-medium bg-black/70 border border-red-500/60 rounded px-1 py-0.5 outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          ) : (
            <p
              className="text-xs text-white/90 font-medium truncate leading-tight hover:text-white cursor-text"
              onDoubleClick={e => { e.stopPropagation(); setEditingLabel(true) }}
              title="Double-clic pour renommer"
            >
              {frame.label}
            </p>
          )}

          {/* Duration control */}
          {showDuration && (
            <div className="mt-1" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={500} max={5000} step={250}
                  value={frame.duration}
                  onChange={e => updateFrameDuration(frame.id, Number(e.target.value))}
                  className="flex-1 h-1 accent-red-500"
                />
                <span className="text-xs text-red-400 tabular-nums w-8 text-right">{durationSec}s</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
