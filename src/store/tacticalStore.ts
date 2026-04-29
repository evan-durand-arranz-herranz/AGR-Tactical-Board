import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  Combination,
  Frame,
  Player,
  Position,
  FieldEvent,
  Phase,
  Category,
  Library,
  Folder,
} from '../types'
import { createDefaultCombination } from '../utils/formations'
import { useUIStore } from './uiStore'

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'agr-tactical-v1'

function loadFromStorage(): { library: Library; activeCombinationId: string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.library?.combinations) || parsed.library.combinations.length === 0) return null
    return parsed as { library: Library; activeCombinationId: string | null }
  } catch { return null }
}

// ─── History item ─────────────────────────────────────────────────────────────

interface HistoryEntry {
  activeCombinationId: string | null
  combinations: Combination[]
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface TacticalState {
  // Library
  library: Library

  // Active combination being edited
  activeCombinationId: string | null

  // History for undo/redo
  past: HistoryEntry[]
  future: HistoryEntry[]

  // ── Derived helpers ────────────────────────────────────────────────────────
  getActiveCombination: () => Combination | null
  getActiveFrame: (frameId: string) => Frame | null

  // ── Combination CRUD ──────────────────────────────────────────────────────
  createCombination: (name?: string) => string
  deleteCombination: (id: string) => void
  duplicateCombination: (id: string) => string
  updateCombinationMeta: (
    id: string,
    patch: Partial<Pick<Combination, 'name' | 'phase' | 'category' | 'tags' | 'isFavorite' | 'folderId'>>
  ) => void
  setActiveCombination: (id: string) => void

  // ── Frame CRUD ────────────────────────────────────────────────────────────
  addFrame: () => string | null
  removeFrame: (frameId: string) => void
  duplicateFrame: (frameId: string) => string | null
  reorderFrames: (orderedIds: string[]) => void
  updateFrameLabel: (frameId: string, label: string) => void
  updateFrameDuration: (frameId: string, duration: number) => void

  // ── Player positions ──────────────────────────────────────────────────────
  setPlayerPosition: (frameId: string, playerId: string, pos: Position) => void
  /** Met à jour les 2 points de contrôle de trajectoire d'un joueur */
  setWaypoints: (frameId: string, playerId: string, pair: [Position, Position]) => void
  updatePlayerName: (playerId: string, name: string) => void
  /** Place un joueur sur la frame active et les frames suivantes */
  placePlayer: (playerId: string, pos: Position) => void
  /** Retire un joueur du terrain (toutes les frames) — le remet dans le pool */
  removePlayerFromField: (playerId: string) => void
  /** Retire plusieurs joueurs en un seul commit d'historique */
  batchRemovePlayersFromField: (playerIds: string[]) => void
  /** Positionne le ballon sur une frame précise */
  setBallPosition: (frameId: string, pos: Position | null) => void
  /** Point de contrôle de la trajectoire du ballon (coup de pied) */
  setBallWaypoint: (frameId: string, pos: Position | null) => void
  /** Place le ballon sur la frame active + les frames suivantes */
  placeBall: (pos: Position) => void

  // ── Formation ─────────────────────────────────────────────────────────────
  /** Applique un set de positions d'un coup (une seule entrée d'historique) */
  applyFormation: (frameId: string, positions: Record<string, Position>) => void

  // ── Events ────────────────────────────────────────────────────────────────
  addEvent: (frameId: string, event: Omit<FieldEvent, 'frameId'>) => void
  updateEvent: (frameId: string, eventId: string, patch: Partial<FieldEvent>) => void
  removeEvent: (frameId: string, eventId: string) => void

  // ── Folders ───────────────────────────────────────────────────────────────
  createFolder: (name: string, parentId?: string) => void
  deleteFolder: (id: string) => void

  // ── History ───────────────────────────────────────────────────────────────
  undo: () => void
  redo: () => void
  _pushHistory: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snapshot(state: TacticalState): HistoryEntry {
  return {
    activeCombinationId: state.activeCombinationId,
    combinations: JSON.parse(JSON.stringify(state.library.combinations)),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTacticalStore = create<TacticalState>()(
  subscribeWithSelector(
    immer((set, get) => {
      const saved = loadFromStorage()
      const defaultCombo = saved ? null : createDefaultCombination()

      return {
        library: saved?.library ?? {
          combinations: [defaultCombo!],
          folders: [],
        },
        activeCombinationId: saved?.activeCombinationId ?? defaultCombo?.id ?? null,
        past: [],
        future: [],

        // ── Derived helpers ──────────────────────────────────────────────────
        getActiveCombination: () => {
          const s = get()
          return s.library.combinations.find(c => c.id === s.activeCombinationId) ?? null
        },
        getActiveFrame: (frameId: string) => {
          const combo = get().getActiveCombination()
          return combo?.frames.find(f => f.id === frameId) ?? null
        },

        // ── Combination CRUD ─────────────────────────────────────────────────
        createCombination: (name = 'Nouvelle combinaison') => {
          get()._pushHistory()
          const combo = createDefaultCombination(name)
          set(s => { s.library.combinations.push(combo) })
          set(s => { s.activeCombinationId = combo.id })
          return combo.id
        },

        deleteCombination: (id) => {
          get()._pushHistory()
          set(s => {
            s.library.combinations = s.library.combinations.filter(c => c.id !== id)
            if (s.activeCombinationId === id) {
              s.activeCombinationId = s.library.combinations[0]?.id ?? null
            }
          })
        },

        duplicateCombination: (id) => {
          get()._pushHistory()
          const src = get().library.combinations.find(c => c.id === id)
          if (!src) return id
          const copy: Combination = {
            ...JSON.parse(JSON.stringify(src)),
            id: crypto.randomUUID(),
            name: `${src.name} (copie)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          set(s => { s.library.combinations.push(copy) })
          return copy.id
        },

        updateCombinationMeta: (id, patch) => {
          set(s => {
            const combo = s.library.combinations.find(c => c.id === id)
            if (!combo) return
            Object.assign(combo, patch, { updatedAt: new Date().toISOString() })
          })
        },

        setActiveCombination: (id) => {
          set(s => { s.activeCombinationId = id })
          useUIStore.getState().setActiveFrameId(null)
        },

        // ── Frames ───────────────────────────────────────────────────────────
        addFrame: () => {
          const combo = get().getActiveCombination()
          if (!combo || combo.frames.length >= 10) return null
          get()._pushHistory()
          const lastFrame = combo.frames[combo.frames.length - 1]
          const newFrame: Frame = {
            id: crypto.randomUUID(),
            order: combo.frames.length,
            label: `Étape ${combo.frames.length + 1}`,
            duration: 1500,
            positions: lastFrame ? { ...lastFrame.positions } : {},
            ballPosition: lastFrame?.ballPosition ? { ...lastFrame.ballPosition } : undefined,
            events: [],
          }
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            c?.frames.push(newFrame)
          })
          return newFrame.id
        },

        removeFrame: (frameId) => {
          const combo = get().getActiveCombination()
          if (!combo || combo.frames.length <= 1) return
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            c.frames = c.frames.filter(f => f.id !== frameId)
            c.frames.forEach((f, i) => { f.order = i })
          })
        },

        duplicateFrame: (frameId) => {
          const combo = get().getActiveCombination()
          if (!combo || combo.frames.length >= 10) return null
          get()._pushHistory()
          const src = combo.frames.find(f => f.id === frameId)
          if (!src) return null
          const copy: Frame = {
            ...JSON.parse(JSON.stringify(src)),
            id: crypto.randomUUID(),
            order: combo.frames.length,
            label: `${src.label} (copie)`,
          }
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const idx = c?.frames.findIndex(f => f.id === frameId) ?? -1
            if (c && idx >= 0) c.frames.splice(idx + 1, 0, copy)
            c?.frames.forEach((f, i) => { f.order = i })
          })
          return copy.id
        },

        reorderFrames: (orderedIds) => {
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            const map = new Map(c.frames.map(f => [f.id, f]))
            c.frames = orderedIds.map((id, i) => {
              const f = map.get(id)!
              f.order = i
              return f
            })
          })
        },

        updateFrameLabel: (frameId, label) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (f) f.label = label
          })
        },

        updateFrameDuration: (frameId, duration) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (f) f.duration = duration
          })
        },

        // ── Players ──────────────────────────────────────────────────────────
        setPlayerPosition: (frameId, playerId, pos) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (!f) return
            const oldPos = f.positions[playerId]
            if (oldPos && f.ballPosition) {
              const dx = f.ballPosition.x - oldPos.x
              const dy = f.ballPosition.y - oldPos.y
              if (dx * dx + dy * dy < 16) {
                f.ballPosition = { ...pos }
              }
            }
            f.positions[playerId] = pos
          })
        },

        setWaypoints: (frameId, playerId, pair) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (!f) return
            if (!f.waypoints) f.waypoints = {}
            f.waypoints[playerId] = [{ ...pair[0] }, { ...pair[1] }]
          })
        },

        setBallPosition: (frameId, pos) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (!f) return
            f.ballPosition = pos ?? undefined
          })
        },

        setBallWaypoint: (frameId, pos) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (!f) return
            f.ballWaypoint = pos ?? undefined
          })
        },

        placeBall: (pos) => {
          const { activeFrameId } = useUIStore.getState()
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            const activeOrder = c.frames.find(f => f.id === activeFrameId)?.order ?? 0
            for (const frame of c.frames) {
              if (frame.order >= activeOrder) frame.ballPosition = { ...pos }
            }
          })
        },

        updatePlayerName: (playerId, name) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const p = c?.players.find(x => x.id === playerId)
            if (p) p.name = name
          })
        },

        placePlayer: (playerId, pos) => {
          const { activeFrameId } = useUIStore.getState()
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            const activeOrder = c.frames.find(f => f.id === activeFrameId)?.order ?? 0
            for (const frame of c.frames) {
              if (frame.order >= activeOrder) frame.positions[playerId] = { ...pos }
            }
          })
        },

        removePlayerFromField: (playerId) => {
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            for (const frame of c.frames) {
              delete frame.positions[playerId]
              delete frame.waypoints?.[playerId]
            }
          })
        },

        batchRemovePlayersFromField: (playerIds) => {
          if (playerIds.length === 0) return
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            if (!c) return
            for (const frame of c.frames) {
              for (const pid of playerIds) {
                delete frame.positions[pid]
                delete frame.waypoints?.[pid]
              }
            }
          })
        },

        // ── Formation ────────────────────────────────────────────────────────
        applyFormation: (frameId, positions) => {
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (!f) return
            for (const [pid, pos] of Object.entries(positions)) {
              f.positions[pid] = { ...pos }
            }
          })
        },

        // ── Events ───────────────────────────────────────────────────────────
        addEvent: (frameId, event) => {
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            f?.events.push({ ...event, frameId })
          })
        },

        updateEvent: (frameId, eventId, patch) => {
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            const ev = f?.events.find(x => x.id === eventId)
            if (ev) Object.assign(ev, patch)
          })
        },

        removeEvent: (frameId, eventId) => {
          get()._pushHistory()
          set(s => {
            const c = s.library.combinations.find(x => x.id === s.activeCombinationId)
            const f = c?.frames.find(x => x.id === frameId)
            if (f) f.events = f.events.filter(e => e.id !== eventId)
          })
        },

        // ── Folders ──────────────────────────────────────────────────────────
        createFolder: (name, parentId) => {
          const folder: Folder = { id: crypto.randomUUID(), name, parentId }
          set(s => { s.library.folders.push(folder) })
        },
        deleteFolder: (id) => {
          set(s => { s.library.folders = s.library.folders.filter(f => f.id !== id) })
        },

        // ── History ──────────────────────────────────────────────────────────
        _pushHistory: () => {
          const entry = snapshot(get())
          set(s => {
            s.past = [...s.past.slice(-29), entry]
            s.future = []
          })
        },

        undo: () => {
          const past = get().past
          if (past.length === 0) return
          const prev = past[past.length - 1]
          const current = snapshot(get())
          set(s => {
            s.future = [current, ...s.future.slice(0, 29)]
            s.past = past.slice(0, -1)
            s.library.combinations = JSON.parse(JSON.stringify(prev.combinations))
            s.activeCombinationId = prev.activeCombinationId
          })
        },

        redo: () => {
          const future = get().future
          if (future.length === 0) return
          const next = future[0]
          const current = snapshot(get())
          set(s => {
            s.past = [...s.past.slice(-29), current]
            s.future = future.slice(1)
            s.library.combinations = JSON.parse(JSON.stringify(next.combinations))
            s.activeCombinationId = next.activeCombinationId
          })
        },
      }
    })
  )
)

// Save to localStorage on every relevant state change
useTacticalStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      library: state.library,
      activeCombinationId: state.activeCombinationId,
    }))
  } catch { /* quota exceeded or private browsing */ }
})
