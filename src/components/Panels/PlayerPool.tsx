import type { Combination, Frame, Team, Player } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne les joueurs encore dans le pool (pas placés ET pas au banc) */
export function getPoolPlayers(combo: Combination, frame: Frame, team: Team): Player[] {
  const hidden = combo.hiddenPlayerIds ?? []
  return combo.players
    .filter(p => p.team === team && frame.positions[p.id] === undefined && !hidden.includes(p.id))
    .sort((a, b) => a.number - b.number)
}

// ─── Pool circle ──────────────────────────────────────────────────────────────

interface PoolCircleProps {
  team: Team
  nextPlayer: Player | null
  remaining: number
  onPointerDown: (player: Player, e: React.PointerEvent<HTMLDivElement>) => void
  onBench: (player: Player) => void
}

function PoolCircle({ team, nextPlayer, remaining, onPointerDown, onBench }: PoolCircleProps) {
  const isAGR = team === 'AGR'

  const bg       = isAGR ? '#dc2626' : '#f0f0f0'
  const border   = isAGR ? '#991b1b' : '#444444'
  const numCol   = isAGR ? '#ffffff' : '#111111'
  const label    = isAGR ? 'AGR'     : 'ADV'
  const labelCol = isAGR ? '#dc2626' : '#9ca3af'

  if (!nextPlayer) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs font-bold tracking-wider" style={{ color: labelCol, fontFamily: 'Rajdhani, sans-serif' }}>
          {label}
        </p>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'transparent',
          border: `2px solid ${isAGR ? 'rgba(220,38,38,0.2)' : 'rgba(150,150,150,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '10px', color: '#4b5563' }}>—</span>
        </div>
        <p style={{ fontSize: '10px', color: '#4b5563', fontFamily: 'Inter' }}>Complet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <p className="text-xs font-bold tracking-wider" style={{ color: labelCol, fontFamily: 'Rajdhani, sans-serif' }}>
        {label}
      </p>

      {/* Cercle : drag → place sur terrain, clic → banc */}
      <div
        title={`Glisser pour placer · Clic pour mettre au banc`}
        onPointerDown={e => onPointerDown(nextPlayer, e)}
        onClick={() => onBench(nextPlayer)}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: bg,
          border: `2px solid ${border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'grab',
          transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLDivElement).style.transform = 'scale(1.12)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = isAGR
            ? '0 0 12px 2px rgba(220,38,38,0.5)'
            : '0 0 12px 2px rgba(200,200,200,0.3)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        }}
      >
        <span style={{
          color: numCol, fontSize: 14, fontWeight: 700,
          fontFamily: 'Rajdhani, sans-serif', lineHeight: 1, userSelect: 'none',
        }}>
          {nextPlayer.number}
        </span>
      </div>

      <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'Inter' }}>
        {remaining} restant{remaining > 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ─── Ball token draggable ─────────────────────────────────────────────────────

function BallToken({ onPointerDown }: { onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <p style={{ fontSize: '10px', color: '#f59e0b', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, letterSpacing: '0.1em', userSelect: 'none' }}>
        BALLON
      </p>
      <div
        onPointerDown={onPointerDown}
        style={{
          width: 40, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'grab', touchAction: 'none', userSelect: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
      >
        <svg width="36" height="24" viewBox="-18 -12 36 24" style={{ overflow: 'visible' }}>
          <ellipse rx={17} ry={11} fill="#c8860a" stroke="#7c5410" strokeWidth={1.5} />
          <ellipse rx={6} ry={10} fill="none" stroke="#7c5410" strokeWidth={0.8} />
          <line x1={0} y1={-11} x2={0} y2={11} stroke="#7c5410" strokeWidth={0.8} />
        </svg>
      </div>
    </div>
  )
}

// ─── PlayerPool ───────────────────────────────────────────────────────────────

interface PlayerPoolProps {
  combo: Combination
  frame: Frame
  onStartDrag: (player: Player, e: React.PointerEvent<HTMLDivElement>) => void
  onStartBallDrag: (e: React.PointerEvent<HTMLDivElement>) => void
  onBench: (player: Player) => void
}

export default function PlayerPool({ combo, frame, onStartDrag, onStartBallDrag, onBench }: PlayerPoolProps) {
  const agrPool = getPoolPlayers(combo, frame, 'AGR')
  const oppPool = getPoolPlayers(combo, frame, 'opponent')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 24,
      padding: '12px 8px',
      background: '#12151f',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      width: 64,
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      <p style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontSize: '10px',
        color: '#4b5563',
        letterSpacing: '0.1em',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        userSelect: 'none',
      }}>
        JOUEURS
      </p>

      <PoolCircle
        team="AGR"
        nextPlayer={agrPool[0] ?? null}
        remaining={agrPool.length}
        onPointerDown={onStartDrag}
        onBench={onBench}
      />

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.06)' }} />

      <PoolCircle
        team="opponent"
        nextPlayer={oppPool[0] ?? null}
        remaining={oppPool.length}
        onPointerDown={onStartDrag}
        onBench={onBench}
      />

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.06)' }} />

      <BallToken onPointerDown={onStartBallDrag} />
    </div>
  )
}
