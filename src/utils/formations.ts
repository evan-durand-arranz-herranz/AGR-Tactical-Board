import type { Combination, Player, Frame, Position } from '../types'

// ─── Field coordinate helpers ─────────────────────────────────────────────────
// All positions are in % (0–100) of the field width/height (including in-goal).
// The playing field (between try lines) occupies x: 10–90 on a 100m pitch
// represented as 0–100%. In-goal zones are x: 0–10 and x: 90–100.

function pos(x: number, y: number): Position { return { x, y } }

// ─── Player factories ─────────────────────────────────────────────────────────

function makePlayer(
  number: number,
  team: 'AGR' | 'opponent',
  bench = false
): Player {
  return {
    id: `${team}-${number}`,
    number,
    team,
    isOnBench: bench,
  }
}

function makePlayers(): Player[] {
  const agr = Array.from({ length: 15 }, (_, i) => makePlayer(i + 1, 'AGR'))
  const agrBench = Array.from({ length: 8 }, (_, i) => makePlayer(i + 16, 'AGR', true))
  const opp = Array.from({ length: 15 }, (_, i) => makePlayer(i + 1, 'opponent'))
  const oppBench = Array.from({ length: 8 }, (_, i) => makePlayer(i + 16, 'opponent', true))
  return [...agr, ...agrBench, ...opp, ...oppBench]
}

// ─── Default open-play positions (% coordinates) ─────────────────────────────
// AGR attacks left → right (positions in left half ~25–45% x)
// Opponent defends (positions in right half ~55–75% x)

const OPEN_PLAY_AGR: Record<number, Position> = {
  1:  pos(35, 60),  // pilier gauche
  2:  pos(35, 50),  // talonneur
  3:  pos(35, 40),  // pilier droit
  4:  pos(33, 55),  // deuxième ligne G
  5:  pos(33, 45),  // deuxième ligne D
  6:  pos(32, 63),  // flanker G
  7:  pos(32, 37),  // flanker D
  8:  pos(30, 50),  // numéro 8
  9:  pos(38, 50),  // demi de mêlée
  10: pos(45, 45),  // demi d'ouverture
  11: pos(42, 72),  // ailier G
  12: pos(50, 50),  // centre G
  13: pos(55, 44),  // centre D
  14: pos(42, 28),  // ailier D
  15: pos(60, 50),  // arrière
}

const OPEN_PLAY_OPP: Record<number, Position> = {
  1:  pos(65, 60),
  2:  pos(65, 50),
  3:  pos(65, 40),
  4:  pos(67, 55),
  5:  pos(67, 45),
  6:  pos(68, 63),
  7:  pos(68, 37),
  8:  pos(70, 50),
  9:  pos(62, 50),
  10: pos(55, 55),
  11: pos(58, 72),
  12: pos(50, 58),
  13: pos(45, 56),
  14: pos(58, 28),
  15: pos(40, 50),
}

// ─── Bench positions (off-field right side) ───────────────────────────────────

const BENCH_AGR: Record<number, Position> = {
  16: pos(105, 10),
  17: pos(105, 20),
  18: pos(105, 30),
  19: pos(105, 40),
  20: pos(105, 50),
  21: pos(105, 60),
  22: pos(105, 70),
  23: pos(105, 80),
}

const BENCH_OPP: Record<number, Position> = {
  16: pos(-5, 10),
  17: pos(-5, 20),
  18: pos(-5, 30),
  19: pos(-5, 40),
  20: pos(-5, 50),
  21: pos(-5, 60),
  22: pos(-5, 70),
  23: pos(-5, 80),
}

// ─── Build default positions record ──────────────────────────────────────────

function buildDefaultPositions(players: Player[]): Record<string, Position> {
  const result: Record<string, Position> = {}
  for (const p of players) {
    const num = p.number
    if (p.team === 'AGR') {
      result[p.id] = p.isOnBench
        ? (BENCH_AGR[num] ?? pos(105, 50))
        : (OPEN_PLAY_AGR[num] ?? pos(40, 50))
    } else {
      result[p.id] = p.isOnBench
        ? (BENCH_OPP[num] ?? pos(-5, 50))
        : (OPEN_PLAY_OPP[num] ?? pos(60, 50))
    }
  }
  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createDefaultCombination(name = 'Nouvelle combinaison'): Combination {
  const players = makePlayers()

  // Terrain vide : aucune position initiale
  const emptyPositions: Record<string, Position> = {}

  const frame1: Frame = {
    id: crypto.randomUUID(),
    order: 0,
    label: 'Entrée de balle',
    duration: 1500,
    positions: emptyPositions,
    events: [],
  }

  return {
    id: crypto.randomUUID(),
    name,
    phase: 'open',
    category: 'attack',
    tags: [],
    isFavorite: false,
    frames: [frame1],
    players,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/** Apply a named formation to a combination's frames (in-place, for store use). */
export function buildFormationPositions(
  players: Player[],
  formation: FormationName,
): Record<string, Position> {
  const def = FORMATIONS[formation]
  const result: Record<string, Position> = {}
  for (const p of players) {
    const num = p.number
    const lookup = p.team === 'AGR' ? def.agr : def.opp
    if (lookup[num]) result[p.id] = { ...lookup[num] }
  }
  return result
}

// ─── Named formations ─────────────────────────────────────────────────────────

export type FormationName =
  | 'open'
  | 'scrum'
  | 'lineout'
  | 'kickoff_give'
  | 'kickoff_receive'
  | 'defense_line'
  | 'defense_man'

export interface FormationDef {
  label: string
  agr: Record<number, Position>
  opp: Record<number, Position>
}

export const FORMATIONS: Record<FormationName, FormationDef> = {
  open: {
    label: 'Jeu courant',
    agr: OPEN_PLAY_AGR,
    opp: OPEN_PLAY_OPP,
  },
  scrum: {
    label: 'Mêlée AGR',
    agr: {
      1: pos(42, 56), 2: pos(42, 50), 3: pos(42, 44),
      4: pos(40, 54), 5: pos(40, 46),
      6: pos(39, 60), 7: pos(39, 40), 8: pos(37, 50),
      9: pos(44, 50),
      10: pos(50, 44), 11: pos(47, 70), 12: pos(54, 50),
      13: pos(58, 44), 14: pos(47, 30), 15: pos(62, 50),
    },
    opp: {
      1: pos(48, 56), 2: pos(48, 50), 3: pos(48, 44),
      4: pos(50, 54), 5: pos(50, 46),
      6: pos(51, 60), 7: pos(51, 40), 8: pos(53, 50),
      9: pos(56, 50),
      10: pos(60, 56), 11: pos(58, 72), 12: pos(64, 50),
      13: pos(68, 44), 14: pos(58, 28), 15: pos(72, 50),
    },
  },
  lineout: {
    label: 'Touche AGR',
    agr: {
      2: pos(40, 50), 4: pos(40, 44), 6: pos(40, 38),
      8: pos(40, 32), 5: pos(40, 56),
      1: pos(37, 50), 3: pos(43, 50),
      7: pos(40, 62),
      9: pos(44, 50), 10: pos(50, 44),
      11: pos(47, 70), 12: pos(54, 50), 13: pos(58, 44),
      14: pos(47, 30), 15: pos(62, 50),
    },
    opp: {
      2: pos(46, 50), 4: pos(46, 44), 6: pos(46, 38),
      8: pos(46, 32), 5: pos(46, 56),
      1: pos(43, 50), 3: pos(49, 50),
      7: pos(46, 62),
      9: pos(52, 50), 10: pos(58, 44),
      11: pos(55, 70), 12: pos(62, 50), 13: pos(66, 44),
      14: pos(55, 30), 15: pos(70, 50),
    },
  },
  kickoff_give: {
    label: 'Coup d\'envoi donné',
    agr: OPEN_PLAY_AGR,
    opp: OPEN_PLAY_OPP,
  },
  kickoff_receive: {
    label: 'Coup d\'envoi reçu',
    agr: {
      1: pos(60, 60), 2: pos(60, 50), 3: pos(60, 40),
      4: pos(58, 55), 5: pos(58, 45),
      6: pos(58, 65), 7: pos(58, 35), 8: pos(56, 50),
      9: pos(62, 50), 10: pos(65, 45),
      11: pos(70, 75), 12: pos(68, 50), 13: pos(68, 44),
      14: pos(70, 25), 15: pos(75, 50),
    },
    opp: {
      1: pos(38, 60), 2: pos(38, 50), 3: pos(38, 40),
      4: pos(36, 55), 5: pos(36, 45),
      6: pos(36, 65), 7: pos(36, 35), 8: pos(34, 50),
      9: pos(40, 50), 10: pos(43, 55),
      11: pos(32, 72), 12: pos(30, 50), 13: pos(30, 44),
      14: pos(32, 28), 15: pos(27, 50),
    },
  },
  defense_line: {
    label: 'Défense en rideau',
    agr: {
      1: pos(55, 30), 2: pos(55, 38), 3: pos(55, 46),
      4: pos(55, 54), 5: pos(55, 62), 6: pos(55, 70),
      7: pos(55, 22), 8: pos(55, 78),
      9: pos(58, 50), 10: pos(60, 42),
      11: pos(60, 80), 12: pos(60, 55), 13: pos(60, 45),
      14: pos(60, 20), 15: pos(65, 50),
    },
    opp: {
      ...OPEN_PLAY_OPP,
      9: pos(45, 50), 10: pos(40, 45),
    },
  },
  defense_man: {
    label: 'Défense homme à homme',
    agr: {
      1: pos(55, 60), 2: pos(55, 50), 3: pos(55, 40),
      4: pos(58, 55), 5: pos(58, 45),
      6: pos(57, 65), 7: pos(57, 35), 8: pos(58, 50),
      9: pos(60, 50), 10: pos(62, 45),
      11: pos(62, 75), 12: pos(65, 50), 13: pos(65, 44),
      14: pos(62, 25), 15: pos(68, 50),
    },
    opp: OPEN_PLAY_OPP,
  },
}
