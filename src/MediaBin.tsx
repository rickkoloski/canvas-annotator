import { useEffect, useRef, useState } from 'react'
import type { MediaItem, ProjectDoc } from './project'
import { addFromLibrary, addMediaFromPath, addToLibrary, deleteLibraryItem, deleteMedia, fmtDuration, fmtSize, importMediaFiles, libraryFolders, libraryThumbUrl, loadLibrary, mediaInfo, mediaKind, renameMedia, sortMedia, thumbUrl, DEFAULT_FOLDERS, type LibraryDoc, type LibraryItem, type MediaInfo, type SortBy, type View } from './media'
import { Select } from './lib/ui/Select'

/**
 * Media tab (app frame A3), Camtasia's Media Bin: Import Media (picker, drop, or a path on this Mac with
 * "link instead of copying"), thumbnails in three sizes or a list, Sort by, rename and delete from a
 * right-click menu, Select Unused / Delete Unused, a chain badge on linked items and "missing" when a file
 * is gone. The bridge owns the files and writes project.json; the panel just shows the document it returns.
 * The Library subtab arrives in A6.
 */
export function MediaBin({ project, onProject }: { project: ProjectDoc; onProject: (p: ProjectDoc) => void }) {
  const [tab, setTab] = useState<'bin' | 'library'>('bin')
  const [view, setView] = useState<View>('medium'); const [sortBy, setSortBy] = useState<SortBy>('date'); const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [info, setInfo] = useState<MediaInfo>({}); const [sel, setSel] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [pathDlg, setPathDlg] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [over, setOver] = useState(false)
  // A6: the Library (cross-project); loaded when its tab opens
  const [lib, setLib] = useState<LibraryDoc>({ version: 1, items: [] }); const [libFolder, setLibFolder] = useState(''); const [libDlg, setLibDlg] = useState<string | null>(null)
  const [libMenu, setLibMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const refreshLib = () => loadLibrary().then(setLib).catch((e) => setErr(String(e.message ?? e)))
  useEffect(() => { if (tab === 'library') void refreshLib() }, [tab])
  const libRun = async (label: string, f: () => Promise<LibraryDoc>) => { if (busy) return; setBusy(label); setErr(''); try { setLib(await f()) } catch (e) { setErr(String((e as Error).message ?? e)) } finally { setBusy('') } }
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshInfo = () => mediaInfo(project.name).then(setInfo).catch(() => setInfo({}))
  useEffect(() => { void refreshInfo() }, [project.name, project.media.length, project.modified])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => { setMenu(null); setLibMenu(null) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])

  const run = async (label: string, f: () => Promise<ProjectDoc>) => {
    if (busy) return; setBusy(label); setErr('')
    try { onProject(await f()) } catch (e) { setErr(String((e as Error).message ?? e)) } finally { setBusy('') }
  }
  const importFiles = (files: FileList | File[] | null) => { const fs = files ? Array.from(files) : []; if (fs.length) void run('importing…', () => importMediaFiles(project.name, fs)) }
  const unused = project.media.filter((m) => info[m.id] && info[m.id].usedBy.length === 0).map((m) => m.id)
  const items = sortMedia(project.media, sortBy, dir)
  const toggle = (id: string, multi: boolean) => setSel((s) => { const n = multi ? new Set(s) : new Set<string>(); if (s.has(id) && multi) n.delete(id); else n.add(id); return n })
  const del = async (ids: string[]) => { for (const id of ids) await run('deleting…', () => deleteMedia(project.name, id)); setSel(new Set()) }

  const thumbH = view === 'large' ? 110 : view === 'medium' ? 72 : 44
  const Badge = ({ m }: { m: MediaItem }) => {
    const i = info[m.id]
    return (<span className="flex gap-1">
      {m.linked && <span data-testid={`media-linked-${m.id}`} title={`linked, not copied: ${m.file}`} className="font-ws-mono text-[0.6rem] px-1 rounded bg-[rgba(127,163,160,.25)] text-ws-sage">⛓ linked</span>}
      {i && !i.exists && <span data-testid={`media-missing-${m.id}`} title={m.file} className="font-ws-mono text-[0.6rem] px-1 rounded bg-[rgba(192,106,69,.35)] text-ws-terracotta-text">missing</span>}
      {i && i.usedBy.length === 0 && i.exists && <span title="no shot references it" className="font-ws-mono text-[0.6rem] px-1 rounded text-ws-text-tertiary border border-ws-border-subtle">unused</span>}
    </span>)
  }
  const facts = (m: MediaItem) => [m.width && m.height ? `${m.width}×${m.height}` : '', m.duration !== undefined ? fmtDuration(m.duration) : '', m.fps ? `${m.fps} fps` : '', fmtSize(m.size)].filter(Boolean).join(' · ')
  const Thumb = ({ m, h }: { m: MediaItem; h: number }) => {
    const i = info[m.id]; const kind = mediaKind(m.type)
    if (i && !i.exists) return <div style={{ height: h }} className="flex items-center justify-center rounded bg-black/40 text-ws-terracotta-text text-xs">missing</div>
    if (kind === 'image' || kind === 'video') return <img src={thumbUrl(project.name, m)} alt="" style={{ height: h }} className="w-full object-contain rounded bg-black/40" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
    return <div style={{ height: h }} className="flex items-center justify-center rounded bg-black/40 font-ws-mono text-xs text-ws-text-tertiary">{kind === 'audio' ? '♪' : '▤'} {m.type.split('/')[1]}</div>
  }

  return (
    <aside data-testid="media-tab" className="flex flex-col gap-2 p-3 min-h-0 overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files) }}>
      <div className="flex gap-1 items-center">
        <button data-testid="tab-media-bin" onClick={() => setTab('bin')} className={`ann-chip !text-xs ${tab === 'bin' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`}>Media Bin</button>
        <button data-testid="tab-library" onClick={() => setTab('library')} className={`ann-chip !text-xs ${tab === 'library' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`}>Library</button>
      </div>
      {tab === 'library' && (<>
        <div className="flex flex-wrap items-center gap-1">
          <Select testid="library-folder" value={libFolder} onChange={setLibFolder} title="Folder" options={[{ value: '', label: 'all folders' }, ...libraryFolders(lib).map((f) => ({ value: f, label: f }))]} />
          <span className="font-ws-mono text-[0.62rem] text-ws-text-tertiary ml-auto" data-testid="library-count">{lib.items.length} item{lib.items.length === 1 ? '' : 's'} · shared by every project</span>
        </div>
        {busy && <div className="text-xs text-ws-sage font-ws-mono">{busy}</div>}
        {err && <div data-testid="library-error" className="text-xs text-ws-terracotta-text font-ws-mono">{err}</div>}
        <div data-testid="library-list" className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg p-1 grid gap-2 content-start" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {lib.items.length === 0 && <div className="text-xs text-ws-text-tertiary p-3 text-center col-span-2">Empty. Right-click a Media Bin item › Add to Library…</div>}
          {lib.items.filter((it) => !libFolder || it.folder === libFolder).map((it) => (
            <div key={it.id} data-testid={`lib-${it.id}`} onContextMenu={(e) => { e.preventDefault(); setLibMenu({ id: it.id, x: e.clientX, y: e.clientY }) }} draggable
              onDragStart={(e) => { e.dataTransfer.setData('application/x-library-id', it.id); e.dataTransfer.setData('text/plain', it.file) }}
              className="min-w-0 rounded-lg p-1.5 border border-transparent hover:border-ws-border-strong flex flex-col gap-1">
              {it.exists === false ? <div style={{ height: 72 }} className="flex items-center justify-center rounded bg-black/40 text-ws-terracotta-text text-xs">missing</div>
                : mediaKind(it.type) === 'image' || mediaKind(it.type) === 'video' ? <img src={libraryThumbUrl(it)} alt="" style={{ height: 72 }} className="w-full object-contain rounded bg-black/40" />
                : <div style={{ height: 72 }} className="flex items-center justify-center rounded bg-black/40 font-ws-mono text-xs text-ws-text-tertiary">{it.type.split('/')[1]}</div>}
              <div className="font-ws-mono text-xs text-ws-text-primary truncate" title={it.file}>{it.id}</div>
              <div className="font-ws-mono text-[0.6rem] text-ws-text-tertiary truncate">{it.folder} · {facts(it)}</div>
              <button data-testid={`lib-add-${it.id}`} disabled={!!busy} onClick={() => void run('adding to project…', () => addFromLibrary(project.name, it.id))} className="ann-btn !text-[0.62rem]">add to project</button>
            </div>
          ))}
        </div>
      </>)}
      {tab === 'bin' && (<>
        <div className="flex flex-wrap items-center gap-1">
          <input ref={fileRef} data-testid="media-file-input" type="file" multiple className="hidden" onChange={(e) => { importFiles(e.target.files); e.target.value = '' }} />
          <button data-testid="media-import" disabled={!!busy} onClick={() => fileRef.current?.click()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">⊕ Import Media</button>
          <button data-testid="media-from-path" disabled={!!busy} onClick={() => setPathDlg(true)} className="ann-btn" title="A file on this Mac, by path; copy or link">from path…</button>
          <Select testid="media-view" value={view} onChange={(v) => setView(v as View)} title="Media Bin view" options={(['large', 'medium', 'small', 'list'] as View[]).map((v) => ({ value: v, label: v === 'list' ? 'list view' : `${v} thumbnails` }))} />
          <Select testid="media-sort" value={sortBy} onChange={(v) => setSortBy(v as SortBy)} title="Sort by" options={(['name', 'type', 'date', 'size'] as SortBy[]).map((v) => ({ value: v, label: `sort: ${v}` }))} />
          <button data-testid="media-sort-dir" onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="ann-btn" title={dir === 'asc' ? 'Ascending' : 'Descending'}>{dir === 'asc' ? '↑' : '↓'}</button>
        </div>
        <div className="flex items-center gap-1 font-ws-mono text-[0.62rem] text-ws-text-tertiary">
          <span data-testid="media-count">{project.media.length} item{project.media.length === 1 ? '' : 's'}{sel.size ? ` · ${sel.size} selected` : ''}</span>
          <span className="ml-auto flex gap-1">
            <button data-testid="media-select-unused" disabled={!unused.length} onClick={() => setSel(new Set(unused))} className="ann-btn disabled:opacity-40">select unused</button>
            <button data-testid="media-delete-unused" disabled={!unused.length || !!busy} onClick={() => void del(unused)} className="ann-btn disabled:opacity-40">delete unused</button>
          </span>
        </div>
        {busy && <div className="text-xs text-ws-sage font-ws-mono">{busy}</div>}
        {err && <div data-testid="media-error" className="text-xs text-ws-terracotta-text font-ws-mono">{err}</div>}
        {/* P1 (walk 4, Rick): the bin scrolls vertically only; columns are minmax(0, 1fr) so a long name never widens the grid */}
        <div data-testid="media-list" className={`flex-1 overflow-y-auto overflow-x-hidden rounded-lg p-1 border ${over ? 'border-ws-terracotta bg-[rgba(224,155,88,.08)]' : 'border-transparent'} ${view === 'list' ? 'flex flex-col gap-0.5' : 'grid gap-2 content-start'}`}
          style={view === 'list' ? undefined : { gridTemplateColumns: `repeat(${view === 'small' ? 3 : view === 'medium' ? 2 : 1}, minmax(0, 1fr))` }}>
          {items.length === 0 && <div className="text-xs text-ws-text-tertiary p-3 text-center col-span-3">Import Media, or drop files here</div>}
          {items.map((m) => {
            const selected = sel.has(m.id)
            return (
              <div key={m.id} data-testid={`media-${m.id}`} onClick={(e) => toggle(m.id, e.metaKey || e.ctrlKey || e.shiftKey)} onDoubleClick={() => setRenaming({ id: m.id, value: m.id })}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ id: m.id, x: e.clientX, y: e.clientY }) }} draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-media-id', m.id); e.dataTransfer.setData('text/plain', m.file) }}
                className={`min-w-0 rounded-lg p-1.5 cursor-pointer border ${selected ? 'border-ws-terracotta bg-[rgba(224,155,88,.12)]' : 'border-transparent hover:border-ws-border-strong'} ${view === 'list' ? 'flex items-center gap-2' : 'flex flex-col gap-1'}`}>
                {view === 'list' ? <div className="w-12 shrink-0"><Thumb m={m} h={28} /></div> : <Thumb m={m} h={thumbH} />}
                <div className="min-w-0 flex-1">
                  {renaming?.id === m.id
                    ? <input data-testid={`media-rename-${m.id}`} autoFocus value={renaming.value} onChange={(e) => setRenaming({ id: m.id, value: e.target.value })} onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter') { const to = renaming.value.trim(); setRenaming(null); if (to && to !== m.id) void run('renaming…', () => renameMedia(project.name, m.id, to)) } if (e.key === 'Escape') setRenaming(null) }}
                        onBlur={() => setRenaming(null)} className="font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-terracotta rounded px-1 w-full outline-none" />
                    : <div data-testid={`media-name-${m.id}`} className="font-ws-mono text-xs text-ws-text-primary truncate" title={m.file}>{m.id}</div>}
                  {view !== 'small' && <div className="font-ws-mono text-[0.6rem] text-ws-text-tertiary truncate">{mediaKind(m.type)} · {facts(m)}</div>}
                  <Badge m={m} />
                </div>
              </div>
            )
          })}
        </div>
      </>)}

      {menu && (
        <div data-testid="media-menu" className="glass fixed z-[80] rounded-xl py-1 min-w-[160px] shadow-2xl" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          {[['menu-rename', 'Rename', () => setRenaming({ id: menu.id, value: menu.id })], ['menu-add-library', 'Add to Library…', () => setLibDlg(menu.id)], ['menu-delete', 'Delete', () => void del([menu.id])]].map(([tid, label, fn]) => (
            <button key={tid as string} data-testid={tid as string} onClick={() => { setMenu(null); (fn as () => void)() }} className="block w-full text-left px-3 py-1.5 text-sm text-ws-text-primary hover:bg-[rgba(224,155,88,.18)]">{label as string}</button>
          ))}
          <div className="px-3 py-1 font-ws-mono text-[0.6rem] text-ws-text-tertiary truncate max-w-[260px]">{project.media.find((m) => m.id === menu.id)?.file}</div>
        </div>
      )}
      {libMenu && (
        <div data-testid="library-menu" className="glass fixed z-[80] rounded-xl py-1 min-w-[160px] shadow-2xl" style={{ left: libMenu.x, top: libMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button data-testid="libmenu-add" onClick={() => { const id = libMenu.id; setLibMenu(null); void run('adding to project…', () => addFromLibrary(project.name, id)) }} className="block w-full text-left px-3 py-1.5 text-sm text-ws-text-primary hover:bg-[rgba(224,155,88,.18)]">Add to project</button>
          <button data-testid="libmenu-delete" onClick={() => { const id = libMenu.id; setLibMenu(null); void libRun('deleting…', () => deleteLibraryItem(id)) }} className="block w-full text-left px-3 py-1.5 text-sm text-ws-text-primary hover:bg-[rgba(224,155,88,.18)]">Delete from Library</button>
        </div>
      )}
      {libDlg && <AddToLibraryDialog id={libDlg} folders={[...new Set([...DEFAULT_FOLDERS, ...libraryFolders(lib)])]} onClose={() => setLibDlg(null)}
        onAdd={async (folder) => { const id = libDlg; setLibDlg(null); await libRun('adding to Library…', () => addToLibrary(project.name, id, folder)); setTab('library') }} />}
      {pathDlg && <FromPathDialog onClose={() => setPathDlg(false)} onAdd={async (p, link) => { setPathDlg(false); await run(link ? 'linking…' : 'copying…', () => addMediaFromPath(project.name, p, link)) }} />}
    </aside>
  )
}

function FromPathDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (path: string, link: boolean) => Promise<void> }) {
  const [p, setP] = useState(''); const [link, setLink] = useState(false)
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div data-testid="dialog-from-path" className="glass rounded-2xl p-5 w-[520px] shadow-2xl">
        <div className="font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text mb-3">Import Media from a path</div>
        <p className="text-xs text-ws-text-secondary mb-2">A file on this Mac. Copied into the project by default (standalone, as Camtasia does); link it instead to leave a large master where it is.</p>
        <input data-testid="from-path-input" autoFocus value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && p.trim()) void onAdd(p.trim(), link) }} placeholder="~/Desktop/frustration.mov"
          className="font-ws-mono text-sm bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 outline-none focus:border-ws-terracotta w-full mb-2" />
        <label className="flex items-center gap-2 text-xs text-ws-text-secondary mb-3"><input data-testid="from-path-link" type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> link instead of copying (⛓ badge; "missing" if the file moves)</label>
        <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={onClose}>Cancel</button>
          <button data-testid="from-path-add" disabled={!p.trim()} onClick={() => void onAdd(p.trim(), link)} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{link ? 'Link' : 'Copy in'}</button></div>
      </div>
    </div>
  )
}


function AddToLibraryDialog({ id, folders, onClose, onAdd }: { id: string; folders: string[]; onClose: () => void; onAdd: (folder: string) => Promise<void> }) {
  const [folder, setFolder] = useState(folders[0] ?? 'misc'); const [custom, setCustom] = useState('')
  const chosen = custom.trim() || folder; const ok = /^[A-Za-z0-9][\w.-]{0,63}$/.test(chosen)
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div data-testid="dialog-add-library" className="glass rounded-2xl p-5 w-[440px] shadow-2xl">
        <div className="font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text mb-3">Add to Library</div>
        <p className="text-xs text-ws-text-secondary mb-2">A copy of <span className="font-ws-mono text-ws-text-primary">{id}</span> goes to the Library, shared by every project (Camtasia: Library › folder).</p>
        <div className="flex items-center gap-2 mb-3 text-xs text-ws-text-secondary">folder
          <Select testid="add-library-folder" value={folder} onChange={setFolder} options={folders.map((f) => ({ value: f, label: f }))} />
          <input data-testid="add-library-new" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="or a new folder" className="font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 outline-none focus:border-ws-terracotta w-36" />
        </div>
        <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={onClose}>Cancel</button>
          <button data-testid="add-library-go" disabled={!ok} onClick={() => void onAdd(chosen)} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">Add to Library</button></div>
      </div>
    </div>
  )
}
