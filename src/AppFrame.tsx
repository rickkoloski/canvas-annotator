import { useEffect, useRef, useState } from 'react'
import { createAnimation, createProject, listProjects, pageUrl, readRecent, rememberRecent, saveProjectAs, DEFAULT_CANVAS, SAFE_NAME, type Canvas, type ProjectDoc, type ProjectSummary } from './project'

/**
 * App frame A2 (plans/2026-10-10_app-frame.md): the File menu and project bar, with Camtasia's names:
 * New Project…, Open Project…, Open Recent, Save (⌘S), Save As…, Close Project. Explicit saves with an
 * unsaved dot (Rick, decision 5). Dialogs are in-page; nothing uses window.alert/confirm/prompt.
 */
export function AppFrame({ project, dirty, onSave, shot, view, error, anim }: {
  project: ProjectDoc | null; dirty: boolean; onSave: () => Promise<boolean>; shot: string; view: string; error?: string; anim?: string
}) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<null | 'new' | 'open' | 'saveas' | 'newanim' | { unsaved: () => void }>(null)
  const [msg, setMsg] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const recent = readRecent()

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  // ⌘S / Ctrl-S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save() } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave])

  const save = async () => { const ok = await onSave(); setMsg(ok ? 'saved' : 'save failed'); window.setTimeout(() => setMsg(''), 2500); return ok }
  const go = (url: string) => { window.location.assign(url) }
  /** Run `then` now, or after the unsaved-changes dialog when there are unsaved changes. */
  const guarded = (then: () => void) => { setOpen(false); if (dirty) setDialog({ unsaved: then }); else then() }
  const item = (testid: string, label: string, onClick: () => void, extra?: React.ReactNode, disabled = false) => (
    <button data-testid={testid} disabled={disabled} onClick={onClick} className="flex items-center justify-between gap-6 w-full text-left px-3 py-1.5 text-sm text-ws-text-primary hover:bg-[rgba(224,155,88,.18)] disabled:opacity-40 disabled:hover:bg-transparent">
      <span>{label}</span>{extra && <span className="font-ws-mono text-[0.65rem] text-ws-text-tertiary">{extra}</span>}
    </button>
  )

  return (
    <div data-testid="app-frame" className="flex items-center gap-3 mb-3 -mt-2">
      <div ref={menuRef} className="relative">
        <button data-testid="file-menu" onClick={() => setOpen((o) => !o)} className={`ann-chip ${open ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`}>File ▾</button>
        {open && (
          <div data-testid="file-menu-list" className="glass absolute left-0 top-full mt-1 z-[60] min-w-[220px] rounded-xl py-1 shadow-2xl">
            {item('file-new', 'New Project…', () => guarded(() => setDialog('new')))}
            {item('file-open', 'Open Project…', () => guarded(() => setDialog('open')))}
            <div className="px-3 pt-2 pb-1 font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-text-tertiary">Open Recent</div>
            {recent.length === 0 && <div className="px-3 pb-1 text-xs text-ws-text-tertiary">none yet</div>}
            {recent.map((n) => item(`file-recent-${n}`, n, () => guarded(() => go(pageUrl(n)))))}
            <div className="my-1 border-t border-ws-border-subtle" />
            {item('file-save', 'Save', () => { setOpen(false); void save() }, '⌘S')}
            {item('file-saveas', 'Save As…', () => { setOpen(false); setDialog('saveas') }, undefined, !project)}
            <div className="my-1 border-t border-ws-border-subtle" />
            {item('file-newanim', 'New Animation…', () => { setOpen(false); setDialog('newanim') }, 'Remotion', !project)}
            <div className="my-1 border-t border-ws-border-subtle" />
            {item('file-close', 'Close Project', () => guarded(() => go(pageUrl(null))), undefined, !project)}
          </div>
        )}
      </div>
      <span data-testid="project-name" className="font-ws-mono text-sm text-ws-text-primary flex items-center gap-1.5">
        <span className="text-ws-text-tertiary text-xs">project</span>
        {project ? project.name : <span className="text-ws-text-tertiary">none · legacy shots</span>}
        {dirty && <span data-testid="unsaved-dot" title="unsaved changes" className="text-ws-terracotta-text">●</span>}
      </span>
      {project && <span className="font-ws-mono text-[0.65rem] text-ws-text-tertiary">{project.canvas.width}×{project.canvas.height} · {project.canvas.fps} fps · {project.media.length} media · {project.shots.length} shot{project.shots.length === 1 ? '' : 's'}</span>}
      {project && (project.animations?.length ?? 0) > 0 && (
        <label className="flex items-center gap-1 font-ws-mono text-xs text-ws-text-tertiary">animation
          <select data-testid="anim-select" value={anim && project.animations?.includes(anim) ? anim : ''} onChange={(e) => guarded(() => go(e.target.value ? pageUrl(project.name, undefined, undefined, e.target.value) : pageUrl(project.name, shot, view)))} className="ann-btn">
            <option value="">(none)</option>
            {project.animations?.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      )}
      {project && project.shots.length > 0 && (
        <label className="flex items-center gap-1 font-ws-mono text-xs text-ws-text-tertiary">shot
          <select data-testid="shot-select" value={project.shots.includes(shot) ? shot : ''} onChange={(e) => guarded(() => go(pageUrl(project.name, e.target.value, view)))} className="ann-btn">
            <option value="">{shot && !project.shots.includes(shot) ? shot : '(choose)'}</option>
            {project.shots.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
      {msg && <span data-testid="frame-status" className="font-ws-mono text-xs text-ws-sage">{msg}</span>}
      {error && <span data-testid="frame-error" className="font-ws-mono text-xs text-ws-terracotta-text">{error}</span>}

      {dialog === 'new' && <NewProjectDialog onClose={() => setDialog(null)} onCreate={async (name, canvas) => { const p = await createProject(name, canvas); rememberRecent(p.name); go(pageUrl(p.name)) }} />}
      {dialog === 'open' && <OpenProjectDialog onClose={() => setDialog(null)} onOpen={(n) => { rememberRecent(n); go(pageUrl(n)) }} />}
      {dialog === 'newanim' && project && <NewAnimationDialog onClose={() => setDialog(null)} onCreate={async (name) => { await createAnimation(project.name, name); go(pageUrl(project.name, undefined, undefined, name)) }} />}
      {dialog === 'saveas' && project && <SaveAsDialog from={project.name} onClose={() => setDialog(null)} onSaved={(n) => { rememberRecent(n); go(pageUrl(n, shot, view)) }} />}
      {dialog && typeof dialog === 'object' && (
        <Modal title="Unsaved changes" testid="dialog-unsaved" onClose={() => setDialog(null)}>
          <p className="text-sm text-ws-text-secondary mb-3">The project has unsaved changes.</p>
          <div className="flex gap-2 justify-end">
            <button data-testid="unsaved-cancel" className="ann-btn" onClick={() => setDialog(null)}>Cancel</button>
            <button data-testid="unsaved-discard" className="ann-btn" onClick={() => { const t = dialog.unsaved; setDialog(null); t() }}>Don't Save</button>
            <button data-testid="unsaved-save" className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]" onClick={async () => { const t = dialog.unsaved; if (await save()) { setDialog(null); t() } }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, testid, children, onClose }: { title: string; testid: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div data-testid={testid} className="glass rounded-2xl p-5 w-[460px] shadow-2xl">
        <div className="font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text mb-3">{title}</div>
        {children}
      </div>
    </div>
  )
}

const inp = 'font-ws-mono text-sm bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 outline-none focus:border-ws-terracotta'

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, canvas: Canvas) => Promise<void> }) {
  const [name, setName] = useState(''); const [c, setC] = useState<Canvas>(DEFAULT_CANVAS); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const ok = SAFE_NAME.test(name) && c.width > 0 && c.height > 0 && c.fps > 0
  const submit = async () => { if (!ok || busy) return; setBusy(true); try { await onCreate(name, c) } catch (e) { setErr(String((e as Error).message ?? e)); setBusy(false) } }
  const num = (k: keyof Canvas) => <input data-testid={`new-${k}`} type="number" value={c[k]} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} className={`${inp} w-24`} />
  return (
    <Modal title="New Project" testid="dialog-new" onClose={onClose}>
      <label className="flex flex-col gap-1 text-xs text-ws-text-secondary mb-3">Project name
        <input data-testid="new-name" autoFocus value={name} onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} placeholder="laptop-demo" className={inp} /></label>
      <div className="flex items-end gap-3 mb-3 text-xs text-ws-text-secondary">
        <label className="flex flex-col gap-1">Canvas width{num('width')}</label>
        <label className="flex flex-col gap-1">height{num('height')}</label>
        <label className="flex flex-col gap-1">frame rate{num('fps')}</label>
        <div className="flex gap-1 pb-1">{[[1920, 1080], [3840, 2160], [1080, 1920]].map(([w, h]) => <button key={w + 'x' + h} className="ann-btn" onClick={() => setC({ ...c, width: w, height: h })}>{w}×{h}</button>)}</div>
      </div>
      {err && <div data-testid="new-error" className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={onClose}>Cancel</button>
        <button data-testid="new-create" disabled={!ok || busy} onClick={() => void submit()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{busy ? 'creating…' : 'Create'}</button></div>
    </Modal>
  )
}

function OpenProjectDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (name: string) => void }) {
  const [list, setList] = useState<ProjectSummary[] | null>(null); const [err, setErr] = useState('')
  useEffect(() => { listProjects().then(setList).catch((e) => setErr(String(e.message ?? e))) }, [])
  return (
    <Modal title="Open Project" testid="dialog-open" onClose={onClose}>
      {err && <div className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      {list && list.length === 0 && <div className="text-sm text-ws-text-tertiary">no projects yet · File › New Project…</div>}
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {list?.map((p) => (
          <button key={p.name} data-testid={`open-${p.name}`} onClick={() => onOpen(p.name)} className="flex items-center justify-between gap-4 text-left px-3 py-2 rounded-lg hover:bg-[rgba(224,155,88,.18)]">
            <span className="font-ws-mono text-sm text-ws-text-primary">{p.name}</span>
            <span className="font-ws-mono text-[0.65rem] text-ws-text-tertiary">{p.canvas.width}×{p.canvas.height} · {p.shots} shot{p.shots === 1 ? '' : 's'} · {p.media} media · {p.modified ? new Date(p.modified).toLocaleString() : ''}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-3"><button className="ann-btn" onClick={onClose}>Cancel</button></div>
    </Modal>
  )
}

function SaveAsDialog({ from, onClose, onSaved }: { from: string; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(`${from}-copy`); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const ok = SAFE_NAME.test(name) && name !== from
  const submit = async () => { if (!ok || busy) return; setBusy(true); try { const p = await saveProjectAs(from, name); onSaved(p.name) } catch (e) { setErr(String((e as Error).message ?? e)); setBusy(false) } }
  return (
    <Modal title="Save As" testid="dialog-saveas" onClose={onClose}>
      <p className="text-xs text-ws-text-secondary mb-2">Copies the project (project.json, media, shots) to a new directory. Derived work is rebuilt by the engine.</p>
      <input data-testid="saveas-name" autoFocus value={name} onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} className={`${inp} w-full mb-3`} />
      {err && <div className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={onClose}>Cancel</button>
        <button data-testid="saveas-go" disabled={!ok || busy} onClick={() => void submit()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{busy ? 'copying…' : 'Save As'}</button></div>
    </Modal>
  )
}

function NewAnimationDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const ok = SAFE_NAME.test(name)
  const submit = async () => { if (!ok || busy) return; setBusy(true); try { await onCreate(name) } catch (e) { setErr(String((e as Error).message ?? e)); setBusy(false) } }
  return (
    <Modal title="New Animation" testid="dialog-newanim" onClose={onClose}>
      <p className="text-xs text-ws-text-secondary mb-2">A Remotion animation inside this project: <span className="font-ws-mono">animations/&lt;name&gt;/</span> with its entry file and props.json, copied from the brand template. Media comes from this project's Media Bin.</p>
      <input data-testid="newanim-name" autoFocus value={name} onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} placeholder="laptop-intro" className={`${inp} w-full mb-3`} />
      {err && <div className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={onClose}>Cancel</button>
        <button data-testid="newanim-create" disabled={!ok || busy} onClick={() => void submit()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{busy ? 'creating…' : 'Create'}</button></div>
    </Modal>
  )
}
