// ─── Core Enums / Unions ────────────────────────────────────────────────────

export type Team = 'AGR' | 'opponent'
export type Phase = 'scrum' | 'lineout' | 'kickoff' | 'open' | 'defense'
export type Category = 'attack' | 'defense' | 'kick' | 'set_piece'
export type EventType = 'pass' | 'run' | 'ruck' | 'maul' | 'kick' | 'tackle' | 'zone' | 'annotation'
export type Tool = 'select' | 'erase' | 'zone'

// ─── Basic Structures ────────────────────────────────────────────────────────

/** Normalized coordinates: 0–100 representing % of field width/height */
export interface Position {
  x: number
  y: number
}

// ─── Player ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  number: number      // 1–15 starters, 16–23 replacements
  team: Team
  name?: string
  hasBall?: boolean
  isOnBench?: boolean
}

// ─── Field Events ────────────────────────────────────────────────────────────

export interface FieldEvent {
  id: string
  type: EventType
  from?: Position
  to?: Position
  points?: Position[] // Bézier control points for curved arrows
  label?: string
  color: string
  frameId: string
  // Zone-specific (type === 'zone')
  shapeType?: 'rect' | 'ellipse' | 'line' | 'path' | 'arc'
  normPoints?: Position[]  // normalized coords for triangle / polygon / path / arc (3 pts for arc)
}

// ─── Frame ───────────────────────────────────────────────────────────────────

export interface Frame {
  id: string
  order: number
  label: string
  timestamp?: string      // e.g. "04:32 — 1ère mi-temps" for match analysis
  isKeyMoment?: boolean
  duration: number        // transition duration to next frame (ms)
  positions: Record<string, Position>              // playerId → position
  ballPosition?: Position                          // ballon indépendant
  ballWaypoint?: Position                          // point de contrôle quadratique du ballon (coup de pied)
  waypoints?: Record<string, [Position, Position]> // 2 points de contrôle par joueur (1/3, 2/3)
  events: FieldEvent[]
}

// ─── Combination ─────────────────────────────────────────────────────────────

export interface Combination {
  id: string
  name: string
  phase: Phase
  category: Category
  tags: string[]
  isFavorite: boolean
  folderId?: string
  frames: Frame[]
  players: Player[]
  hiddenPlayerIds?: string[]   // joueurs mis au banc (masqués sur le terrain)
  backgroundImage?: string
  createdAt: string
  updatedAt: string
}

// ─── Library ─────────────────────────────────────────────────────────────────

export interface Folder {
  id: string
  name: string
  parentId?: string
}

export interface Library {
  combinations: Combination[]
  folders: Folder[]
}

// ─── UI State ────────────────────────────────────────────────────────────────

export type FieldView = 'full' | 'half'

export interface UIState {
  activeTool: Tool
  activeFrameId: string | null
  selectedElementId: string | null  // player id or event id
  selectedElementType: 'player' | 'event' | null
  selectedEntityIds: string[]          // multi-selection: player IDs + zone event IDs
  isPlaying: boolean
  playbackSpeed: 0.5 | 1 | 1.5 | 2
  playbackLoop: boolean
  zoom: number
  panOffset: Position
  isLibraryOpen: boolean
  isFormationPickerOpen: boolean
  isExportModalOpen: boolean
  isPresentationMode: boolean
  fieldView: FieldView
  livePositions: Record<string, Position> | null  // positions interpolées pendant l'animation
  liveBallPosition: Position | null               // position du ballon interpolée pendant l'animation
  // File save state
  currentFilePath: string | null
  lastSavedUpdatedAt: string | null
  lastSavedCombinationId: string | null
  // Zone drawing config
  zoneColor: string
  zoneShape: 'freehand' | 'rect' | 'ellipse'
}

// ─── Field geometry constants (SVG viewport) ─────────────────────────────────

export const FIELD = {
  /** SVG viewport width in user units */
  WIDTH: 1000,
  /** SVG viewport height in user units (1000 * 70/100) */
  HEIGHT: 700,
  /** Touch/end-zone depth in user units (1000 * 10/100) */
  INGOAL: 100,
  /** Playing field width (between try lines) */
  PLAY_WIDTH: 800,
} as const
