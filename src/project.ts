/**
 * Projects (app frame A1, plans/2026-10-10_app-frame.md): a project is one directory under the
 * creative repo's projects/, laid out like a Camtasia standalone package: project.json, media/ (the
 * Media Bin, files copied in), shots/, work/, renders/. The page addresses it as ?project=<name>;
 * without a project the legacy mounts (/work, /shots, /renders in video-fx) keep working.
 */

export type Canvas = { width: number; height: number; fps: number }
export type MediaItem = {
  id: string; file: string; type: string; added: string
  width?: number; height?: number; fps?: number; duration?: number
  source?: string           // where it was imported from
  linked?: boolean          // true = not copied into media/ (chain badge; may go "missing")
}
export type ProjectDoc = {
  version: 1; name: string; created: string; modified: string
  canvas: Canvas
  media: MediaItem[]
  shots: string[]
  recent?: { shot?: string; view?: string }
}
export type ProjectSummary = { name: string; modified: string; canvas: Canvas; shots: number; media: number }

export const SAFE_NAME = /^[A-Za-z0-9][\w.-]{0,63}$/
export const DEFAULT_CANVAS: Canvas = { width: 1920, height: 1080, fps: 25 }

export function emptyProject(name: string, canvas: Canvas = DEFAULT_CANVAS, now = new Date()): ProjectDoc {
  const t = now.toISOString()
  return { version: 1, name, created: t, modified: t, canvas: { ...canvas }, media: [], shots: [] }
}

/** Throws with a reason when `doc` is not a project.json we can open. */
export function validateProject(doc: unknown): ProjectDoc {
  const d = doc as Partial<ProjectDoc>
  if (!d || typeof d !== 'object') throw new Error('not an object')
  if (d.version !== 1) throw new Error(`unsupported version ${String(d.version)}`)
  if (typeof d.name !== 'string' || !SAFE_NAME.test(d.name)) throw new Error('bad name')
  const c = d.canvas
  if (!c || ![c.width, c.height, c.fps].every((n) => typeof n === 'number' && n > 0)) throw new Error('canvas needs width, height, fps')
  return { ...d, media: Array.isArray(d.media) ? d.media : [], shots: Array.isArray(d.shots) ? d.shots : [] } as ProjectDoc
}

export function touch(doc: ProjectDoc, now = new Date()): ProjectDoc {
  return { ...doc, modified: now.toISOString() }
}

/** Bridge paths for a shot inside a project, or the legacy video-fx mounts when `project` is empty. */
export function bridgePaths(project: string | null | undefined) {
  const root = project ? `/projects/${encodeURIComponent(project)}` : ''
  return {
    root,
    work: (shot: string) => `${root}/work/${shot}`,
    shots: `${root}/shots`,
    renders: `${root}/renders`,
    media: `${root}/media`,
    projectJson: `${root}/project.json`,
  }
}

// ── bridge calls ──
export async function listProjects(): Promise<ProjectSummary[]> {
  const r = await fetch('/projects'); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}
export async function createProject(name: string, canvas: Canvas = DEFAULT_CANVAS): Promise<ProjectDoc> {
  const r = await fetch('/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, canvas }) })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return validateProject(await r.json())
}
export async function loadProject(name: string): Promise<ProjectDoc> {
  const r = await fetch(`${bridgePaths(name).projectJson}?v=${Date.now()}`); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return validateProject(await r.json())
}
export async function saveProject(doc: ProjectDoc): Promise<ProjectDoc> {
  const next = touch(doc)
  const r = await fetch(bridgePaths(doc.name).projectJson, { method: 'PUT', body: JSON.stringify(next, null, 2) })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return next
}
