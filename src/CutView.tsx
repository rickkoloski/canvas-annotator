import { useEffect, useMemo, useRef, useState } from 'react'
import { bridgePaths, type CutClip, type MediaItem, type ProjectDoc } from './project'
import { Select } from './lib/ui/Select'

/**
 * Cut and speed (plan 2026-10-11, Camtasia's timeline on one clip): the output timeline shows the clips contiguous
 * (ripple), each a range of the source with a speed; the playhead runs in output time and the <video> follows it
 * through the source (jumping over removed parts, playbackRate = the clip's speed); Split at the playhead, Delete
 * ripples, speed on the selected clip, undo; Apply writes <stem>-cut.<ext> into the bin through `vidfx cut`
 * (replace) and names the shots to re-track. The cut list is OTIO's: source_in/source_out + speed (time_scalar).
 */
const fmt = (t: number) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}` }
export const clipOut = (c: CutClip) => (c.source_out - c.source_in) / c.speed
export const totalOut = (clips: CutClip[]) => clips.reduce((a, c) => a + clipOut(c), 0)
/** Output time → (clip index, source time). */
export function toSource(clips: CutClip[], t: number): { i: number; s: number } {
  let acc = 0
  for (let i = 0; i < clips.length; i++) { const d = clipOut(clips[i]); if (t < acc + d || i === clips.length - 1) return { i, s: Math.min(clips[i].source_out, clips[i].source_in + Math.max(0, t - acc) * clips[i].speed) }; acc += d }
  return { i: 0, s: clips[0]?.source_in ?? 0 }
}
/** Source time → output time, when the source time lies inside a clip. */
export function toOutput(clips: CutClip[], i: number, s: number): number {
  let acc = 0; for (let k = 0; k < i; k++) acc += clipOut(clips[k])
  return acc + (s - clips[i].source_in) / clips[i].speed
}
/** Split the clip under output time t into two (no-op within 0.05 s of an edge). */
export function splitAt(clips: CutClip[], t: number): CutClip[] {
  const { i, s } = toSource(clips, t); const c = clips[i]
  if (s - c.source_in < 0.05 || c.source_out - s < 0.05) return clips
  const cut = +s.toFixed(3)
  return [...clips.slice(0, i), { ...c, source_out: cut }, { ...c, source_in: cut }, ...clips.slice(i + 1)]
}

export function CutView({ projectDoc, mediaId, onProject }: { projectDoc: ProjectDoc; mediaId: string; onProject: (p: ProjectDoc) => void }) {
  const paths = bridgePaths(projectDoc.name)
  const m = projectDoc.media.find((x) => x.id === mediaId)
  const duration = m?.duration ?? 0
  const [clips, setClips] = useState<CutClip[]>(() => (m?.cut?.clips?.length ? m.cut.clips : [{ source_in: 0, source_out: duration, speed: 1 }]))
  const [history, setHistory] = useState<CutClip[][]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [t, setT] = useState(0)                       // the playhead, output time
  const [playing, setPlaying] = useState(false)
  const [timeField, setTimeField] = useState('')
  const [codec, setCodec] = useState<'h264' | 'prores'>('h264'); const [applyDlg, setApplyDlg] = useState(false); const [busy, setBusy] = useState(false); const [log, setLog] = useState(''); const [result, setResult] = useState<{ out: string; retrack: string[] } | null>(null)
  const video = useRef<HTMLVideoElement>(null); const ruler = useRef<HTMLDivElement>(null)
  const total = useMemo(() => totalOut(clips), [clips])
  const src = m ? (m.linked ? `${paths.root}/media-file/${encodeURIComponent(m.id)}` : `${paths.media}/${encodeURIComponent(m.file.split('/').pop() ?? m.file)}`) : ''

  // persist the cut list on the media item (debounced), so it reopens and Apply finds it
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!m) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void fetch(`${paths.media}/${encodeURIComponent(m.id)}/cut`, { method: 'PUT', body: JSON.stringify({ clips }) }) }, 600)
  }, [clips])   // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: CutClip[]) => { setHistory((h) => [...h.slice(-49), clips]); setClips(next) }
  const undo = () => setHistory((h) => { const prev = h[h.length - 1]; if (prev) { setClips(prev); setSel(null) } return h.slice(0, -1) })

  // the playhead drives the <video> through the source; playback hops between clips at the clip's speed
  const seekOutput = (nt: number) => {
    const clamped = Math.max(0, Math.min(total, nt)); setT(clamped)
    const { i, s } = toSource(clips, clamped); const v = video.current; if (v) { v.currentTime = s; v.playbackRate = Math.min(16, Math.max(0.0625, clips[i]?.speed ?? 1)) }
  }
  const onTime = () => {
    const v = video.current; if (!v || !playing) return
    const { i } = toSource(clips, t); const c = clips[i]; if (!c) return
    if (v.currentTime >= c.source_out - 0.02) {
      if (i + 1 < clips.length) { const n = clips[i + 1]; v.currentTime = n.source_in; v.playbackRate = Math.min(16, Math.max(0.0625, n.speed)); setT(toOutput(clips, i + 1, n.source_in)) }
      else { v.pause(); setPlaying(false); setT(total) }
    } else setT(toOutput(clips, i, v.currentTime))
  }
  const toggle = async () => { const v = video.current; if (!v) return; if (playing) { v.pause(); setPlaying(false) } else { if (t >= total - 0.01) seekOutput(0); const { i } = toSource(clips, t); v.playbackRate = clips[i]?.speed ?? 1; await v.play().catch(() => {}); setPlaying(true) } }
  const split = () => { const next = splitAt(clips, t); if (next !== clips) { commit(next); setSel(null) } }
  const del = () => { if (sel === null || clips.length < 2) return; const next = clips.filter((_, k) => k !== sel); commit(next); setSel(null); seekOutput(Math.min(t, totalOut(next))) }
  const setSpeed = (k: number, speed: number) => { if (!(speed > 0)) return; commit(clips.map((c, i) => (i === k ? { ...c, speed: +speed.toFixed(3) } : c))) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); split() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
      else if (e.key === ' ') { e.preventDefault(); void toggle() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  const rulerSeek = (e: React.MouseEvent) => { const r = ruler.current?.getBoundingClientRect(); if (!r) return; seekOutput(((e.clientX - r.left) / r.width) * total) }
  const apply = async () => {
    if (!m || busy) return; setBusy(true); setLog(''); setResult(null)
    const r = await fetch(`${paths.media}/${encodeURIComponent(m.id)}/cut`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clips, codec }) })
    if (!r.ok || !r.body) { setLog(`bridge error ${r.status}: ${await r.text()}`); setBusy(false); return }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let all = ''
    for (;;) { const { value, done } = await reader.read(); if (done) break; const s = dec.decode(value, { stream: true }); all += s; setLog((o) => o + s) }
    setBusy(false)
    const out = /^out (.+)$/m.exec(all)?.[1]; const retrack = (() => { try { return JSON.parse(/^retrack (.+)$/m.exec(all)?.[1] ?? '[]') } catch { return [] } })()
    if (out && /exit 0/.test(all)) { setResult({ out, retrack }); const p = await fetch(`${paths.projectJson}?v=${Date.now()}`); if (p.ok) onProject(await p.json()) }
  }

  if (!m) return <div className="text-sm text-ws-terracotta-text">no media item "{mediaId}" in this project</div>
  const inp = 'font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-border-subtle rounded px-1 py-0.5 outline-none focus:border-ws-terracotta'
  return (
    <div data-testid="cut-view">
      <div className="flex flex-wrap items-center gap-2 mb-3 font-ws-mono text-xs text-ws-text-tertiary">
        <span className="text-ws-text-primary text-sm">cut <span className="text-ws-terracotta-text">{m.id}</span></span>
        <span>{m.width}×{m.height} · {m.fps} fps · source {fmt(duration)}</span>
        <span data-testid="cut-total" className="text-ws-text-secondary">output {fmt(total)} · {clips.length} clip{clips.length === 1 ? '' : 's'}</span>
        <span className="ml-auto flex items-center gap-2">
          <button data-testid="cut-undo" disabled={!history.length} onClick={undo} className="ann-btn disabled:opacity-40" title="⌘Z">undo</button>
          <button data-testid="cut-apply" disabled={busy} onClick={() => setApplyDlg(true)} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40 w-28 text-center">{busy ? 'applying…' : 'Apply cut…'}</button>
        </span>
      </div>
      <div className="rounded-xl overflow-hidden border border-ws-border-subtle bg-black" style={{ aspectRatio: `${m.width ?? 16} / ${m.height ?? 9}` }}>
        <video ref={video} src={src} className="w-full h-full" onTimeUpdate={onTime} onEnded={() => { setPlaying(false) }} muted={false} preload="auto" />
      </div>
      {/* Camtasia's timeline toolbar: play, time, split, delete; the ruler with the playhead; the clips */}
      <div className="mt-2 flex flex-wrap items-center gap-2 font-ws-mono text-xs">
        <button data-testid="cut-play" onClick={() => void toggle()} className="ann-btn w-10 text-center" title="space">{playing ? '❚❚' : '▶'}</button>
        <span data-testid="cut-time" className="text-ws-text-primary w-24">{fmt(t)}</span>
        <label className="flex items-center gap-1 text-ws-text-tertiary">go to <input data-testid="cut-time-field" value={timeField} onChange={(e) => setTimeField(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number(timeField); if (Number.isFinite(v)) seekOutput(v) } }} placeholder="s" className={`${inp} w-16`} /></label>
        <button data-testid="cut-split" onClick={split} className="ann-btn" title="S · split the clip under the playhead">✂ split</button>
        <button data-testid="cut-delete" disabled={sel === null || clips.length < 2} onClick={del} className="ann-btn disabled:opacity-40" title="Delete · remove the selected clip (ripple)">delete clip</button>
        {sel !== null && clips[sel] && (
          <span data-testid="cut-speed" className="flex items-center gap-1 text-ws-text-tertiary">clip {sel + 1} speed
            <input data-testid="cut-speed-field" type="number" step="0.1" min="0.1" value={clips[sel].speed} onChange={(e) => setSpeed(sel, Number(e.target.value))} className={`${inp} w-16`} />×
            {[1, 1.5, 2, 3, 4, 8].map((s) => <button key={s} data-testid={`cut-speed-${s}`} onClick={() => setSpeed(sel, s)} className={`ann-btn !px-1.5 !py-0.5 ${clips[sel].speed === s ? '!bg-[rgba(224,155,88,.85)] !text-[#1a0e07]' : ''}`}>{s}×</button>)}
          </span>
        )}
        <span className="ml-auto text-ws-text-tertiary">S split · Delete removes · space plays · ⌘Z undo</span>
      </div>
      <div ref={ruler} data-testid="cut-ruler" onMouseDown={(e) => { rulerSeek(e); const mv = (ev: MouseEvent) => { const r = ruler.current?.getBoundingClientRect(); if (r) seekOutput(((ev.clientX - r.left) / r.width) * total) }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up) }}
        className="relative mt-2 h-6 rounded-t-lg border border-ws-border-subtle well cursor-ew-resize select-none">
        {Array.from({ length: Math.max(1, Math.floor(total)) + 1 }, (_, k) => k).filter((k) => total <= 60 || k % 5 === 0).map((k) => <div key={k} className="absolute top-0 h-full border-l border-ws-text-tertiary/40 font-ws-mono text-[0.55rem] text-ws-text-tertiary pl-0.5" style={{ left: `${(k / Math.max(total, 0.001)) * 100}%` }}>{k}s</div>)}
        <div data-testid="cut-playhead" className="absolute top-0 bottom-0 w-px bg-ws-terracotta-text" style={{ left: `${(t / Math.max(total, 0.001)) * 100}%` }}><div className="absolute -top-0 -left-1.5 w-3 h-3 bg-ws-terracotta-text" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} /></div>
      </div>
      <div data-testid="cut-clips" className="relative flex h-20 rounded-b-lg border border-t-0 border-ws-border-subtle overflow-hidden select-none">
        {clips.map((c, i) => (
          <div key={i} data-testid={`cut-clip-${i}`} data-selected={sel === i ? 'true' : 'false'} onClick={() => setSel(sel === i ? null : i)} title={`${fmt(c.source_in)} → ${fmt(c.source_out)} of the source · ${c.speed}×`}
            className={`relative h-full border-r-2 border-black cursor-pointer overflow-hidden ${sel === i ? 'ring-2 ring-inset ring-ws-terracotta' : ''}`} style={{ width: `${(clipOut(c) / Math.max(total, 0.001)) * 100}%`, background: i % 2 ? 'rgba(127,163,160,.55)' : 'rgba(127,163,160,.42)' }}>
            {/* P6 (walk 6, Rick): the clip is a solid block for its whole duration, thumbnails tiled along it (Camtasia's clip bars) */}
            <div className="absolute left-0 top-0 h-14 flex overflow-hidden" style={{ width: '100%' }}>
              {Array.from({ length: Math.max(1, Math.ceil(clipOut(c) / Math.max(total / 9, 0.5))) }, (_, k) => k).map((k) => {
                const frac = k / Math.max(1, Math.ceil(clipOut(c) / Math.max(total / 9, 0.5))); const ts = c.source_in + frac * (c.source_out - c.source_in)
                return <img key={k} src={`${paths.media}/${encodeURIComponent(m.id)}/frame?t=${ts.toFixed(2)}`} alt="" className="h-14 w-auto opacity-90 shrink-0" draggable={false} />
              })}
            </div>
            <div className="absolute left-1 bottom-1 right-1 flex items-center gap-1 font-ws-mono text-[0.6rem]">
              {c.speed !== 1 && <span data-testid={`cut-clip-speed-${i}`} className="px-1 rounded bg-[rgba(224,155,88,.85)] text-[#1a0e07]">⏱ {c.speed}×</span>}
              <span className="text-ws-text-secondary truncate">{fmt(c.source_in)}–{fmt(c.source_out)}</span>
            </div>
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-px bg-ws-terracotta-text pointer-events-none" style={{ left: `${(t / Math.max(total, 0.001)) * 100}%` }} />
      </div>
      {log && <pre data-testid="cut-log" className="mt-2 text-[0.66rem] font-ws-mono text-ws-text-secondary well rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap">{log}</pre>}
      {result && <div data-testid="cut-result" className="mt-2 text-xs font-ws-mono text-ws-sage">cut applied → {result.out} in the Media Bin (replaced if it existed){result.retrack.length ? ` · re-track the shots that use it: ${result.retrack.join(', ')}` : ''}</div>}
      {applyDlg && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) setApplyDlg(false) }}>
          <div data-testid="dialog-apply-cut" className="glass rounded-2xl p-5 w-[460px] shadow-2xl">
            <div className="font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text mb-3">Apply cut</div>
            <p className="text-xs text-ws-text-secondary mb-2">{clips.length} clip{clips.length === 1 ? '' : 's'}, output {fmt(total)} from {fmt(duration)}. Writes <span className="font-ws-mono">media/{m.id.replace(/\.[^.]+$/, '')}-cut.{codec === 'prores' ? 'mov' : 'mp4'}</span> into the bin, replacing an earlier cut; shots using it are listed for a re-track.</p>
            <div className="flex items-center gap-2 text-xs text-ws-text-secondary mb-3">codec <Select testid="cut-codec" value={codec} onChange={(v) => setCodec(v as 'h264' | 'prores')} options={[{ value: 'h264', label: 'H.264 · CRF 16 (small, near-transparent)' }, { value: 'prores', label: 'ProRes 422 (master, large)' }]} /></div>
            <div className="flex gap-2 justify-end"><button className="ann-btn" onClick={() => setApplyDlg(false)}>Cancel</button>
              <button data-testid="cut-apply-go" onClick={() => { setApplyDlg(false); void apply() }} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]">Apply</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
