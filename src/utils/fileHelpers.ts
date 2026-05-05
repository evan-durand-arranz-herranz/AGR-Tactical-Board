import type { Combination } from '../types'
import { useTacticalStore } from '../store/tacticalStore'
import { useUIStore } from '../store/uiStore'

interface AgrFile {
  version: '1'
  combination: Combination
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ─── Public API ───────────────────────────────────────────────────────────────

/** Ctrl+S: sauvegarde sur place si le fichier existe, sinon ouvre Save As */
export async function saveFile(): Promise<void> {
  const ui = useUIStore.getState()
  const combo = useTacticalStore.getState().getActiveCombination()
  if (!combo) return

  const hasFile = !!ui.currentFilePath && ui.lastSavedCombinationId === combo.id
  if (hasFile) {
    await writeToPath(ui.currentFilePath!, combo)
  } else {
    await saveFileAs()
  }
}

/** Ctrl+Shift+S: toujours ouvrir la boîte de dialogue */
export async function saveFileAs(): Promise<void> {
  const combo = useTacticalStore.getState().getActiveCombination()
  if (!combo) return

  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const path = await save({
      filters: [{ name: 'AGR Tactical', extensions: ['agr'] }],
      defaultPath: `${sanitizeFilename(combo.name)}.agr`,
    })
    if (!path) return
    const data: AgrFile = { version: '1', combination: combo }
    await invoke('write_file', { path, content: JSON.stringify(data, null, 2) })
    useUIStore.getState().setFileSaveState(path, combo.updatedAt, combo.id)
  } else {
    browserDownload(combo)
  }
}

/** Ouvre un fichier .agr et charge la tactique dans le store */
export async function openFile(): Promise<void> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const selected = await open({
      filters: [{ name: 'AGR Tactical', extensions: ['agr'] }],
      multiple: false,
    })
    if (!selected) return
    const path = Array.isArray(selected) ? selected[0] : (selected as string)
    const content = await invoke<string>('read_file', { path })
    loadFromJson(content, path)
  } else {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.agr'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      loadFromJson(text, `browser:${file.name}`)
    }
    input.click()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeToPath(path: string, combo: Combination): Promise<void> {
  const data: AgrFile = { version: '1', combination: combo }
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_file', { path, content: JSON.stringify(data, null, 2) })
    useUIStore.getState().setFileSaveState(path, combo.updatedAt, combo.id)
  } else {
    browserDownload(combo)
  }
}

function browserDownload(combo: Combination): void {
  const data: AgrFile = { version: '1', combination: combo }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(combo.name)}.agr`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  useUIStore.getState().setFileSaveState(`download:${combo.name}.agr`, combo.updatedAt, combo.id)
}

function loadFromJson(json: string, path: string): void {
  const data: AgrFile = JSON.parse(json)
  useTacticalStore.getState().importCombination(data.combination)
  useUIStore.getState().setFileSaveState(path, data.combination.updatedAt, data.combination.id)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'tactique'
}
