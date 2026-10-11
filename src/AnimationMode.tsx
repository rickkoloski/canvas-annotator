import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SelectionBox } from './lib/ui/SelectionBox'
import type { Box } from './lib/ui/handles'
import { bridgePaths, type ProjectDoc } from './project'
import { addFromLibrary } from './media'
import { Select } from './lib/ui/Select'

/**
 * Animation mode (app frame A5b): an animation is projects/<name>/animations/<anim>/ (a Remotion entry file +
 * props.json). The canvas shows a still rendered by the CLI at the chosen frame; a Media Bin item dropped on it
 * becomes a layer in props.json (the truth; Remotion Studio edits the same file). Render draft → renders/<anim>_draft.mp4.
 */
export type Layer = { id: string; media: string; x: number; y: number; width: number; start: number; end?: number | null; in?: string; out?: string }
export type AnimProps = { id: string; title: string; width: number; height: number; fps: number; duration: number; background?: string; layers: Layer[]; texts: { id: string; text: string; x: number; y: number; size: number; start: number; end?: number | null }[] }

async function runRemotion(body: Record<string, unknown>, onChunk: (s: string) => void): Promise<number> {
  const r = await fetch('/remotion/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok || !r.body) { onChunk(`bridge error ${r.status}: ${await r.text()}\n`); return 127 }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let all = ''
  for (;;) { const { value, done } = await reader.read(); if (done) break; const s = dec.decode(value, { stream: true }); all += s; onChunk(s) }
  const m = /exit (\d+)\s*$/.exec(all); return m ? Number(m[1]) : 1
}

export function AnimationMode({ projectDoc, anim, onProject, layersSlot }: { projectDoc: ProjectDoc; anim: string; onProject: (p: ProjectDoc) => void; layersSlot?: HTMLElement | null }) {
  const paths = bridgePaths(projectDoc.name); const adir = `${paths.root}/animations/${encodeURIComponent(anim)}`
  const [props, setProps] = useState<AnimProps | null>(null); const [err, setErr] = useState('')
  const [frame, setFrame] = useState(12); const [stillKey, setStillKey] = useState(0); const [shown, setShown] = useState<number | null>(null)   // shown = the frame whose still is on screen
  const [busy, setBusy] = useState(''); const [out, setOut] = useState('')
  const [draft, setDraft] = useState(''); const [studio, setStudio] = useState(''); const [over, setOver] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<{ kind: 'layer' | 'text'; i: number } | null>(null); const [rev, setRev] = useState(0)

  const load = async () => {
    const r = await fetch(`${adir}/props.json?v=${Date.now()}`); if (!r.ok) { setErr(`cannot read props.json (${r.status})`); return }
    setProps(await r.json()); setErr('')
    fetch(`${paths.renders}/${anim}_draft.mp4`, { method: 'HEAD' }).then((h) => setDraft(h.ok ? `${paths.renders}/${anim}_draft.mp4?v=${Date.now()}` : ''))
  }
  useEffect(() => { void load() }, [anim])   // eslint-disable-line react-hooks/exhaustive-deps
  const pending = useRef<number | null>(null); const busyRef = useRef(false)
  /** Render the still for frame f; while one is rendering the latest request waits and runs next (scrubbing never loses the last frame). */
  const still = async (f = frame) => {
    if (busyRef.current) { pending.current = f; return }
    busyRef.current = true; setBusy('still'); setOut('')
    const code = await runRemotion({ project: projectDoc.name, anim, op: 'still', frame: f }, (s) => setOut((o) => o + s))
    busyRef.current = false; setBusy(''); if (code === 0) { setShown(f); setStillKey((k) => k + 1) }
    const next = pending.current; pending.current = null
    if (next !== null && next !== f) void still(next)
  }
  useEffect(() => { if (props) void still(frame) }, [props?.layers.length, props?.texts.length, frame, rev])   // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next: AnimProps) => {
    const r = await fetch(`${adir}/props.json`, { method: 'PUT', body: JSON.stringify(next, null, 2) })
    if (!r.ok) { setErr(`save failed ${r.status}`); return } setProps(next); setRev((v) => v + 1)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) || !props || !selected) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); void save(selected.kind === 'layer' ? { ...props, layers: props.layers.filter((_, k) => k !== selected.i) } : { ...props, texts: props.texts.filter((_, k) => k !== selected.i) }); setSelected(null) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [props, selected])   // eslint-disable-line react-hooks/exhaustive-deps
  const onDrop = async (e: React.DragEvent) => {
    let id = e.dataTransfer.getData('application/x-media-id'); const libId = e.dataTransfer.getData('application/x-library-id')
    if ((!id && !libId) || !props) return
    e.preventDefault(); setOver(false)
    let doc = projectDoc
    if (libId) { doc = await addFromLibrary(projectDoc.name, libId); onProject(doc); id = doc.media[doc.media.length - 1]?.id ?? '' }
    const m = doc.media.find((x) => x.id === id); if (!m) return
    if (m.linked) { setErr('a linked file is outside the project\'s media/, which Remotion serves; copy it in first'); return }
    const box = canvasRef.current?.getBoundingClientRect(); if (!box) return
    const x = +((e.clientX - box.left) / box.width).toFixed(3), y = +((e.clientY - box.top) / box.height).toFixed(3)
    const file = m.file.split('/').pop() ?? m.file; let lid = m.id, i = 2; while (props.layers.some((l) => l.id === lid)) lid = `${m.id}-${i++}`
    await save({ ...props, layers: [...props.layers, { id: lid, media: file, x, y, width: 0.3, start: +(frame / props.fps).toFixed(2), end: null, in: 'spring', out: 'fade' }] })
    setFrame((f) => Math.min(Math.round(props.duration * props.fps) - 1, f + Math.round(props.fps / 2)))   // preview half a second in, past the spring's start, so the layer is visible
  }
  const render = async () => {
    if (busy) return; setBusy('render'); setOut('')
    const code = await runRemotion({ project: projectDoc.name, anim, op: 'render' }, (s) => setOut((o) => o + s))
    setBusy(''); if (code === 0) setDraft(`${paths.renders}/${anim}_draft.mp4?v=${Date.now()}`)
  }
  const openStudio = async () => {
    setBusy('studio'); const r = await fetch('/remotion/studio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: projectDoc.name, anim }) })
    setBusy(''); if (!r.ok) { setErr(`studio: ${await r.text()}`); return } setStudio((await r.json()).url)
  }
  const stopStudio = async () => { await fetch('/remotion/studio', { method: 'DELETE' }); setStudio('') }
  const upd = (i: number, patch: Partial<Layer>) => props && save({ ...props, layers: props.layers.map((l, k) => (k === i ? { ...l, ...patch } : l)) })
  const inp = 'font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-border-subtle rounded px-1 py-0.5 outline-none focus:border-ws-terracotta'

  if (!props) return <div data-testid="anim-error" className="text-sm text-ws-terracotta-text">{err || 'loading…'}</div>
  const frames = Math.round(props.duration * props.fps)
  const isSel = (kind: 'layer' | 'text', i: number) => selected?.kind === kind && selected.i === i
  const layersList = (
    <div data-testid="anim-layers" className={`flex flex-col gap-1 ${layersSlot ? 'p-3' : 'mt-2 rounded-lg px-3 py-2'}`} style={layersSlot ? undefined : { background: 'rgba(250,247,240,.04)' }}>
      <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">layers <span className="text-ws-text-tertiary normal-case tracking-normal">· props.json · Remotion Studio edits the same file</span></span>
      {props.layers.length === 0 && props.texts.length === 0 && <span className="text-xs text-ws-text-tertiary">none yet</span>}
      {props.layers.map((l, i) => (
        <div key={l.id} data-testid={`layer-${i}`} data-selected={isSel('layer', i) ? 'true' : 'false'} onClick={() => setSelected(isSel('layer', i) ? null : { kind: 'layer', i })}
          className={`flex flex-col gap-1 rounded-lg px-2 py-1.5 border cursor-pointer ${isSel('layer', i) ? 'border-ws-terracotta bg-[rgba(224,155,88,.12)]' : 'border-transparent hover:border-ws-border-strong'}`}>
          <div className="flex items-center gap-2 font-ws-mono text-xs"><span className="text-ws-text-primary">{i} · {l.id}</span><span className="truncate text-ws-text-secondary">{l.media}</span>
            <button data-testid={`layer-remove-${i}`} onClick={(e) => { e.stopPropagation(); void save({ ...props, layers: props.layers.filter((_, k) => k !== i) }); if (isSel('layer', i)) setSelected(null) }} className="ann-btn !px-1.5 !py-0.5 ml-auto">×</button></div>
          <div className="flex flex-wrap items-center gap-2 font-ws-mono text-[0.65rem] text-ws-text-tertiary" onClick={(e) => e.stopPropagation()}>
            <label>x <input className={`${inp} w-14`} type="number" step="0.01" value={l.x} onChange={(e) => void upd(i, { x: Number(e.target.value) })} /></label>
            <label>y <input className={`${inp} w-14`} type="number" step="0.01" value={l.y} onChange={(e) => void upd(i, { y: Number(e.target.value) })} /></label>
            <label>w <input className={`${inp} w-14`} type="number" step="0.01" value={l.width} onChange={(e) => void upd(i, { width: Number(e.target.value) })} /></label>
            <label>start <input className={`${inp} w-14`} type="number" step="0.1" value={l.start} onChange={(e) => void upd(i, { start: Number(e.target.value) })} /></label>
            <label>end <input className={`${inp} w-14`} type="number" step="0.1" value={l.end ?? ''} placeholder="∞" onChange={(e) => void upd(i, { end: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="flex items-center gap-1">in <Select testid={`layer-in-${i}`} value={l.in ?? 'spring'} onChange={(v) => void upd(i, { in: v })} options={['spring', 'fade', 'none'].map((v) => ({ value: v, label: v }))} /></label>
          </div>
        </div>
      ))}
      {props.texts.map((t, i) => (
        <div key={t.id} data-testid={`text-${i}`} data-selected={isSel('text', i) ? 'true' : 'false'} onClick={() => setSelected(isSel('text', i) ? null : { kind: 'text', i })}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border cursor-pointer font-ws-mono text-xs ${isSel('text', i) ? 'border-ws-terracotta bg-[rgba(224,155,88,.12)]' : 'border-transparent hover:border-ws-border-strong'}`}>
          <span className="text-ws-text-primary">T · {t.id}</span><span className="truncate text-ws-text-secondary">"{t.text}"</span>
          <input className={`${inp} w-36 ml-auto`} value={t.text} onClick={(e) => e.stopPropagation()} onChange={(e) => void save({ ...props, texts: props.texts.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
        </div>
      ))}
    </div>
  )
  const selBox = (() => {
    if (!selected) return null
    if (selected.kind === 'layer') {
      const l = props.layers[selected.i]; if (!l) return null
      const m = projectDoc.media.find((x) => x.file.split('/').pop() === l.media); const aspect = m?.width && m?.height ? m.width / m.height : 16 / 9
      const h = (l.width * props.width) / aspect / props.height
      return { box: { x: l.x, y: l.y, w: l.width, h }, aspect: aspect * (props.height / props.width), resizable: true, label: l.id, commit: (b: Box) => void upd(selected.i, { x: b.x, y: b.y, width: b.w }) }
    }
    const t = props.texts[selected.i]; if (!t) return null
    const w = Math.min(0.9, (t.text.length * t.size * 0.55) / props.width), h = (t.size * 1.3) / props.height
    return { box: { x: t.x, y: t.y, w, h }, aspect: 1, resizable: false, label: t.id, commit: (b: Box) => void save({ ...props, texts: props.texts.map((x, k) => (k === selected.i ? { ...x, x: b.x, y: b.y } : x)) }) }
  })()
  return (
    <div data-testid="animation-mode">
      {layersSlot && createPortal(layersList, layersSlot)}
      <div className="flex flex-wrap items-center gap-2 mb-3 font-ws-mono text-xs text-ws-text-tertiary">
        <span className="text-ws-text-primary text-sm">animation <span className="text-ws-terracotta-text">{anim}</span></span>
        <span>{props.width}×{props.height} · {props.fps} fps · {props.duration} s · composition {props.id}</span>
        <span className="ml-auto flex items-center gap-2">
          frame <input data-testid="anim-frame" type="range" min={0} max={frames - 1} value={frame} onChange={(e) => setFrame(Number(e.target.value))} className="w-40" /> <span data-testid="anim-frame-n">{frame}</span>
          <button data-testid="anim-still" disabled={!!busy} onClick={() => void still()} className="ann-btn disabled:opacity-40 w-32 text-center">{busy === 'still' ? 'rendering…' : 'refresh preview'}</button>
          <button data-testid="anim-render" disabled={!!busy} onClick={() => void render()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40 w-28 text-center">{busy === 'render' ? 'rendering…' : 'render draft'}</button>
          {studio ? <button data-testid="anim-studio-stop" onClick={() => void stopStudio()} className="ann-btn">stop Studio</button> : <button data-testid="anim-studio" disabled={!!busy} onClick={() => void openStudio()} className="ann-btn disabled:opacity-40 w-32 text-center">{busy === 'studio' ? 'starting…' : 'open in Studio'}</button>}
        </span>
      </div>
      {err && <div data-testid="anim-error" className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      <div ref={canvasRef} data-testid="anim-canvas" data-canvas-root onDragOver={(e) => { if (e.dataTransfer.types.some((t) => t === 'application/x-media-id' || t === 'application/x-library-id')) { e.preventDefault(); setOver(true) } }} onDragLeave={() => setOver(false)} onDrop={(e) => void onDrop(e)}
        className={`relative rounded-xl overflow-hidden border ${over ? 'border-ws-terracotta' : 'border-ws-border-subtle'} bg-black`} style={{ aspectRatio: `${props.width} / ${props.height}` }}>
        {shown !== null && <img data-testid="anim-still-img" src={`${paths.work(anim)}/still_${shown}.png?v=${stillKey}`} alt="" className="block w-full h-full object-contain" style={{ opacity: busy === 'still' ? 0.5 : 1 }} />}
        {shown === null && <div className="absolute inset-0 flex items-center justify-center font-ws-mono text-xs text-ws-text-tertiary">{busy === 'still' ? 'rendering the preview…' : 'no preview yet'}</div>}
        {selBox && <SelectionBox box={selBox.box} aspect={selBox.aspect} label={selBox.label} resizable={selBox.resizable} onCommit={selBox.commit} />}
        <div className="absolute bottom-1 right-2 font-ws-mono text-[0.6rem] text-ws-text-tertiary bg-black/50 px-1 rounded">preview = `remotion still` at frame {shown ?? frame} · drop a Media Bin item to add a layer</div>
      </div>
      {!layersSlot && layersList}
      {out && <pre data-testid="anim-out" className="mt-2 text-[0.66rem] font-ws-mono text-ws-text-secondary bg-black/30 rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap">{out}</pre>}
      {draft && <section className="mt-4"><h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">draft render</h2><video data-testid="anim-draft" src={draft} controls className="w-full max-w-[960px] rounded-xl border border-ws-border-subtle" /></section>}
      {studio && <section className="mt-4"><h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">Remotion Studio <span className="text-ws-text-tertiary normal-case tracking-normal">· {studio} · the keyframe-adjacent step; props edited here land in props.json</span></h2><iframe data-testid="anim-studio-frame" src={studio} title="Remotion Studio" className="w-full rounded-xl border border-ws-border-subtle" style={{ height: 720 }} /></section>}
    </div>
  )
}
