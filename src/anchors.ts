import type { CanvasShape } from './lib/canvas-annotator'

/** What `vidfx keyframes` writes next to its sample frames. */
export type Manifest = {
  version: number; shot: string; source: string; fps: number; frames_total: number
  canvas: { kind: string; width: number; height: number }
  frames: { frame: number; t: number; path: string; grid: string; width: number; height: number }[]
}
export type AnchorsDoc = { version: number; canvas: Record<string, unknown>; shapes: CanvasShape[] }

export const GHOST = '#8E9678'

/** The anchors.json document for a video canvas (docs/anchors.schema.md). Strips UI-only fields. */
export function buildAnchorsDoc(manifest: Manifest, saved: CanvasShape[]): AnchorsDoc {
  return {
    version: 1,
    canvas: { kind: 'video', width: manifest.canvas.width, height: manifest.canvas.height, fps: manifest.fps, source: manifest.source, shot: manifest.shot },
    shapes: saved.map(({ wip: _w, color: _c, ...s }) => s as CanvasShape),
  }
}

/**
 * What to draw on `frame`: that frame's shapes solid, plus for every id not yet on it a
 * ghost from the nearest other frame (so a corner can be followed across keyframes).
 */
export function overlayFor(saved: CanvasShape[], frame: number): { here: CanvasShape[]; ghosts: CanvasShape[] } {
  const here = saved.filter((s) => s.frame === frame)
  const ids = new Set(here.map((s) => s.id))
  const ghosts: CanvasShape[] = []
  for (const id of new Set(saved.filter((s) => s.frame !== undefined && !ids.has(s.id)).map((s) => s.id))) {
    const near = saved.filter((s) => s.id === id && s.frame !== undefined)
      .sort((a, b) => Math.abs((a.frame ?? 0) - frame) - Math.abs((b.frame ?? 0) - frame))[0]
    if (near) ghosts.push({ ...near, color: GHOST, label: `${near.label} @${near.frame}`, ...(near.kind === 'polygon' ? { open: true } : {}) })
  }
  return { here, ghosts }
}

/** Run an engine command through the dev bridge; streams text into `onChunk`. Resolves with the exit code. */
export async function runEngine(cmd: string, shot: string, args: string[], onChunk: (s: string) => void): Promise<number> {
  const r = await fetch('/vidfx/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cmd, shot, args }) })
  if (!r.ok || !r.body) { onChunk(`bridge error ${r.status}: ${await r.text()}\n`); return 127 }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let all = ''
  for (;;) { const { value, done } = await reader.read(); if (done) break; const s = dec.decode(value, { stream: true }); all += s; onChunk(s) }
  const m = /exit (\d+)\s*$/.exec(all); return m ? Number(m[1]) : 1
}
