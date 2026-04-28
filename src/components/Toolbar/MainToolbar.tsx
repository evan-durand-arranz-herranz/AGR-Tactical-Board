import { useState } from 'react'
import {
  MousePointer2, ArrowRight, Eraser, BookOpen, Maximize2,
  RotateCcw, RotateCw,
} from 'lucide-react'
import type { Tool } from '../../types'
import { useUIStore } from '../../store/uiStore'
import { useTacticalStore } from '../../store/tacticalStore'

const TOOLS: Array<{ id: Tool; icon: React.ElementType; label: string; shortcut?: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Sélection', shortcut: 'V' },
  { id: 'arrow',  icon: ArrowRight,    label: 'Flèche',    shortcut: 'A' },
  { id: 'erase',  icon: Eraser,        label: 'Effacer',   shortcut: 'E' },
]

function ToolButton({ tool, isActive, onClick }: {
  tool: typeof TOOLS[0]; isActive: boolean; onClick: () => void
}) {
  const Icon = tool.icon
  return (
    <button
      onClick={onClick}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      className={`
        flex flex-col items-center gap-0.5 p-2 rounded-lg transition-all duration-150
        ${isActive
          ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
          : 'text-gray-400 hover:text-white hover:bg-white/10'}
      `}
    >
      <Icon size={16} />
      <span className="text-xs leading-none" style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px' }}>
        {tool.label.split(' ')[0]}
      </span>
    </button>
  )
}

// ─── AGR Logo ─────────────────────────────────────────────────────────────────

function AGRLogo() {
  return (
    <div className="flex items-center gap-2 pr-4 border-r border-white/10">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#dc2626" />
        <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="Rajdhani, sans-serif">AGR</text>
      </svg>
      <div>
        <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Tactical Board
        </p>
        <p className="text-gray-500 text-xs leading-tight">v1.0</p>
      </div>
    </div>
  )
}

// ─── Combination name editor ──────────────────────────────────────────────────

function CombinationTitle() {
  const combo = useTacticalStore(s => s.getActiveCombination())
  const updateMeta = useTacticalStore(s => s.updateCombinationMeta)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  if (!combo) return null

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim()) updateMeta(combo.id, { name: val.trim() })
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="bg-white/10 text-white px-2 py-1 rounded text-sm font-semibold border border-white/20 focus:outline-none focus:border-red-500 w-48"
      />
    )
  }

  return (
    <button
      onClick={() => { setVal(combo.name); setEditing(true) }}
      className="text-white font-semibold text-sm hover:text-red-400 transition-colors"
      style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em' }}
    >
      {combo.name}
    </button>
  )
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export default function MainToolbar() {
  const { activeTool, setActiveTool, toggleLibrary, togglePresentationMode } = useUIStore()
  const { undo, redo, past, future } = useTacticalStore()

  return (
    <div
      className="h-14 flex items-center gap-3 px-4 border-b border-white/5 flex-shrink-0"
      style={{ background: '#1a1d2e' }}
    >
      {/* Logo */}
      <AGRLogo />

      {/* Combination title */}
      <CombinationTitle />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        {TOOLS.map(tool => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={past.length === 0}
          title="Annuler (Ctrl+Z)"
          className="p-2 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={15} />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title="Rétablir (Ctrl+Y)"
          className="p-2 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCw size={15} />
        </button>

        <div className="w-px h-5 bg-white/10" />

        {/* Library */}
        <button
          onClick={toggleLibrary}
          title="Bibliothèque"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-gray-300 hover:text-white hover:bg-white/10 text-sm transition-colors"
        >
          <BookOpen size={15} /> <span className="text-xs">Bibliothèque</span>
        </button>

        {/* Presentation mode */}
        <button
          onClick={togglePresentationMode}
          title="Mode présentation (plein écran)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm transition-colors"
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  )
}
