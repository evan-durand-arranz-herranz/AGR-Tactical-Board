import type { Player } from '../../types'

const RADIUS = 16
const FONT_SIZE = 13
const NAME_FONT_SIZE = 10

interface PlayerTokenProps {
  player: Player
  cx: number
  cy: number
}

export default function PlayerToken({ player, cx, cy }: PlayerTokenProps) {
  const isAGR      = player.team === 'AGR'
  const fill       = isAGR ? '#dc2626' : '#f0f0f0'
  const stroke     = isAGR ? '#991b1b' : '#444444'
  const numberFill = isAGR ? '#ffffff' : '#111111'

  return (
    <g data-player-id={player.id} style={{ userSelect: 'none' }}>
      <circle cx={cx} cy={cy} r={RADIUS} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={numberFill} fontSize={FONT_SIZE} fontWeight="700" fontFamily="Rajdhani, sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {player.number}
      </text>
      {player.name && (
        <text
          x={cx} y={cy + RADIUS + NAME_FONT_SIZE + 1}
          textAnchor="middle"
          fill={isAGR ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'}
          fontSize={NAME_FONT_SIZE} fontFamily="Inter, sans-serif" fontWeight="500"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {player.name}
        </text>
      )}
    </g>
  )
}
