/**
 * Media Bin (app frame A3): helpers shared by the panel and its tests, and the bridge calls.
 * Camtasia's vocabulary: Import Media, Media Bin views and Sort by, unused and missing media.
 */
import { bridgePaths, validateProject, type MediaItem, type ProjectDoc } from './project'
export type { MediaItem }

export type MediaKind = 'image' | 'video' | 'audio' | 'other'
export type SortBy = 'name' | 'type' | 'date' | 'size'
export type View = 'large' | 'medium' | 'small' | 'list'

export const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.json': 'application/json', '.pdf': 'application/pdf',
}
export function extMime(name: string): string { const m = /\.[^.]+$/.exec(name.toLowerCase()); return (m && MIME[m[0]]) || 'application/octet-stream' }
export function mediaKind(type: string): MediaKind { return type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'other' }
export function baseName(file: string): string { return file.split('/').pop() ?? file }

/** width/height of an SVG from its root attributes or viewBox. */
export function svgSize(text: string): { width: number; height: number } | null {
  const root = /<svg\b[^>]*>/i.exec(text)?.[0]; if (!root) return null
  const attr = (n: string) => { const m = new RegExp(`\\b${n}="([^"]+)"`).exec(root); return m && !m[1].includes('%') ? parseFloat(m[1]) : NaN }
  let w = attr('width'), h = attr('height')
  if (!(w > 0 && h > 0)) { const vb = /\bviewBox="([^"]+)"/.exec(root); if (vb) { const p = vb[1].trim().split(/[\s,]+/).map(Number); if (p.length === 4) { w = p[2]; h = p[3] } } }
  return w > 0 && h > 0 ? { width: Math.round(w), height: Math.round(h) } : null
}

export function sortMedia(items: MediaItem[], by: SortBy, dir: 'asc' | 'desc'): MediaItem[] {
  const key = (m: MediaItem) => by === 'name' ? m.id.toLowerCase() : by === 'type' ? `${mediaKind(m.type)} ${m.type}` : by === 'size' ? (m.size ?? 0) : m.added
  const out = [...items].sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0 })
  return dir === 'asc' ? out : out.reverse()
}

/** Which shots reference each media item: a shot file mentions the file's basename (ui: ../media/x.mp4, source: …). */
export function usageFromShots(items: MediaItem[], shots: { name: string; text: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const m of items) { const b = baseName(m.file); out[m.id] = shots.filter((s) => s.text.includes(b)).map((s) => s.name) }
  return out
}

export function fmtDuration(s?: number): string { if (!s && s !== 0) return ''; const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}` }
export function fmtSize(b?: number): string { if (!b && b !== 0) return ''; return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B` }

// ── bridge calls (every one returns the project document the bridge wrote) ──
const json = async (r: Response) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return validateProject(await r.json()) }
export async function importMediaFiles(project: string, files: File[]): Promise<ProjectDoc> {
  let doc: ProjectDoc | null = null
  for (const f of files) {
    doc = await json(await fetch(`${bridgePaths(project).media}`, { method: 'POST', headers: { 'content-type': f.type || extMime(f.name), 'x-filename': encodeURIComponent(f.name) }, body: f }))
  }
  if (!doc) throw new Error('no files'); return doc
}
export async function addMediaFromPath(project: string, path: string, link: boolean): Promise<ProjectDoc> {
  return json(await fetch(`${bridgePaths(project).media}/from-path`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, link }) }))
}
export async function renameMedia(project: string, id: string, to: string): Promise<ProjectDoc> {
  return json(await fetch(`${bridgePaths(project).media}/${encodeURIComponent(id)}/rename`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) }))
}
export async function deleteMedia(project: string, id: string): Promise<ProjectDoc> {
  return json(await fetch(`${bridgePaths(project).media}/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}
export type MediaInfo = Record<string, { exists: boolean; usedBy: string[] }>
export async function mediaInfo(project: string): Promise<MediaInfo> {
  const r = await fetch(`${bridgePaths(project).root}/media-info?v=${Date.now()}`); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json()
}
/** URL of a thumbnail (jpg made by ffmpeg once; an svg is served as itself). */
export function thumbUrl(project: string, m: MediaItem): string { return `${bridgePaths(project).root}/thumb/${encodeURIComponent(m.id)}?v=${encodeURIComponent(m.added)}` }


// ── Library (A6): assets shared across projects (Camtasia: Media tab › Library) ──
export type LibraryItem = MediaItem & { folder: string; exists?: boolean }
export type LibraryDoc = { version: number; items: LibraryItem[] }
export function libraryFolders(doc: LibraryDoc): string[] { return [...new Set(doc.items.map((i) => i.folder))].sort() }
export const DEFAULT_FOLDERS = ['device-frames', 'brand', 'misc']
export async function loadLibrary(): Promise<LibraryDoc> { const r = await fetch(`/library?v=${Date.now()}`); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
export async function addToLibrary(project: string, id: string, folder: string): Promise<LibraryDoc> {
  const r = await fetch('/library/add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project, id, folder }) })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json()
}
export async function deleteLibraryItem(id: string): Promise<LibraryDoc> { const r = await fetch(`/library/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
export async function addFromLibrary(project: string, id: string): Promise<ProjectDoc> {
  return json(await fetch(`${bridgePaths(project).media}/from-library`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }))
}
export function libraryThumbUrl(it: LibraryItem): string { return `/library/thumb/${encodeURIComponent(it.id)}?v=${encodeURIComponent(it.added)}` }
