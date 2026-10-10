import { useEffect, useMemo, useRef, useState } from 'react'
import { AnnotatorPanel, createSvgSpace, useShapePicker, type CanvasShape } from './lib/canvas-annotator'
import { ImageCanvas, useShapeOverlay } from './AnnotatedCanvas'
import { acceptRefined, buildAnchorsDoc, hitVertex, moveVertex, overlayFor, refinedOverlay, runEngine, type AnchorsDoc, type Manifest, type RefinedDoc, type RefinedShape } from './anchors'
import { BeatsTab, MarkerStrip } from './BeatsMode'
import { emptyBeats, markBeat, type Beats, type Meta } from './beats'
import { bridgePaths } from './project'

/** What the unsaved dot compares: shapes without UI-only fields, beats, meta, notes, decisions. */
export function dirtyKey(shapes: CanvasShape[], beats: Beats, meta: Meta, notes: string[], decisions: unknown[]): string {
  return JSON.stringify([shapes.map(({ wip: _w, color: _c, ...s }) => s), beats, meta, notes, decisions])
}

/**
 * Video-frame mode (PLAN.md Phase 2 + tranche 1): a frame strip over the engine's sampled
 * frames, shapes tagged with the current frame, ghosts of the nearest keyframe, a loupe,
 * Save → work/<shot>/anchors.json, an engine console (sample frames, track, crops, render)
 * through the dev bridge, and a results view.
 */
export function FramesMode({ shot, drawing, onShotChange, project, saveTick, onDirty, onView }: {
  shot: string; drawing: boolean; onShotChange: (s: string) => void; project?: string
  /** A2: bumped by the frame's Save (File › Save, ⌘S); the shot's anchors.json is written. */
  saveTick?: number
  /** A2: reports whether the shot's document differs from what was last loaded or saved. */
  onDirty?: (dirty: boolean) => void
  onView?: (view: string) => void
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [savedMsg, setSavedMsg] = useState('')
  const [view, setView] = useState<'frames' | 'results' | 'beats'>((new URLSearchParams(window.location.search).get('view') as 'frames' | 'results' | 'beats') || 'frames')
  const [beats, setBeats] = useState<Beats>(emptyBeats()); const [meta, setMeta] = useState<Meta>({})
  const [notes, setNotes] = useState<string[]>([]); const [decisions, setDecisions] = useState<{ date: string; decision: string; by: string }[]>([])
  const [loupe, setLoupe] = useState(true)
  const [resultsKey, setResultsKey] = useState(0)
  const [refined, setRefined] = useState<RefinedShape[]>([])
  const [showRefined, setShowRefined] = useState(true)
  const drag = useRef<{ index: number; point: number } | null>(null)
  const dragged = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const paths = bridgePaths(project); const base = paths.work(shot)

  const loadRefined = async () => {
    const r = await fetch(`${base}/refined.json?v=${Date.now()}`)
    setRefined(r.ok ? ((await r.json()) as RefinedDoc).shapes : [])
  }
  const loadManifest = async () => {
    const r = await fetch(`${base}/keyframes_sample/manifest.json`)
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: run \`vidfx keyframes shots/${shot}.yaml\` first`)
    const m: Manifest = await r.json(); setManifest(m); return m
  }
  // load the manifest (and an existing anchors.json, to resume) when the shot changes
  useEffect(() => {
    if (!shot) return
    setManifest(null); setError(''); setIdx(0)
    loadManifest().then(async () => {
      const a = await fetch(`${base}/anchors.json`)
      if (a.ok) {
        const doc = (await a.json()) as AnchorsDoc & { beats?: Beats; meta?: Meta; notes?: string[]; decisions?: { date: string; decision: string; by: string }[] }
        picker.loadSaved(doc.shapes); setBeats({ ...emptyBeats(), ...(doc.beats ?? {}) }); setMeta(doc.meta ?? {}); setNotes(doc.notes ?? []); setDecisions(doc.decisions ?? [])
        setSavedKey(dirtyKey(doc.shapes, doc.beats ?? emptyBeats(), doc.meta ?? {}, doc.notes ?? [], doc.decisions ?? []))
      } else {
        picker.loadSaved([]); setBeats(emptyBeats()); setMeta({}); setNotes([]); setDecisions([])
        setSavedKey(dirtyKey([], emptyBeats(), {}, [], []))
      }
      await loadRefined()
    }).catch((e) => setError(String(e.message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot])

  const cur = manifest?.frames[idx]
  const space = useMemo(() => createSvgSpace(() => svgRef.current), [])
  const picker = useShapePicker({ space, enabled: drawing && view === 'frames', frame: cur?.frame })

  const overlay = useMemo(() => {
    if (!cur) return [] as CanvasShape[]
    const { here, ghosts } = overlayFor(picker.saved.filter((s) => !picker.hidden.has(s.id)), cur.frame)
    const wip = picker.current ? [{ ...picker.current, color: '#F0B47A', wip: true }] : []
    const ref = showRefined ? refinedOverlay(refined, cur.frame) : []
    return [...ghosts, ...ref, ...here, ...wip]
  }, [picker.saved, picker.current, cur, refined, showRefined])
  useShapeOverlay(space, overlay)

  // keyboard: [ and ] step frames, z toggles the loupe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!manifest || (e.target as HTMLElement)?.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return
      if (e.key === ']') setIdx((i) => Math.min(manifest.frames.length - 1, i + 1))
      if (e.key === '[') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'z') setLoupe((l) => !l)
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [manifest])

  const extras = () => ({ beats, meta: { ...meta, updated: new Date().toISOString().slice(0, 10) }, notes, decisions })
  const fullDoc = () => (manifest ? { ...buildAnchorsDoc(manifest, picker.saved), ...extras() } : null)
  const save = async () => {
    const doc = fullDoc(); if (!doc) return false
    const r = await fetch(`${base}/anchors.json`, { method: 'PUT', body: JSON.stringify(doc, null, 2) })
    setSavedMsg(r.ok ? `saved ${doc.shapes.length} shapes, ${beats.rows.length} beats → work/${shot}/anchors.json` : `save failed: ${r.status}`)
    window.setTimeout(() => setSavedMsg(''), 4000)
    if (r.ok) setSavedKey(dirtyKey(picker.saved, beats, meta, notes, decisions))
    return r.ok
  }
  // A2: unsaved dot = the document differs from what was loaded or last saved; File › Save bumps saveTick
  const [savedKey, setSavedKey] = useState('')
  const curKey = dirtyKey(picker.saved, beats, meta, notes, decisions)
  useEffect(() => { onDirty?.(!!manifest && curKey !== savedKey) }, [curKey, savedKey, manifest, onDirty])
  const lastTick = useRef(saveTick ?? 0)
  useEffect(() => { if ((saveTick ?? 0) > lastTick.current) { lastTick.current = saveTick ?? 0; void save() } }, [saveTick])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onView?.(view) }, [view, onView])
  const copyJson = () => { const d = fullDoc(); if (d) navigator.clipboard?.writeText(JSON.stringify(d, null, 2)) }
  const trackerIds = [...new Set(picker.saved.map((sh) => sh.id))]
  // T2: the mark-beat target; a click on a tracker's name in the panel selects it. Falls back to the first tracker.
  const [pickedTarget, setPickedTarget] = useState('')
  const markTarget = trackerIds.includes(pickedTarget) ? pickedTarget : (trackerIds[0] ?? '')
  const jumpToFrame = (frame: number) => { const i = manifest?.frames.findIndex((f) => f.frame === frame) ?? -1; if (i >= 0) setIdx(i) }
  const laneNames = beats.lanes.length ? beats.lanes : [...new Set((manifest?.effects ?? []).map((e) => e.kind).filter((k): k is string => !!k))]
  const duration = manifest ? manifest.frames_total / manifest.fps : 0

  // ── tranche 2.3: drag a vertex of a saved shape on this frame ──
  const onMouseDown = (e: React.MouseEvent) => {
    if (!cur || !drawing || picker.current) return
    const p = space.screenToCanvas(e.clientX, e.clientY); if (!p) return
    const hit = hitVertex(picker.saved, cur.frame, p.x, p.y, space.pxToCanvas(10))
    if (!hit) return
    drag.current = hit; dragged.current = false; picker.pushHistory(); e.preventDefault()
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return
    const p = space.screenToCanvas(e.clientX, e.clientY); if (!p) return
    dragged.current = true
    picker.updateSaved(drag.current.index, moveVertex(picker.saved[drag.current.index], drag.current.point, p.x, p.y), false)
  }
  const onMouseUp = () => { drag.current = null }
  const onClick = (e: React.MouseEvent) => { if (dragged.current) { dragged.current = false; return } picker.onCanvasClick(e) }

  // ── tranche 2.2 / 2.4: accept the engine's refinement; save and re-track ──
  const hereRefined = cur ? refined.filter((r) => r.frame === cur.frame) : []
  const accept = (frame?: number) => picker.loadSaved(acceptRefined(picker.saved, refined, frame))
  const [retracking, setRetracking] = useState(false)
  const retrack = async () => {
    if (!manifest || retracking) return
    setRetracking(true)
    await fetch(`${base}/anchors.json`, { method: 'PUT', body: JSON.stringify(fullDoc(), null, 2) })
    const code = await runEngine('track', shot, [], () => {}, project)
    await loadRefined(); setResultsKey((k) => k + 1); setRetracking(false)
    setSavedMsg(code === 0 ? 'saved and re-tracked; refined overlay updated' : `re-track failed (exit ${code})`)
    window.setTimeout(() => setSavedMsg(''), 4000)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="flex items-center gap-2 text-sm text-ws-text-secondary">shot
          <input data-testid="shot-name" defaultValue={shot} onKeyDown={(e) => { if (e.key === 'Enter') onShotChange((e.target as HTMLInputElement).value.trim()) }}
            placeholder="frustration-walk" className="font-ws-mono text-sm bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 w-56 outline-none focus:border-ws-terracotta" />
        </label>
        <button data-testid="view-frames" className={`ann-chip ${view === 'frames' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setView('frames')}>frames</button>
        <button data-testid="view-results" className={`ann-chip ${view === 'results' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setView('results')}>results</button>
        <button data-testid="view-beats" className={`ann-chip ${view === 'beats' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setView('beats')}>beats{beats.rows.length ? ` (${beats.rows.length})` : ''}</button>
        <button data-testid="loupe-toggle" className={`ann-chip ${loupe ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setLoupe((l) => !l)} title="z">loupe</button>
        {manifest && cur && <span data-testid="frame-info" className="ml-auto font-ws-mono text-xs text-ws-text-tertiary">frame {cur.frame} · t={cur.t.toFixed(2)}s · {cur.width}×{cur.height} · {picker.saved.filter((s) => s.frame === cur.frame).length} shape(s) here · {picker.saved.length} total · [ ] to step</span>}
      </div>
      {error && <div data-testid="frames-error" className="text-sm text-ws-terracotta-text mb-3">{error}</div>}

      {view === 'frames' && manifest && cur && (
        <div style={drawing ? { marginRight: 360 } : undefined}>{/* the floating panel docks in this gutter; it must never cover the canvas */}
          <div data-testid="canvas" onClick={onClick} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} className={`relative rounded-xl overflow-hidden border border-ws-border-subtle ${drawing && picker.active ? 'cursor-crosshair' : ''}`}>
            <ImageCanvas src={`${base}/keyframes_sample/${cur.path}`} width={cur.width} height={cur.height} svgRef={svgRef} />
            {loupe && <Loupe src={`${base}/keyframes_sample/${cur.path}`} svgRef={svgRef} shapes={overlay} />}
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
          <MarkerStrip beats={beats} setBeats={setBeats} duration={duration} sampleTimes={manifest.frames.map((f) => f.t)} currentT={cur.t} lanes={laneNames} trackerIds={trackerIds}
            target={markTarget} setTarget={setPickedTarget}
            onMark={(lane, target) => setBeats(markBeat({ ...beats, lanes: beats.lanes.length ? beats.lanes : laneNames }, cur.t, lane, target).beats)} />
          {savedMsg && <div data-testid="save-status" className="mt-2 text-xs font-ws-mono text-ws-sage">{savedMsg}</div>}
          {refined.length > 0 && (
            <div data-testid="refine-bar" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(250,247,240,.04)' }}>
              <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">refined</span>
              <button data-testid="refined-toggle" onClick={() => setShowRefined((v) => !v)} className={`ann-chip ${showRefined ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`}>{showRefined ? 'shown' : 'hidden'}</button>
              {hereRefined.map((r) => (
                <span key={r.id} data-testid={`refine-row-${r.id}`} className="font-ws-mono text-xs text-ws-text-secondary flex items-center gap-2">
                  {r.id} @{r.frame}: moved {r.moved_px?.map((m) => m.toFixed(0)).join('/')} px
                  <button data-testid={`refine-accept-${r.id}`} onClick={() => accept(cur!.frame)} className="ann-btn">accept</button>
                </span>
              ))}
              {hereRefined.length === 0 && <span className="text-xs text-ws-text-tertiary">no refined shape on this frame</span>}
              <button data-testid="refine-accept-all" onClick={() => accept()} className="ann-btn ml-auto">accept all frames</button>
              <button data-testid="retrack" disabled={retracking} onClick={retrack} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{retracking ? 'tracking…' : 'save & re-track'}</button>
            </div>
          )}
          <EngineConsole shot={shot} project={project} manifest={manifest} onManifest={loadManifest} onResults={() => { setResultsKey((k) => k + 1); loadRefined() }} />
          {drawing && <AnnotatorPanel picker={picker} title={`Annotate · ${shot}`} onJumpFrame={jumpToFrame} onSelectTracker={setPickedTarget} selectedTracker={markTarget} extraActions={<>
            <button data-testid="copy-json" onClick={copyJson} className="ann-btn">copy json</button>
            <button data-testid="save-anchors" onClick={save} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]">save anchors.json</button>
          </>} />}
        </div>
      )}

      {view === 'beats' && manifest && (
        <BeatsTab shot={shot} project={project} beats={{ ...beats, lanes: beats.lanes.length ? beats.lanes : laneNames }} setBeats={setBeats} meta={meta} setMeta={setMeta} notes={notes} setNotes={setNotes}
          decisions={decisions} setDecisions={setDecisions} trackerIds={trackerIds} duration={duration} onSaveAnchors={save} />
      )}
      {view === 'results' && <>
        <EngineConsole shot={shot} manifest={manifest} onManifest={loadManifest} onResults={() => setResultsKey((k) => k + 1)} />
        <Results key={resultsKey} shot={shot} project={project} />
      </>}
    </div>
  )
}

/** 3x magnifier following the pointer over the canvas (tranche 1.4); shapes are drawn into it too. */
function Loupe({ src, svgRef, shapes }: { src: string; svgRef: React.RefObject<SVGSVGElement>; shapes: CanvasShape[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const img = useMemo(() => { const i = new Image(); i.src = src; return i }, [src])
  const [pos, setPos] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null)
  const SIZE = 180, ZOOM = 3
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const onMove = (e: MouseEvent) => {
      const ctm = svg.getScreenCTM(); if (!ctm) return
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      const box = svg.getBoundingClientRect()
      setPos({ x: e.clientX - box.left, y: e.clientY - box.top, cx: p.x, cy: p.y })
    }
    const onLeave = () => setPos(null)
    svg.addEventListener('mousemove', onMove); svg.addEventListener('mouseleave', onLeave)
    return () => { svg.removeEventListener('mousemove', onMove); svg.removeEventListener('mouseleave', onLeave) }
  }, [svgRef])
  useEffect(() => {
    const c = ref.current; if (!c || !pos || !img.complete) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const half = SIZE / ZOOM / 2
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(img, pos.cx - half, pos.cy - half, 2 * half, 2 * half, 0, 0, SIZE, SIZE)
    // shapes near the pointer, in loupe space
    const tx = (x: number) => (x - (pos.cx - half)) * ZOOM, ty = (y: number) => (y - (pos.cy - half)) * ZOOM
    for (const s of shapes) {
      ctx.strokeStyle = s.color ?? '#FF3B81'; ctx.lineWidth = 1.5
      if (s.kind === 'circle') { ctx.beginPath(); ctx.arc(tx(s.x), ty(s.y), s.r * ZOOM, 0, Math.PI * 2); ctx.stroke() }
      else { ctx.beginPath(); s.points.forEach((p, i) => (i ? ctx.lineTo(tx(p.x), ty(p.y)) : ctx.moveTo(tx(p.x), ty(p.y)))); if (s.kind === 'polygon' && !s.open) ctx.closePath(); ctx.stroke()
        for (const p of s.points) { ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 3, 0, Math.PI * 2); ctx.stroke() } }
    }
    ctx.strokeStyle = '#F0B47A'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke()
  }, [pos, img, shapes])
  if (!pos) return null
  // keep the loupe out from under the pointer: opposite quadrant
  const left = pos.x > 300 ? 12 : undefined, right = pos.x > 300 ? undefined : 12, top = pos.y > 260 ? 12 : undefined, bottom = pos.y > 260 ? undefined : 12
  return (
    <div data-testid="loupe" className="pointer-events-none absolute rounded-lg overflow-hidden border border-ws-terracotta shadow-2xl" style={{ left, right, top, bottom, width: SIZE, height: SIZE }}>
      <canvas ref={ref} width={SIZE} height={SIZE} className="block" />
      <div className="absolute bottom-0 left-0 right-0 font-ws-mono text-[0.6rem] text-ws-text-primary bg-black/60 px-1">{Math.round(pos.cx)}, {Math.round(pos.cy)} · {ZOOM}x</div>
    </div>
  )
}

/** Run engine commands from the page through the dev bridge (tranche 1.5, 1.6). */
function EngineConsole({ shot, project, manifest, onManifest, onResults }: { shot: string; project?: string; manifest: Manifest | null; onManifest: () => Promise<Manifest>; onResults: () => void }) {
  const [out, setOut] = useState(''); const [busy, setBusy] = useState(''); const [frameReq, setFrameReq] = useState('')
  const run = async (cmd: string, args: string[], after?: () => void | Promise<unknown>) => {
    if (busy) return
    setBusy(cmd); setOut('')
    const code = await runEngine(cmd, shot, args, (s) => setOut((o) => o + s), project)
    setBusy('')
    if (code === 0 && after) await after()
  }
  const sampleFrame = () => {
    const n = Number(frameReq); if (!Number.isInteger(n) || n < 0) return
    const have = manifest ? manifest.frames.map((f) => f.frame) : []
    run('keyframes', ['--frames', [...new Set([...have, n])].sort((a, b) => a - b).join(',')], onManifest)
  }
  const b = (cmd: string, label: string, args: string[], after?: () => void | Promise<unknown>) => (
    <button data-testid={`engine-${cmd}`} disabled={!!busy} onClick={() => run(cmd, args, after)} className="ann-btn disabled:opacity-40">{busy === cmd ? `${label}…` : label}</button>
  )
  return (
    <div data-testid="engine-console" className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">engine</span>
        <input data-testid="sample-frame-input" value={frameReq} onChange={(e) => setFrameReq(e.target.value)} placeholder="frame #" className="font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 w-20 outline-none focus:border-ws-terracotta" />
        <button data-testid="sample-frame-run" disabled={!!busy} onClick={sampleFrame} className="ann-btn disabled:opacity-40">sample frame</button>
        {b('track', 'track motion', [], onResults)}
        {b('crops', 'crops', ['--frames', '248,434'], onResults)}
        {b('render', 'render draft', ['--res', '1080', '--stills'], onResults)}
      </div>
      {out && <pre data-testid="engine-out" className="text-[0.66rem] font-ws-mono text-ws-text-secondary bg-black/30 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap">{out}</pre>}
    </div>
  )
}

/** What the engine produced for this shot: refined keyframes, crops, review stills, the draft. */
function Results({ shot, project }: { shot: string; project?: string }) {
  const [dbg, setDbg] = useState<string[]>([]); const [stills, setStills] = useState<string[]>([]); const [crops, setCrops] = useState<string[]>([]); const [draft, setDraft] = useState('')
  const paths = bridgePaths(project); const work = paths.work(shot)
  useEffect(() => {
    const ls = async (p: string) => { const r = await fetch(p); return r.ok ? ((await r.json()) as { name: string }[]).map((e) => e.name).filter((n) => /\.(jpg|png)$/.test(n)) : [] }
    ls(`${work}/keyframes_debug/`).then(setDbg); ls(`${work}/stills/`).then(setStills); ls(`${work}/crops/`).then(setCrops)
    fetch(`${paths.renders}/${shot}_1080p.mp4`, { method: 'HEAD' }).then((r) => setDraft(r.ok ? `${paths.renders}/${shot}_1080p.mp4?v=${Date.now()}` : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, project])
  const Row = ({ title, dir, names, testid }: { title: string; dir: string; names: string[]; testid: string }) => (
    <section className="mb-5">
      <h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">{title} <span className="text-ws-text-tertiary">({names.length})</span></h2>
      <div data-testid={testid} className="flex gap-2 overflow-x-auto pb-2">{names.map((n) => <a key={n} className="shrink-0" href={`${work}/${dir}/${n}`} target="_blank" rel="noreferrer"><img src={`${work}/${dir}/${n}`} alt={n} title={n} className="block h-44 w-auto max-w-none rounded-lg border border-ws-border-subtle" /></a>)}</div>
    </section>
  )
  return (
    <div data-testid="results" className="mt-4">
      <Row title="refined keyframes (red given · green refined)" dir="keyframes_debug" names={dbg} testid="results-debug" />
      <Row title="corner crops at 4x (magenta this track · green the other)" dir="crops" names={crops} testid="results-crops" />
      <Row title="review stills" dir="stills" names={stills} testid="results-stills" />
      <section>
        <h2 className="font-ws-mono text-xs uppercase tracking-widest text-ws-sage mb-2">draft render</h2>
        {draft ? <video data-testid="results-draft" src={draft} controls className="w-full max-w-[960px] rounded-lg border border-ws-border-subtle" /> : <div className="text-sm text-ws-text-tertiary">no 1080p draft yet (render draft above)</div>}
      </section>
    </div>
  )
}
