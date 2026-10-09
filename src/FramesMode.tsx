import { useEffect, useMemo, useRef, useState } from 'react'
import { AnnotatorPanel, createSvgSpace, useShapePicker, type CanvasShape } from './lib/canvas-annotator'
import { ImageCanvas, useShapeOverlay } from './AnnotatedCanvas'

/** What `vidfx keyframes` writes next to its sample frames. */
type Manifest = {
  version: number; shot: string; source: string; fps: number; frames_total: number
  canvas: { kind: string; width: number; height: number }
  frames: { frame: number; t: number; path: string; grid: string; width: number; height: number }[]
}
type Anchors = { version: number; canvas: Record<string, unknown>; shapes: CanvasShape[] }

const GHOST = '#8E9678'

/**
 * Video-frame mode (PLAN.md Phase 2): a frame strip over the engine's sampled frames,
 * shapes tagged with the current frame, ghosts of the same id from the nearest other
 * frame, and Save → work/<shot>/anchors.json through the dev-server bridge.
 */
export function FramesMode({ shot, drawing, onShotChange }: { shot: string; drawing: boolean; onShotChange: (s: string) => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [savedMsg, setSavedMsg] = useState('')
  const [view, setView] = useState<'frames' | 'results'>(new URLSearchParams(window.location.search).get('view') === 'results' ? 'results' : 'frames')
  const svgRef = useRef<SVGSVGElement>(null)
  const base = `/work/${shot}`

  // load the manifest (and an existing anchors.json, to resume) when the shot changes
  useEffect(() => {
    if (!shot) return
    setManifest(null); setError(''); setIdx(0)
    fetch(`${base}/keyframes_sample/manifest.json`).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}: run \`vidfx keyframes shots/${shot}.yaml\` first`)
      setManifest(await r.json())
      const a = await fetch(`${base}/anchors.json`)
      if (a.ok) { const doc: Anchors = await a.json(); picker.loadSaved(doc.shapes) }
    }).catch((e) => setError(String(e.message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot])

  const cur = manifest?.frames[idx]
  const space = useMemo(() => createSvgSpace(() => svgRef.current), [])
  const picker = useShapePicker({ space, enabled: drawing && view === 'frames', frame: cur?.frame })

  // overlay: this frame's shapes solid, the in-progress shape, and for every id not yet on
  // this frame a ghost from the nearest other frame (so a corner can be followed)
  const overlay = useMemo(() => {
    if (!cur) return [] as CanvasShape[]
    const here = picker.saved.filter((s) => s.frame === cur.frame)
    const ids = new Set(here.map((s) => s.id))
    const ghosts: CanvasShape[] = []
    for (const id of new Set(picker.saved.filter((s) => s.frame !== undefined && !ids.has(s.id)).map((s) => s.id))) {
      const near = picker.saved.filter((s) => s.id === id && s.frame !== undefined)
        .sort((a, b) => Math.abs((a.frame ?? 0) - cur.frame) - Math.abs((b.frame ?? 0) - cur.frame))[0]
      if (near) ghosts.push({ ...near, color: GHOST, label: `${near.label} @${near.frame}`, ...(near.kind === 'polygon' ? { open: true } : {}) })
    }
    const wip = picker.current ? [{ ...picker.current, color: '#F0B47A', wip: true }] : []
    return [...ghosts, ...here, ...wip]
  }, [picker.saved, picker.current, cur])
  useShapeOverlay(space, overlay)

  // keyboard: [ and ] step frames
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!manifest || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === ']') setIdx((i) => Math.min(manifest.frames.length - 1, i + 1))
      if (e.key === '[') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [manifest])

  const anchorsDoc = (): Anchors | null => manifest ? ({
    version: 1,
    canvas: { kind: 'video', width: manifest.canvas.width, height: manifest.canvas.height, fps: manifest.fps, source: manifest.source, shot: manifest.shot },
    shapes: picker.saved.map(({ wip: _w, color: _c, ...s }) => s),
  }) : null
  const save = async () => {
    const doc = anchorsDoc(); if (!doc) return
    const r = await fetch(`${base}/anchors.json`, { method: 'PUT', body: JSON.stringify(doc, null, 2) })
    setSavedMsg(r.ok ? `saved ${doc.shapes.length} shapes → work/${shot}/anchors.json` : `save failed: ${r.status}`)
    window.setTimeout(() => setSavedMsg(''), 4000)
  }
  const copyJson = () => { const doc = anchorsDoc(); if (doc) navigator.clipboard?.writeText(JSON.stringify(doc, null, 2)) }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="flex items-center gap-2 text-sm text-ws-text-secondary">shot
          <input data-testid="shot-name" defaultValue={shot} onKeyDown={(e) => { if (e.key === 'Enter') onShotChange((e.target as HTMLInputElement).value.trim()) }}
            placeholder="frustration-walk" className="font-ws-mono text-sm bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 w-56 outline-none focus:border-ws-terracotta" />
        </label>
        <button data-testid="view-frames" className={`ann-chip ${view === 'frames' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setView('frames')}>frames</button>
        <button data-testid="view-results" className={`ann-chip ${view === 'results' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setView('results')}>results</button>
        {manifest && cur && <span data-testid="frame-info" className="ml-auto font-ws-mono text-xs text-ws-text-tertiary">frame {cur.frame} · t={cur.t.toFixed(2)}s · {cur.width}×{cur.height} · {picker.saved.filter((s) => s.frame === cur.frame).length} shape(s) here · {picker.saved.length} total · [ ] to step</span>}
      </div>
      {error && <div data-testid="frames-error" className="text-sm text-ws-terracotta-text mb-3">{error}</div>}

      {view === 'frames' && manifest && cur && (
        <div style={drawing ? { marginRight: 360 } : undefined}>{/* the floating panel docks in this gutter; it must never cover the canvas */}
          <div data-testid="canvas" onClick={picker.onCanvasClick} className={`rounded-xl overflow-hidden border border-ws-border-subtle ${drawing && picker.active ? 'cursor-crosshair' : ''}`}>
            <ImageCanvas src={`${base}/keyframes_sample/${cur.path}`} width={cur.width} height={cur.height} svgRef={svgRef} />
          </div>
          <div data-testid="frame-strip" className="flex gap-2 mt-3 overflow-x-auto pb-2">
            {manifest.frames.map((f, i) => {
              const n = picker.saved.filter((s) => s.frame === f.frame).length
              return (
                <button key={f.frame} data-testid={`frame-${f.frame}`} onClick={() => setIdx(i)}
                  className="shrink-0 rounded-lg overflow-hidden border-2" style={{ borderColor: i === idx ? '#C06A45' : n ? '#7FA3A0' : 'rgba(250,247,240,.12)' }}>
                  <img src={`${base}/keyframes_sample/${f.path}`} alt="" className="block w-40 h-auto" />
                  <div className="font-ws-mono text-[0.62rem] px-1 py-0.5 text-ws-text-secondary flex justify-between"><span>f{f.frame}</span><span>{f.t.toFixed(1)}s{n ? ` · ${n}` : ''}</span></div>
                </button>
              )
            })}
          </div>
          {savedMsg && <div data-testid="save-status" className="mt-2 text-xs font-ws-mono text-ws-sage">{savedMsg}</div>}
          {drawing && <AnnotatorPanel picker={picker} title={`Annotate · ${shot}`} extraActions={<>
            <button data-testid="copy-json" onClick={copyJson} className="ann-btn">copy json</button>
            <button data-testid="save-anchors" onClick={save} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]">save anchors.json</button>
          </>} />}
        </div>
      )}

      {view === 'results' && <Results shot={shot} />}
    </div>
  )
}

/** What the engine produced for this shot: refined keyframes, review stills, the draft. */
function Results({ shot }: { shot: string }) {
  const [dbg, setDbg] = useState<string[]>([]); const [stills, setStills] = useState<string[]>([]); const [crops, setCrops] = useState<string[]>([]); const [draft, setDraft] = useState('')
  useEffect(() => {
    const ls = async (p: string) => { const r = await fetch(p); return r.ok ? ((await r.json()) as { name: string }[]).map((e) => e.name).filter((n) => /\.(jpg|png)$/.test(n)) : [] }
    ls(`/work/${shot}/keyframes_debug/`).then(setDbg); ls(`/work/${shot}/stills/`).then(setStills); ls(`/work/${shot}/crops/`).then(setCrops)
    fetch(`/renders/${shot}_1080p.mp4`, { method: 'HEAD' }).then((r) => setDraft(r.ok ? `/renders/${shot}_1080p.mp4` : ''))
  }, [shot])
  const Row = ({ title, dir, names, testid }: { title: string; dir: string; names: string[]; testid: string }) => (
    <section className="mb-5">
      <h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">{title} <span className="text-ws-text-tertiary">({names.length})</span></h2>
      <div data-testid={testid} className="flex gap-2 overflow-x-auto pb-2">{names.map((n) => <a key={n} href={`/work/${shot}/${dir}/${n}`} target="_blank" rel="noreferrer"><img src={`/work/${shot}/${dir}/${n}`} alt={n} title={n} className="block h-44 w-auto rounded-lg border border-ws-border-subtle" /></a>)}</div>
    </section>
  )
  return (
    <div data-testid="results">
      <Row title="refined keyframes (red given · green refined)" dir="keyframes_debug" names={dbg} testid="results-debug" />
      <Row title="corner crops at 4x (magenta this track · green the other)" dir="crops" names={crops} testid="results-crops" />
      <Row title="review stills" dir="stills" names={stills} testid="results-stills" />
      <section>
        <h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">draft render</h2>
        {draft ? <video data-testid="results-draft" src={draft} controls className="w-full max-w-[960px] rounded-lg border border-ws-border-subtle" /> : <div className="text-sm text-ws-text-tertiary">no 1080p draft yet (vidfx render --res 1080 --stills)</div>}
      </section>
    </div>
  )
}
