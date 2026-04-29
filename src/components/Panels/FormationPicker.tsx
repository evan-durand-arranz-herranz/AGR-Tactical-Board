import { useUIStore } from '../../store/uiStore'
import { useTacticalStore } from '../../store/tacticalStore'
import { FORMATIONS, buildFormationPositions } from '../../utils/formations'
import type { FormationName } from '../../utils/formations'

const FORMATION_ORDER: FormationName[] = [
  'scrum',
  'lineout',
  'kickoff_give',
  'kickoff_receive',
  'open',
  'defense_line',
  'defense_man',
]

export default function FormationPicker() {
  const { isFormationPickerOpen, toggleFormationPicker, activeFrameId } = useUIStore()
  const { getActiveCombination, applyFormation } = useTacticalStore()

  if (!isFormationPickerOpen) return null

  const combo = getActiveCombination()
  if (!combo || !activeFrameId) return null

  const apply = (name: FormationName) => {
    const positions = buildFormationPositions(combo.players, name)
    applyFormation(activeFrameId, positions)
    toggleFormationPicker()
  }

  return (
    <div
      className="absolute z-50 flex flex-col gap-1 p-2 rounded-xl border border-white/10"
      style={{
        top: 57,         // juste sous la toolbar (h-14 = 56px)
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1d2e',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        minWidth: 480,
      }}
    >
      <p className="text-gray-500 text-xs px-2 pb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
        Appliquer une formation à la frame active
      </p>
      <div className="flex flex-wrap gap-1.5">
        {FORMATION_ORDER.map(name => {
          const def = FORMATIONS[name]
          return (
            <button
              key={name}
              onClick={() => apply(name)}
              className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-red-600/20 hover:border-red-500/40 border border-white/10 text-white text-xs font-semibold transition-all"
              style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em', minWidth: 100 }}
            >
              {def.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
