import type { CanvasShape, Pt, Vtx } from './lib/canvas-annotator'

/** What `vidfx keyframes` writes next to its sample frames. */
export type Manifest = {
  version: number; shot: string; source: string; fps: number; frames_total: number
  canvas: { kind: string; width: number; height: number }
  effects?: { kind: string; tracker: string | null }[]
  frames: { frame: number; t: number; path: string; grid: string; width: number; height: number }[]
}
export type AnchorsDoc = { version: number; canvas: Record<string, unknown>; shapes: CanvasShape[] }

export const GHOST = '#8E9678'

/** The anchors.json document for a video canvas (docs/anchors.schema.md). Strips UI-only fields. */
export function buildAnchorsDoc(manifest: Manifest, saved: CanvasShape[]): AnchorsDoc {
  return {
    version: hasHandles(saved) ? 2 : 1,   // schema v2 = bezier handles on polygon vertices (tranche 5)
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
export async function runEngine(cmd: string, shot: string, args: string[], onChunk: (s: string) => void, project?: string): Promise<number> {
  const r = await fetch('/vidfx/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cmd, shot, args, ...(project ? { project } : {}) }) })
  if (!r.ok || !r.body) { onChunk(`bridge error ${r.status}: ${await r.text()}\n`); return 127 }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let all = ''
  for (;;) { const { value, done } = await reader.read(); if (done) break; const s = dec.decode(value, { stream: true }); all += s; onChunk(s) }
  const m = /exit (\d+)\s*$/.exec(all); return m ? Number(m[1]) : 1
}

/** A shape in refined.json: the engine's result plus what it was given. */
export type RefinedShape = CanvasShape & { given?: { x: number; y: number }[]; moved_px?: number[] }
export type RefinedDoc = AnchorsDoc & { shapes: RefinedShape[] }

export const REFINED = '#3DDC84'

/** Replace saved shapes with the engine's refined geometry for matching (id, frame); `frame` undefined = all. */
export function acceptRefined(saved: CanvasShape[], refined: RefinedShape[], frame?: number): CanvasShape[] {
  return saved.map((s) => {
    const r = refined.find((x) => x.id === s.id && x.frame === s.frame && (frame === undefined || s.frame === frame))
    if (!r || r.kind !== s.kind) return s
    if (s.kind === 'circle' && r.kind === 'circle') return { ...s, x: r.x, y: r.y }
    if (s.kind !== 'circle' && r.kind !== 'circle') return { ...s, points: r.points.map((p) => ({ x: p.x, y: p.y, ...((p as Vtx).in ? { in: (p as Vtx).in } : {}), ...((p as Vtx).out ? { out: (p as Vtx).out } : {}) })) }
    return s
  })
}

/** Refined shapes on `frame`, styled for the overlay (green, open polygons so the red/given one shows through). */
export function refinedOverlay(refined: RefinedShape[], frame: number): CanvasShape[] {
  return refined.filter((r) => r.frame === frame).map((r) => ({ ...r, id: `refined-${r.id}`, label: `${r.label} ✓`, color: REFINED, ...(r.kind === 'polygon' ? { open: false } : {}) }))
}

/** Nearest vertex of a saved shape on `frame` within `tol` canvas units of (x, y). */
export type VertexHit = { index: number; point: number; handle?: 'in' | 'out' }
/** The nearest vertex, circle centre, or (tranche 5) bezier handle on `frame` within `tol`. Handles win ties: they sit near their vertex. */
export function hitVertex(saved: CanvasShape[], frame: number, x: number, y: number, tol: number): VertexHit | null {
  const hits: (VertexHit & { d: number })[] = []
  saved.forEach((s, index) => {
    if (s.frame !== frame) return
    const pts = s.kind === 'circle' ? [{ x: s.x, y: s.y }] : s.points
    pts.forEach((p, point) => {
      const d = Math.hypot(p.x - x, p.y - y); if (d <= tol) hits.push({ index, point, d: d + 0.01 })
      if (s.kind === 'polygon') for (const h of ['in', 'out'] as const) { const q = (p as Vtx)[h]; if (q) { const dh = Math.hypot(q.x - x, q.y - y); if (dh <= tol) hits.push({ index, point, handle: h, d: dh }) } }
    })
  })
  if (!hits.length) return null
  const b = hits.sort((p, q) => p.d - q.d)[0]
  return { index: b.index, point: b.point, ...(b.handle ? { handle: b.handle } : {}) }
}

/** Move one vertex (or a circle's centre) of a shape; a vertex's handles move with it. */
export function moveVertex(s: CanvasShape, point: number, x: number, y: number): CanvasShape {
  if (s.kind === 'circle') return { ...s, x: Math.round(x), y: Math.round(y) }
  return { ...s, points: s.points.map((p, i) => {
    if (i !== point) return p
    const dx = Math.round(x) - p.x, dy = Math.round(y) - p.y; const v = p as Vtx
    return { ...p, x: Math.round(x), y: Math.round(y), ...(v.in ? { in: { x: v.in.x + dx, y: v.in.y + dy } } : {}), ...(v.out ? { out: { x: v.out.x + dx, y: v.out.y + dy } } : {}) }
  }) }
}

/**
 * Tranche 5, the pen tool's handle rules (After Effects / Illustrator): dragging a handle keeps the opposite one
 * mirrored through the vertex (a smooth point) unless `broken` (Option held), which moves this handle alone.
 */
export function moveHandle(s: CanvasShape, point: number, which: 'in' | 'out', x: number, y: number, broken: boolean, snap = 8): CanvasShape {
  if (s.kind !== 'polygon') return s
  return { ...s, points: s.points.map((p, i) => {
    if (i !== point) return p
    const h = { x: Math.round(x), y: Math.round(y) }; const other = which === 'in' ? 'out' : 'in'
    const mirrored = broken ? (p as Vtx)[other] : { x: 2 * p.x - h.x, y: 2 * p.y - h.y }
    const v: Vtx = { ...p, [which]: h, ...(mirrored ? { [other]: mirrored } : {}) }
    // a handle dropped on its corner retracts (AE: a zero-length handle is a corner); mirrored one too when not broken
    for (const k of ['in', 'out'] as const) { const q = v[k]; if (q && Math.hypot(q.x - p.x, q.y - p.y) <= snap && (k === which || !broken)) delete v[k] }
    return v
  }) }
}
/** Option-click a corner: give it symmetric handles along its neighbours' direction (a smooth point); Option-click a smooth point: back to a corner. */
export function toggleHandles(s: CanvasShape, point: number): CanvasShape {
  if (s.kind !== 'polygon') return s
  const p = s.points[point] as Vtx
  if (p.in || p.out) { const { in: _i, out: _o, ...rest } = p; return { ...s, points: s.points.map((q, i) => (i === point ? rest : q)) } }
  const n = s.points.length; const prev = s.points[(point - 1 + n) % n], next = s.points[(point + 1) % n]
  const dx = next.x - prev.x, dy = next.y - prev.y; const len = Math.hypot(dx, dy) || 1; const k = Math.min(len / 3, 80)
  const out = { x: Math.round(p.x + (dx / len) * k), y: Math.round(p.y + (dy / len) * k) }, inn = { x: Math.round(p.x - (dx / len) * k), y: Math.round(p.y - (dy / len) * k) }
  return { ...s, points: s.points.map((q, i) => (i === point ? { ...q, in: inn, out } : q)) }
}
export const hasHandles = (shapes: CanvasShape[]) => shapes.some((s) => s.kind === 'polygon' && s.points.some((p) => (p as Vtx).in || (p as Vtx).out))
export type { Pt }


/** A5: the shot file's effects list, read and edited through `vidfx effects` so the YAML stays the truth. */
export type EffectRow = { i: number; kind: string; tracker: string | null; [k: string]: unknown }
export async function listEffects(shot: string, project?: string): Promise<EffectRow[]> {
  let out = ''
  const code = await runEngine('effects', shot, ['list'], (s) => { out += s }, project)
  if (code !== 0) return []
  const a = out.indexOf('['), b = out.lastIndexOf(']')
  try { return a >= 0 && b > a ? (JSON.parse(out.slice(a, b + 1)) as EffectRow[]) : [] } catch { return [] }
}
export async function editEffects(shot: string, op: 'add' | 'set' | 'remove', args: string[], project?: string): Promise<number> {
  return runEngine('effects', shot, [op, ...args], () => {}, project)
}
