import { useState } from 'react'
import { markBeat, swimlanes, type Beats, type BeatRow, type Meta } from './beats'
import { runEngine } from './anchors'
import { bridgePaths } from './project'
import { Select } from './lib/ui/Select'

/** Beats tab (tranche 4): lanes, the marker table with swimlanes, held spans, meta/notes/decisions,
 * and the Animation Script export (written by the engine's `vidfx script` through the bridge). */
export function BeatsTab({ shot, project, beats, setBeats, meta, setMeta, notes, setNotes, decisions, setDecisions, trackerIds, duration, onSaveAnchors }: {
  project?: string
  shot: string; beats: Beats; setBeats: (b: Beats) => void
  meta: Meta; setMeta: (m: Meta) => void; notes: string[]; setNotes: (n: string[]) => void
  decisions: { date: string; decision: string; by: string }[]; setDecisions: (d: { date: string; decision: string; by: string }[]) => void
  trackerIds: string[]; duration: number; onSaveAnchors: () => Promise<boolean>
}) {
  const { lanes, rows, cells } = swimlanes(beats)
  const [newLane, setNewLane] = useState('')
  const [script, setScript] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const upd = (n: string, patch: Partial<BeatRow>) => setBeats({ ...beats, rows: beats.rows.map((r) => (r.n === n ? { ...r, ...patch } : r)) })
  const del = (n: string) => setBeats({ ...beats, rows: beats.rows.filter((r) => r.n !== n), held: beats.held.filter((h) => h.from !== n && h.to !== n) })
  const addRow = () => setBeats(markBeat(beats, Math.min(duration, (rows.at(-1)?.t ?? 0) + 1), lanes[0] ?? '', trackerIds[0] ?? '').beats)
  const addLane = () => { const l = newLane.trim(); if (l && !beats.lanes.includes(l)) setBeats({ ...beats, lanes: [...lanes, l] }); setNewLane('') }
  const addHeld = () => { if (rows.length >= 2) setBeats({ ...beats, held: [...beats.held, { lane: lanes[0] ?? '', from: rows[0].n, to: rows[rows.length - 1].n }] }) }
  const updHeld = (i: number, patch: Partial<{ lane: string; from: string; to: string }>) => setBeats({ ...beats, held: beats.held.map((h, j) => (j === i ? { ...h, ...patch } : h)) })

  const exportScript = async () => {
    setBusy(true); setMsg('')
    const ok = await onSaveAnchors()
    if (!ok) { setBusy(false); setMsg('save failed'); return }
    const code = await runEngine('script', shot, [], () => {}, project)
    const r = await fetch(`${bridgePaths(project).shots}/${shot}.animation.md?v=${Date.now()}`)
    setScript(r.ok ? await r.text() : ''); setBusy(false)
    setMsg(code === 0 && r.ok ? `written: shots/${shot}.animation.md` : `script failed (exit ${code})`)
  }

  const inp = 'font-ws-mono text-xs bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1 outline-none focus:border-ws-terracotta'
  return (
    <div data-testid="beats" className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center gap-2">
        <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">lanes (timeline tracks)</span>
        {lanes.map((l) => <span key={l} data-testid={`lane-${l}`} className="ann-chip text-ws-text-primary border-ws-terracotta">{l}</span>)}
        <input data-testid="lane-new" value={newLane} onChange={(e) => setNewLane(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLane() }} placeholder="add lane (e.g. audio)" className={`${inp} w-44`} />
        <button data-testid="lane-add" onClick={addLane} className="ann-btn">add</button>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">beats (markers)</span>
          <button data-testid="beat-add" onClick={addRow} className="ann-btn">+ beat</button>
          <span className="text-xs text-ws-text-tertiary">Δ since previous · t cumulative · ● fires · │ held open · "mark beat here" on the frames view stamps the current frame</span>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="beats-table" className="text-xs font-ws-mono text-ws-text-secondary border-collapse">
            <thead><tr className="text-ws-text-tertiary">{['#', 'Δ', 't', ...lanes, 'motion', 'target', 'meaning', ''].map((h, i) => <th key={i} className="text-left px-2 py-1 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.n} data-testid={`beat-row-${r.n}`} className="border-t border-ws-border-subtle">
                  <td className="px-2 py-1"><input data-testid={`beat-n-${r.n}`} value={r.n} onChange={(e) => upd(r.n, { n: e.target.value })} className={`${inp} w-12`} /></td>
                  <td className="px-2 py-1 text-ws-text-tertiary">{r.delta.toFixed(2)}</td>
                  <td className="px-2 py-1"><input data-testid={`beat-t-${r.n}`} type="number" step="0.05" value={r.t} onChange={(e) => upd(r.n, { t: Number(e.target.value) })} className={`${inp} w-20`} /></td>
                  {cells[i].map((c, j) => <td key={j} className="px-2 py-1 text-center text-ws-terracotta-text" onClick={() => upd(r.n, { lane: lanes[j] })} title="click to put this beat on this lane">{c || '·'}</td>)}
                  <td className="px-2 py-1"><input data-testid={`beat-motion-${r.n}`} value={r.motion} onChange={(e) => upd(r.n, { motion: e.target.value })} placeholder="how it moves (property + duration)" className={`${inp} w-64`} /></td>
                  <td className="px-2 py-1">
                    <input data-testid={`beat-target-${r.n}`} list="tracker-ids" value={r.target} onChange={(e) => upd(r.n, { target: e.target.value })} className={`${inp} w-28`} />
                  </td>
                  <td className="px-2 py-1"><input data-testid={`beat-meaning-${r.n}`} value={r.meaning} onChange={(e) => upd(r.n, { meaning: e.target.value })} placeholder="the narrative beat" className={`${inp} w-56`} /></td>
                  <td className="px-2 py-1"><button data-testid={`beat-delete-${r.n}`} onClick={() => del(r.n)} className="ann-btn !px-1.5 !py-0.5">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="tracker-ids">{trackerIds.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">held open</span>
        {beats.held.map((h, i) => (
          <span key={i} data-testid={`held-${i}`} className="flex items-center gap-1 text-xs font-ws-mono">
            <Select testid={`held-${i}-lane`} value={h.lane} onChange={(v) => updHeld(i, { lane: v })} options={lanes.map((l) => ({ value: l, label: l }))} />
            <Select testid={`held-${i}-from`} value={h.from} onChange={(v) => updHeld(i, { from: v })} options={rows.map((r) => ({ value: r.n, label: r.n }))} />→
            <Select testid={`held-${i}-to`} value={h.to} onChange={(v) => updHeld(i, { to: v })} options={rows.map((r) => ({ value: r.n, label: r.n }))} />
            <button onClick={() => setBeats({ ...beats, held: beats.held.filter((_, j) => j !== i) })} className="ann-btn !px-1.5 !py-0.5">×</button>
          </span>
        ))}
        <button data-testid="held-add" onClick={addHeld} disabled={rows.length < 2} className="ann-btn disabled:opacity-40">+ held span</button>
      </section>

      <section className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label className="flex flex-col gap-1 text-xs text-ws-text-tertiary">intent (one paragraph: what the motion means)
          <textarea data-testid="meta-intent" value={meta.intent ?? ''} onChange={(e) => setMeta({ ...meta, intent: e.target.value })} rows={4} className={`${inp} !font-ws-body !text-sm`} /></label>
        <label className="flex flex-col gap-1 text-xs text-ws-text-tertiary">notes (one per line)
          <textarea data-testid="meta-notes" value={notes.join('\n')} onChange={(e) => setNotes(e.target.value.split('\n').filter((l) => l.trim()))} rows={4} className={`${inp} !font-ws-body !text-sm`} /></label>
        <label className="flex flex-col gap-1 text-xs text-ws-text-tertiary">surface / status
          <span className="flex gap-2"><input value={meta.surface ?? ''} onChange={(e) => setMeta({ ...meta, surface: e.target.value })} placeholder="surface" className={`${inp} flex-1`} />
            <Select testid="meta-status" value={meta.status ?? 'draft'} onChange={(v) => setMeta({ ...meta, status: v })} options={['draft', 'live', 'retired'].map((s) => ({ value: s, label: s }))} /></span></label>
        <label className="flex flex-col gap-1 text-xs text-ws-text-tertiary">decision log (date | decision | by, one per line)
          <textarea data-testid="meta-decisions" value={decisions.map((d) => `${d.date} | ${d.decision} | ${d.by}`).join('\n')}
            onChange={(e) => setDecisions(e.target.value.split('\n').filter((l) => l.trim()).map((l) => { const [date = '', decision = '', by = ''] = l.split('|').map((x) => x.trim()); return { date, decision, by } }))} rows={3} className={`${inp} !font-ws-body !text-sm`} /></label>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button data-testid="save-script" disabled={busy} onClick={exportScript} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)] disabled:opacity-40">{busy ? 'writing…' : 'save anchors + write Animation Script'}</button>
          {script && <button data-testid="copy-script" onClick={() => navigator.clipboard?.writeText(script)} className="ann-btn">copy script</button>}
          {msg && <span data-testid="script-status" className="text-xs font-ws-mono text-ws-sage">{msg}</span>}
        </div>
        {script && <pre data-testid="script-text" className="text-[0.7rem] font-ws-mono text-ws-text-secondary bg-black/30 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">{script}</pre>}
      </section>
    </div>
  )
}

/** Marker strip under the frame strip: beats as draggable flags on a 0..duration bar (Camtasia markers). */
export function MarkerStrip({ beats, setBeats, duration, sampleTimes, currentT, onMark, lanes, trackerIds, target, setTarget }: {
  beats: Beats; setBeats: (b: Beats) => void; duration: number; sampleTimes: number[]; currentT: number
  onMark: (lane: string, target: string) => void; lanes: string[]; trackerIds: string[]
  /** T2: the mark-beat target is owned by the host so a click on a tracker in the panel can set it. */
  target: string; setTarget: (id: string) => void
}) {
  const [lane, setLane] = useState(lanes[0] ?? '')
  const [drag, setDrag] = useState<string | null>(null)
  const pct = (t: number) => `${(100 * t) / Math.max(duration, 0.001)}%`
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag) return
    const box = e.currentTarget.getBoundingClientRect(); const t = Math.min(duration, Math.max(0, ((e.clientX - box.left) / box.width) * duration))
    setBeats({ ...beats, rows: beats.rows.map((r) => (r.n === drag ? { ...r, t: +t.toFixed(2) } : r)) })
  }
  return (
    <div data-testid="marker-strip" className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs font-ws-mono text-ws-text-tertiary">
        <span className="uppercase tracking-[0.22em] text-[0.6rem] text-ws-sage">markers</span>
        <Select testid="mark-lane" value={lane} onChange={setLane} options={(lanes.length ? lanes : ['']).map((l) => ({ value: l, label: l || '(lane)' }))} ariaLabel="lane" />
        <Select testid="mark-target" value={target} onChange={setTarget} options={(trackerIds.length ? trackerIds : ['']).map((t) => ({ value: t, label: t || '(target)' }))} ariaLabel="target" />
        <button data-testid="mark-beat" onClick={() => onMark(lane, target)} className="ann-btn">mark beat here ({currentT.toFixed(2)} s)</button>
        <span>drag a flag to move it</span>
      </div>
      <div className="relative h-9 rounded-lg border border-ws-border-subtle bg-black/20 select-none" onMouseMove={onMove} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)}>
        {sampleTimes.map((t) => <div key={t} className="absolute top-0 h-2 w-px bg-ws-text-tertiary/40" style={{ left: pct(t) }} />)}
        <div className="absolute top-0 bottom-0 w-px bg-ws-terracotta" style={{ left: pct(currentT) }} title="current frame" />
        {beats.rows.map((r) => (
          <button key={r.n} data-testid={`marker-${r.n}`} onMouseDown={() => setDrag(r.n)} title={`${r.n} · ${r.t.toFixed(2)} s · ${r.lane}`}
            className="absolute bottom-0 -translate-x-1/2 font-ws-mono text-[0.62rem] px-1 rounded-t border border-ws-terracotta bg-ws-terracotta/80 text-[#1a0e07] cursor-ew-resize" style={{ left: pct(r.t) }}>{r.n}</button>
        ))}
      </div>
    </div>
  )
}
