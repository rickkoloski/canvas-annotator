import { useEffect, useRef, useState } from 'react'
import { bridgePaths, type ProjectDoc } from './project'
import { addFromLibrary } from './media'

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

export function AnimationMode({ projectDoc, anim, onProject }: { projectDoc: ProjectDoc; anim: string; onProject: (p: ProjectDoc) => void }) {
  const paths = bridgePaths(projectDoc.name); const adir = `${paths.root}/animations/${encodeURIComponent(anim)}`
  const [props, setProps] = useState<AnimProps | null>(null); const [err, setErr] = useState('')
  const [frame, setFrame] = useState(12); const [stillKey, setStillKey] = useState(0); const [shown, setShown] = useState<number | null>(null)   // shown = the frame whose still is on screen
  const [busy, setBusy] = useState(''); const [out, setOut] = useState('')
  const [draft, setDraft] = useState(''); const [studio, setStudio] = useState(''); const [over, setOver] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const r = await fetch(`${adir}/props.json?v=${Date.now()}`); if (!r.ok) { setErr(`cannot read props.json (${r.status})`); return }
    setProps(await r.json()); setErr('')
    fetch(`${paths.renders}/${anim}_draft.mp4`, { method: 'HEAD' }).then((h) => setDraft(h.ok ? `${paths.renders}/${anim}_draft.mp4?v=${Date.now()}` : ''))
  }
  useEffect(() => { void load() }, [anim])   // eslint-disable-line react-hooks/exhaustive-deps
  const still = async (f = frame) => {
    if (busy) return; setBusy('still'); setOut('')
    const code = await runRemotion({ project: projectDoc.name, anim, op: 'still', frame: f }, (s) => setOut((o) => o + s))
    setBusy(''); if (code === 0) { setShown(f); setStillKey((k) => k + 1) }
  }
  useEffect(() => { if (props) void still(frame) }, [props?.layers.length, props?.texts.length, frame])   // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next: AnimProps) => {
    const r = await fetch(`${adir}/props.json`, { method: 'PUT', body: JSON.stringify(next, null, 2) })
    if (!r.ok) { setErr(`save failed ${r.status}`); return } setProps(next)
  }
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
  return (
    <div data-testid="animation-mode">
      <div className="flex flex-wrap items-center gap-2 mb-3 font-ws-mono text-xs text-ws-text-tertiary">
        <span className="text-ws-text-primary text-sm">animation <span className="text-ws-terracotta-text">{anim}</span></span>
        <span>{props.width}×{props.height} · {props.fps} fps · {props.duration} s · composition {props.id}</span>
        <span className="ml-auto flex items-center gap-2">
          frame <input data-testid="anim-frame" type="range" min={0} max={frames - 1} value={frame} onChange={(e) => setFrame(Number(e.target.value))} className="w-40" /> <span data-testid="anim-frame-n">{frame}</span>
          <button data-testid="anim-still" disabled={!!busy} onClick={() => void still()} className="ann-btn disabled:opacity-40">{busy === 'still' ? 'rendering…' : 'refresh preview'}</button>
          <button data-testid="anim-render" disabled={!!busy} onClick={() => void render()} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{busy === 'render' ? 'rendering…' : 'render draft'}</button>
          {studio ? <button data-testid="anim-studio-stop" onClick={() => void stopStudio()} className="ann-btn">stop Studio</button> : <button data-testid="anim-studio" disabled={!!busy} onClick={() => void openStudio()} className="ann-btn disabled:opacity-40">{busy === 'studio' ? 'starting…' : 'open in Studio'}</button>}
        </span>
      </div>
      {err && <div data-testid="anim-error" className="text-xs text-ws-terracotta-text mb-2">{err}</div>}
      <div ref={canvasRef} data-testid="anim-canvas" onDragOver={(e) => { if (e.dataTransfer.types.some((t) => t === 'application/x-media-id' || t === 'application/x-library-id')) { e.preventDefault(); setOver(true) } }} onDragLeave={() => setOver(false)} onDrop={(e) => void onDrop(e)}
        className={`relative rounded-xl overflow-hidden border ${over ? 'border-ws-terracotta' : 'border-ws-border-subtle'} bg-black`} style={{ aspectRatio: `${props.width} / ${props.height}` }}>
        {shown !== null && <img data-testid="anim-still-img" src={`${paths.work(anim)}/still_${shown}.png?v=${stillKey}`} alt="" className="block w-full h-full object-contain" style={{ opacity: busy === 'still' ? 0.5 : 1 }} />}
        {shown === null && <div className="absolute inset-0 flex items-center justify-center font-ws-mono text-xs text-ws-text-tertiary">{busy === 'still' ? 'rendering the preview…' : 'no preview yet'}</div>}
        <div className="absolute bottom-1 right-2 font-ws-mono text-[0.6rem] text-ws-text-tertiary bg-black/50 px-1 rounded">preview = `remotion still` at frame {shown ?? frame} · drop a Media Bin item to add a layer</div>
      </div>
      <div data-testid="anim-layers" className="mt-2 flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: 'rgba(250,247,240,.04)' }}>
        <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">layers <span className="text-ws-text-tertiary normal-case tracking-normal">· props.json · Remotion Studio edits the same file</span></span>
        {props.layers.length === 0 && <span className="text-xs text-ws-text-tertiary">none yet</span>}
        {props.layers.map((l, i) => (
          <div key={l.id} data-testid={`layer-${i}`} className="flex flex-wrap items-center gap-2 font-ws-mono text-xs text-ws-text-secondary">
            <span className="text-ws-text-primary">{i} · {l.id}</span><span>{l.media}</span>
            <label>x <input className={`${inp} w-14`} type="number" step="0.01" value={l.x} onChange={(e) => void upd(i, { x: Number(e.target.value) })} /></label>
            <label>y <input className={`${inp} w-14`} type="number" step="0.01" value={l.y} onChange={(e) => void upd(i, { y: Number(e.target.value) })} /></label>
            <label>width <input className={`${inp} w-14`} type="number" step="0.01" value={l.width} onChange={(e) => void upd(i, { width: Number(e.target.value) })} /></label>
            <label>start <input className={`${inp} w-14`} type="number" step="0.1" value={l.start} onChange={(e) => void upd(i, { start: Number(e.target.value) })} /></label>
            <label>end <input className={`${inp} w-14`} type="number" step="0.1" value={l.end ?? ''} placeholder="∞" onChange={(e) => void upd(i, { end: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>in <select className={inp} value={l.in ?? 'spring'} onChange={(e) => void upd(i, { in: e.target.value })}>{['spring', 'fade', 'none'].map((v) => <option key={v}>{v}</option>)}</select></label>
            <button data-testid={`layer-remove-${i}`} onClick={() => props && void save({ ...props, layers: props.layers.filter((_, k) => k !== i) })} className="ann-btn !px-1.5 !py-0.5 ml-auto">×</button>
          </div>
        ))}
        <span className="text-[0.62rem] text-ws-text-tertiary">texts: {props.texts.map((t) => `"${t.text}"`).join(', ') || 'none'} · edit in props.json or Studio</span>
      </div>
      {out && <pre data-testid="anim-out" className="mt-2 text-[0.66rem] font-ws-mono text-ws-text-secondary bg-black/30 rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap">{out}</pre>}
      {draft && <section className="mt-4"><h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">draft render</h2><video data-testid="anim-draft" src={draft} controls className="w-full max-w-[960px] rounded-xl border border-ws-border-subtle" /></section>}
      {studio && <section className="mt-4"><h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">Remotion Studio <span className="text-ws-text-tertiary normal-case tracking-normal">· {studio} · the keyframe-adjacent step; props edited here land in props.json</span></h2><iframe data-testid="anim-studio-frame" src={studio} title="Remotion Studio" className="w-full rounded-xl border border-ws-border-subtle" style={{ height: 720 }} /></section>}
    </div>
  )
}
