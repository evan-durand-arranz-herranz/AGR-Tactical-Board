import { useState } from 'react'
import { X, Plus, Copy, Trash2, Star } from 'lucide-react'
import { useTacticalStore } from '../../store/tacticalStore'
import { useUIStore } from '../../store/uiStore'
import type { Phase } from '../../types'

const PHASE_LABELS: Record<Phase, string> = {
  scrum:   'Mêlée',
  lineout: 'Touche',
  kickoff: "Coup d'envoi",
  open:    'Jeu ouvert',
  defense: 'Défense',
}

export default function LibraryPanel() {
  const { isLibraryOpen, toggleLibrary } = useUIStore()
  const {
    library, activeCombinationId,
    createCombination, deleteCombination, duplicateCombination,
    setActiveCombination, updateCombinationMeta,
  } = useTacticalStore()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (!isLibraryOpen) return null

  const sorted = [...library.combinations].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col z-40 border-l border-white/10"
      style={{ width: 272, background: '#1a1d2e' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div>
          <p className="text-white font-bold text-sm" style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.03em' }}>
            Bibliothèque
          </p>
          <p className="text-gray-500 text-xs">
            {library.combinations.length} combinaison{library.combinations.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={toggleLibrary}
          title="Fermer"
          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Combinations list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.map(combo => {
          const isActive = combo.id === activeCombinationId
          return (
            <div
              key={combo.id}
              onClick={() => { if (!isActive) { setActiveCombination(combo.id); setConfirmDelete(null) } }}
              className={`rounded-lg p-3 cursor-pointer transition-all border ${
                isActive
                  ? 'bg-red-950/30 border-red-500/40'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-white/80'}`}
                    style={{ fontFamily: 'Rajdhani, sans-serif' }}
                  >
                    {combo.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {PHASE_LABELS[combo.phase]} · {combo.frames.length} frame{combo.frames.length > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      updateCombinationMeta(combo.id, { isFavorite: !combo.isFavorite })
                    }}
                    title={combo.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={`p-1 rounded transition-colors ${
                      combo.isFavorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'
                    }`}
                  >
                    <Star size={12} fill={combo.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); duplicateCombination(combo.id) }}
                    title="Dupliquer"
                    className="p-1 rounded text-gray-600 hover:text-white transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                  {library.combinations.length > 1 && (
                    confirmDelete === combo.id ? (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          deleteCombination(combo.id)
                          setConfirmDelete(null)
                        }}
                        title="Confirmer la suppression"
                        className="px-1.5 py-1 rounded bg-red-600/40 text-red-300 hover:bg-red-600 hover:text-white transition-colors text-xs font-bold"
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(combo.id) }}
                        title="Supprimer"
                        className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )
                  )}
                </div>
              </div>

              {isActive && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-400">En cours d'édition</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={() => createCombination()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-bold transition-colors"
          style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.03em' }}
        >
          <Plus size={15} />
          Nouvelle combinaison
        </button>
      </div>
    </div>
  )
}
