import { useState } from 'react'
import {
  MousePointer2, ArrowRight, Eraser, BookOpen, Maximize2,
  RotateCcw, RotateCw, Download, FolderOpen, Save, SaveAll, Pencil,
} from 'lucide-react'
import type { Tool } from '../../types'
import { useUIStore } from '../../store/uiStore'
import { useTacticalStore } from '../../store/tacticalStore'
import { saveFile, saveFileAs, openFile } from '../../utils/fileHelpers'

const TOOLS: Array<{ id: Tool; icon: React.ElementType; label: string; shortcut?: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Sélection', shortcut: 'V' },
  { id: 'arrow',  icon: ArrowRight,    label: 'Flèche',    shortcut: 'A' },
  { id: 'zone',   icon: Pencil,        label: 'Zone',      shortcut: 'Z' },
  { id: 'erase',  icon: Eraser,        label: 'Effacer',   shortcut: 'E' },
]

const ZONE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ffffff']

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
        <p className="text-gray-500 text-xs leading-tight">v1.10</p>
      </div>
    </div>
  )
}

// ─── Combination name editor ──────────────────────────────────────────────────

function CombinationTitle() {
  const combo = useTacticalStore(s => s.getActiveCombination())
  const updateMeta = useTacticalStore(s => s.updateCombinationMeta)
  const { lastSavedCombinationId, lastSavedUpdatedAt } = useUIStore()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  if (!combo) return null

  const isDirty = lastSavedCombinationId === combo.id && lastSavedUpdatedAt !== combo.updatedAt

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
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => { setVal(combo.name); setEditing(true) }}
        className="text-white font-semibold text-sm hover:text-red-400 transition-colors"
        style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em' }}
      >
        {combo.name}
      </button>
      {isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" title="Modifications non sauvegardées" />
      )}
    </div>
  )
}

// ─── File actions ─────────────────────────────────────────────────────────────

function FileActions() {
  const combo = useTacticalStore(s => s.getActiveCombination())
  const { currentFilePath, lastSavedCombinationId, lastSavedUpdatedAt } = useUIStore()

  if (!combo) return null

  const hasFile = !!currentFilePath && lastSavedCombinationId === combo.id
  const isDirty = hasFile && lastSavedUpdatedAt !== combo.updatedAt

  return (
    <div className="flex items-center gap-1">
      {/* Ouvrir */}
      <button
        onClick={openFile}
        title="Ouvrir un fichier .agr"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 text-xs transition-colors"
      >
        <FolderOpen size={14} />
        <span>Ouvrir</span>
      </button>

      {/* Sauvegarder */}
      <button
        onClick={saveFile}
        title={hasFile ? 'Sauvegarder (Ctrl+S)' : 'Sauvegarder sous… (Ctrl+S)'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
          isDirty
            ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 hover:text-orange-200'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Save size={14} />
        <span>Sauvegarder</span>
      </button>

      {/* Sauvegarder sous */}
      <button
        onClick={saveFileAs}
        title="Sauvegarder sous… (Ctrl+Shift+S)"
        className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <SaveAll size={13} />
      </button>
    </div>
  )
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export default function MainToolbar() {
  const { activeTool, setActiveTool, toggleLibrary, togglePresentationMode, toggleExportModal,
          zoneColor, setZoneColor } = useUIStore()
  const { undo, redo, past, future } = useTacticalStore()

  return (
    <div
      className="h-14 flex items-center gap-3 px-4 border-b border-white/5 flex-shrink-0"
      style={{ background: '#1a1d2e' }}
    >
      {/* Logo */}
      <AGRLogo />

      {/* Combination title + dirty dot */}
      <CombinationTitle />

      {/* File actions */}
      <div className="border-l border-white/10 pl-3">
        <FileActions />
      </div>

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

      {/* Zone options — visible uniquement quand l'outil zone est actif */}
      {activeTool === 'zone' && (
        <div className="flex items-center gap-1.5 px-3 border-l border-white/10">
          {ZONE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setZoneColor(c)}
              title={c}
              className="w-4 h-4 rounded-full transition-transform hover:scale-125 flex-shrink-0"
              style={{
                background: c,
                outline: zoneColor === c ? '2px solid white' : '2px solid transparent',
                outlineOffset: '1px',
              }}
            />
          ))}
        </div>
      )}

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

        {/* Export */}
        <button
          onClick={toggleExportModal}
          title="Exporter (PDF / Vidéo)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm transition-colors"
        >
          <Download size={15} /> <span className="text-xs">Exporter</span>
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
