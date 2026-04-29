import { create } from 'zustand'
import type { UIState, Tool, FieldView } from '../types'

interface UIActions {
  setActiveTool: (tool: Tool) => void
  setActiveFrameId: (id: string | null) => void
  selectElement: (id: string | null, type: 'player' | 'event' | null) => void
  clearSelection: () => void
  setSelectedPlayerIds: (ids: string[]) => void
  clearSelectedPlayers: () => void
  setIsPlaying: (v: boolean) => void
  setPlaybackSpeed: (v: UIState['playbackSpeed']) => void
  setPlaybackLoop: (v: boolean) => void
  setZoom: (v: number) => void
  setPanOffset: (v: UIState['panOffset']) => void
  toggleLibrary: () => void
  toggleFormationPicker: () => void
  togglePresentationMode: () => void
  toggleExportModal: () => void
  setFieldView: (v: FieldView) => void
  setLivePositions: (v: Record<string, import('../types').Position> | null) => void
  setLiveBallPosition: (v: import('../types').Position | null) => void
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  activeTool: 'select',
  activeFrameId: null,
  selectedElementId: null,
  selectedElementType: null,
  selectedPlayerIds: [],
  isPlaying: false,
  playbackSpeed: 1,
  playbackLoop: false,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  isLibraryOpen: false,
  isFormationPickerOpen: false,
  isExportModalOpen: false,
  isPresentationMode: false,
  fieldView: 'full',
  livePositions: null,
  liveBallPosition: null,

  setActiveTool: (tool) => set({ activeTool: tool, selectedElementId: null, selectedElementType: null, selectedPlayerIds: [] }),
  setActiveFrameId: (id) => set({ activeFrameId: id }),
  selectElement: (id, type) => set({ selectedElementId: id, selectedElementType: type }),
  clearSelection: () => set({ selectedElementId: null, selectedElementType: null }),
  setSelectedPlayerIds: (ids) => set({ selectedPlayerIds: ids }),
  clearSelectedPlayers: () => set({ selectedPlayerIds: [] }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
  setPlaybackLoop: (v) => set({ playbackLoop: v }),
  setZoom: (v) => set({ zoom: Math.max(0.3, Math.min(4, v)) }),
  setPanOffset: (v) => set({ panOffset: v }),
  toggleLibrary: () => set((s) => ({ isLibraryOpen: !s.isLibraryOpen })),
  toggleFormationPicker: () => set((s) => ({ isFormationPickerOpen: !s.isFormationPickerOpen })),
  togglePresentationMode: () => set((s) => ({ isPresentationMode: !s.isPresentationMode })),
  toggleExportModal: () => set((s) => ({ isExportModalOpen: !s.isExportModalOpen })),
  setFieldView: (v) => set({ fieldView: v }),
  setLivePositions: (v) => set({ livePositions: v }),
  setLiveBallPosition: (v) => set({ liveBallPosition: v }),
}))
