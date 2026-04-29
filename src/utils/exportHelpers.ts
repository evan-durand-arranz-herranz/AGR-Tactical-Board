import type { Combination, Frame, Player } from '../types'
import {
  EXPORT_W, EXPORT_H,
  ensureFonts,
  renderFrameToCanvas,
  renderInterpolatedToCanvas,
  easeInOut,
} from './renderToCanvas'

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-]/gi, '_').replace(/_+/g, '_').slice(0, 60)
}

// ─── Video export ─────────────────────────────────────────────────────────────

export async function exportVideo(
  frames: Frame[],
  players: Player[],
  combo: Combination,
  speed = 1,
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (frames.length < 2) throw new Error('At least 2 frames required for video export')

  await ensureFonts()

  const canvas = document.createElement('canvas')
  canvas.width  = EXPORT_W
  canvas.height = EXPORT_H
  const ctx = canvas.getContext('2d')!

  const sortedFrames = [...frames].sort((a, b) => a.order - b.order)
  const totalMs = sortedFrames.slice(0, -1).reduce((s, f) => s + f.duration / speed, 0)

  // VP9/WebM prioritaire (Windows + Linux), MP4/H.264 fallback (macOS WebKit)
  const mimeType = (
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
     'video/mp4;codecs=avc1', 'video/mp4']
      .find(t => MediaRecorder.isTypeSupported(t))
  ) ?? 'video/webm'
  const fileExt = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const stream   = canvas.captureStream(60)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16_000_000 })
  const chunks: Blob[] = []

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  function renderAtTime(elapsedMs: number) {
    let cumulative = 0
    for (let i = 0; i < sortedFrames.length - 1; i++) {
      const dur = sortedFrames[i].duration / speed
      if (elapsedMs <= cumulative + dur) {
        const raw = dur > 0 ? (elapsedMs - cumulative) / dur : 1
        renderInterpolatedToCanvas(
          ctx,
          sortedFrames[i],
          sortedFrames[i + 1],
          players,
          easeInOut(Math.min(raw, 1)),
          { comboName: combo.name },
        )
        return
      }
      cumulative += dur
    }
    renderFrameToCanvas(ctx, sortedFrames[sortedFrames.length - 1], players, {
      label: sortedFrames[sortedFrames.length - 1].label, comboName: combo.name,
    })
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${safeFilename(combo.name)}_tactique.${fileExt}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      resolve()
    }

    recorder.onerror = reject

    renderAtTime(0)
    recorder.start(100)   // collect data every 100 ms for finer chunks

    const FPS     = 60
    const tickMs  = 1000 / FPS
    let elapsedMs = 0
    let stopped   = false

    const id = setInterval(() => {
      if (stopped) return
      elapsedMs += tickMs
      onProgress?.(Math.min(elapsedMs / totalMs, 1))
      renderAtTime(elapsedMs)

      if (elapsedMs >= totalMs + tickMs * 2) {
        stopped = true
        clearInterval(id)
        recorder.stop()
      }
    }, tickMs)
  })
}
