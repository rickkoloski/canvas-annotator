import { useState } from 'react'
import type React from 'react'
import type { CanvasShape, ShapeKind } from './types'
import type { ShapePicker } from './useShapePicker'
import { useDraggable } from './useDraggable'

/**
 * Floating control palette for the annotator: shape-type selector, in-progress
 * status, the name/refine editor, and the saved-shapes list — all driven by a
 * ShapePicker. The panel is DRAGGABLE (grab the header) and MINIMIZEABLE so it
 * can be moved into or out of the way over the canvas while authoring.
 *
 * Presentational only: it holds no capture state of its own.
 */

const SHAPES: { type: ShapeKind; label: string; hint: string }[] = [
  { type: 'circle', label: '○ Circle', hint: 'click a center' },
  { type: 'line', label: '╱ Line', hint: 'click two endpoints' },
  { type: 'polygon', label: '▱ Polygon', hint: 'click points · click the first dot (or Enter) to close · Esc cancels' },
]

const PANEL_CSS = `
.ann-btn{font-family:'DM Mono',monospace;font-size:.7rem;color:#A9A49B;background:rgba(250,247,240,.06);border:1px solid rgba(250,247,240,.12);border-radius:8px;padding:.25rem .45rem;transition:all .2s;cursor:pointer}
.ann-btn:hover{color:#1a0e07;background:rgba(224,155,88,.85)}
.ann-chip{padding:.35rem .7rem;border-radius:9999px;font-size:.8rem;font-family:'DM Mono',monospace;transition:all .2s;cursor:pointer;border:1px solid rgba(250,247,240,.12)}
`

/** Saved shapes grouped into motion trackers by id, in first-seen order, rows sorted by frame (P1, walk 2). "Track" is a timeline layer (Camtasia sense). */
export function groupTrackers(saved: CanvasShape[]): { id: string; kind: ShapeKind; rows: { n: CanvasShape; i: number }[] }[] {
  const groups: { id: string; kind: ShapeKind; rows: { n: CanvasShape; i: number }[] }[] = []
  saved.forEach((n, i) => {
    let g = groups.find((x) => x.id === n.id)
    if (!g) { g = { id: n.id, kind: n.kind, rows: [] }; groups.push(g) }
    g.rows.push({ n, i })
  })
  for (const g of groups) g.rows.sort((a, b) => (a.n.frame ?? -1) - (b.n.frame ?? -1))
  return groups
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-ws-mono text-xs text-ws-text-tertiary uppercase w-3">{label}</span>
      <button onClick={() => onChange(value - 5)} className="ann-btn">−5</button>
      <button onClick={() => onChange(value - 1)} className="ann-btn">−1</button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        className="w-20 text-sm text-center bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-1 py-1 outline-none focus:border-ws-terracotta"
      />
      <button onClick={() => onChange(value + 1)} className="ann-btn">+1</button>
      <button onClick={() => onChange(value + 5)} className="ann-btn">+5</button>
    </div>
  )
}

export function AnnotatorPanel({
  picker,
  title = 'Annotate Canvas',
  initialPos = { x: typeof window !== 'undefined' ? window.innerWidth - 364 : 24, y: 80 },
  extraActions,
  onJumpFrame,
  onSelectTracker,
  selectedTracker,
  docked = false,
}: {
  picker: ShapePicker
  title?: string
  initialPos?: { x: number; y: number }
  /** Host-supplied buttons rendered beside "copy all" (e.g. save to a file). */
  extraActions?: React.ReactNode
  /** T2: clicking a keyframe row's name jumps the host to that frame. */
  onJumpFrame?: (frame: number) => void
  /** T2: clicking a motion tracker's name selects it (the host uses it as the mark-beat target). */
  onSelectTracker?: (id: string) => void
  selectedTracker?: string
  /** A7: render inside a host column (the tools rail) instead of as a floating, draggable window. */
  docked?: boolean
}) {
  const [min, setMin] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const { pos, handleProps } = useDraggable(initialPos)
  const { current, drawing, editing, saved } = picker
  const paused = !picker.active

  const activeHint = SHAPES.find((s) => s.type === picker.shapeType)?.hint
  const statusLabel = drawing && current && current.kind !== 'circle'
    ? `${current.kind} · ${current.points.length} pt${current.points.length !== 1 ? 's' : ''}`
    : editing && current
      ? `editing ${current.kind}`
      : `${saved.length} saved`

  return (
    <div data-testid="annotator-panel" style={docked ? { width: '100%' } : { position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, width: paused ? 220 : 340 }}>
      <style>{PANEL_CSS}</style>
      <div className={docked ? 'overflow-hidden' : 'glass rounded-2xl shadow-2xl overflow-hidden'}>
        {/* header / drag handle (docked: just a header) */}
        <div
          {...(docked ? {} : handleProps)}
          className={`flex items-center justify-between px-4 py-2.5 select-none ${paused ? '' : 'border-b border-ws-border-subtle'}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {!docked && <span className="text-ws-text-tertiary text-base leading-none">⠿</span>}
            <span className={`font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text ${docked ? 'truncate' : 'whitespace-nowrap'}`} title={title}>{title}</span>
            {(min || paused) && <span className="text-[0.7rem] text-ws-text-tertiary truncate">· {paused ? 'paused' : statusLabel}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => picker.setActive(paused)}
              className="ann-btn !px-2"
              title={paused ? 'Activate — resume drawing' : 'Pause — stop capturing the canvas'}
            >
              {paused ? '⏻' : '❚❚'}
            </button>
            {!paused && (
              <button
                onClick={() => setMin((m) => !m)}
                className="ann-btn !px-2"
                title={min ? 'Expand' : 'Minimize'}
              >
                {min ? '▢' : '—'}
              </button>
            )}
          </div>
        </div>

        {!paused && !min && (
          <div className="flex flex-col gap-4 p-4">
            {/* shape-type selector */}
            <div className="flex flex-col gap-2">
              <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">Draw</span>
              <div className="flex flex-wrap gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.type}
                    data-testid={`shape-${s.type}`}
                    onClick={() => picker.setShapeType(s.type)}
                    className="ann-chip"
                    style={picker.shapeType === s.type
                      ? { background: 'rgba(192,106,69,0.85)', color: '#1a0e07' }
                      : { background: 'rgba(250,247,240,0.06)', color: '#A9A49B' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="text-[0.72rem] text-ws-text-tertiary">{activeHint}</span>
            </div>

            {/* in-progress multi-point capture */}
            {drawing && current && current.kind !== 'circle' && (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(250,247,240,.04)' }}>
                <span className="text-sm text-ws-text-secondary">
                  {current.kind === 'line' ? 'Line' : 'Polygon'}: {current.points.length} point{current.points.length !== 1 ? 's' : ''}
                </span>
                {current.points.length >= (current.kind === 'line' ? 2 : 3) && (
                  <button data-testid="shape-finish" onClick={picker.finish} className="ann-btn !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]">finish</button>
                )}
                <button data-testid="shape-cancel" onClick={picker.cancel} className="ann-btn">cancel</button>
              </div>
            )}

            {/* name + refine the current shape */}
            {editing && current && (
              <div className="flex flex-col gap-3 border-t border-ws-border-subtle pt-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ws-text-tertiary">Name</span>
                  <input
                    data-testid="shape-name"
                    value={current.label}
                    onChange={(e) => picker.setName(e.target.value)}
                    placeholder="e.g. left-frontal-cluster"
                    className="text-sm bg-transparent text-ws-text-primary border border-ws-border-subtle rounded-lg px-2 py-1.5 outline-none focus:border-ws-terracotta"
                  />
                </label>

                {current.kind === 'circle' ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-ws-text-tertiary">Center &amp; radius</span>
                    <Stepper label="x" value={current.x} onChange={(v) => picker.setCircle('x', v)} />
                    <Stepper label="y" value={current.y} onChange={(v) => picker.setCircle('y', v)} />
                    <Stepper label="r" value={current.r} onChange={(v) => picker.setCircle('r', v)} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-ws-text-tertiary">Points — select one to nudge</span>
                    <div className="flex flex-wrap gap-1">
                      {current.points.map((_, i) => (
                        <button
                          key={i}
                          data-testid={`point-${i}`}
                          onClick={() => picker.setSelPt(i)}
                          className="px-2 py-1 rounded-lg text-xs font-ws-mono"
                          style={picker.selPt === i ? { background: 'rgba(224,155,88,.85)', color: '#1a0e07' } : { background: 'rgba(250,247,240,.06)', color: '#A9A49B' }}
                        >
                          P{i}
                        </button>
                      ))}
                    </div>
                    {current.points[picker.selPt] && (
                      <>
                        <Stepper label="x" value={current.points[picker.selPt].x} onChange={(v) => picker.setPoint('x', v)} />
                        <Stepper label="y" value={current.points[picker.selPt].y} onChange={(v) => picker.setPoint('y', v)} />
                      </>
                    )}
                  </div>
                )}

                <button data-testid="shape-copy" onClick={picker.copyCurrent} className="btn btn-primary !py-2.5 text-sm w-full">
                  {picker.copied === 'node' ? '✓ Copied to clipboard' : 'Copy shape to clipboard'}
                </button>
                <button data-testid="shape-add" onClick={picker.addToList} className="ann-btn self-start">+ add to group list (for batching)</button>
              </div>
            )}

            {/* saved batch */}
            {saved.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-ws-border-subtle pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-text-tertiary">Motion trackers ({groupTrackers(saved).length}) · {saved.length} shapes</span>
                  <div className="flex gap-2">
                    <button data-testid="copy-all" onClick={picker.copyAll} className="ann-btn">{picker.copied === 'all' ? '✓ copied all' : 'copy all'}</button>
                    {extraActions}
                    <button data-testid="undo" onClick={picker.undo} disabled={!picker.canUndo} className="ann-btn disabled:opacity-40" title="Undo (⌘Z)">undo</button>
                    <button data-testid="clear-saved" onClick={picker.clearSaved} className="ann-btn">clear</button>
                  </div>
                </div>
                <div data-testid="saved-list" className={`flex flex-col gap-1 bg-black/30 rounded-lg p-2 overflow-y-auto ${docked ? 'max-h-[40vh]' : 'max-h-56'}`}>
                  {groupTrackers(saved).map((g) => {
                    const open = !collapsed.has(g.id); const hidden = picker.hidden.has(g.id)
                    const kindIcon = g.kind === 'circle' ? '○' : g.kind === 'line' ? '╱' : '▱'
                    return (
                      <div key={g.id} data-testid={`tracker-${g.id}`} className="flex flex-col">
                        <div className="flex items-center gap-2 text-[0.68rem] font-ws-mono text-ws-text-primary">
                          <button data-testid={`tracker-toggle-${g.id}`} onClick={() => setCollapsed((c) => { const n = new Set(c); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })} className="ann-btn !px-1.5 !py-0.5" title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
                          <button data-testid={`tracker-name-${g.id}`} onClick={() => onSelectTracker?.(g.id)} disabled={!onSelectTracker}
                            className={`truncate flex-1 text-left bg-transparent border-0 p-0 font-inherit text-inherit ${onSelectTracker ? 'cursor-pointer hover:text-ws-terracotta' : 'cursor-default'}`}
                            style={{ opacity: hidden ? 0.5 : 1, color: selectedTracker === g.id ? '#C06A45' : undefined }} title={onSelectTracker ? 'Select as the mark-beat target' : undefined}>
                            {selectedTracker === g.id ? '▸ ' : ''}{kindIcon} {g.id} <span className="text-ws-text-tertiary">· {g.rows.length} {g.rows.some((r) => r.n.frame !== undefined) ? 'frame' : 'shape'}{g.rows.length !== 1 ? 's' : ''}</span>
                          </button>
                          <button data-testid={`tracker-hide-${g.id}`} onClick={() => picker.toggleHidden(g.id)} className="ann-btn !px-1.5 !py-0.5" title={hidden ? 'Show on canvas' : 'Hide on canvas'}>{hidden ? '◌' : '◉'}</button>
                          <button data-testid={`tracker-delete-${g.id}`} onClick={() => picker.deleteTracker(g.id)} className="ann-btn !px-1.5 !py-0.5" title="Delete the whole motion tracker">×</button>
                        </div>
                        {open && g.rows.map(({ n, i }) => (
                          <div key={`${n.id}-${n.frame ?? 'x'}-${i}`} data-testid={`saved-row-${i}`} className="flex items-center gap-2 pl-6 text-[0.66rem] font-ws-mono text-ws-text-secondary">
                            <button data-testid={`saved-edit-${i}`} onClick={() => picker.editSaved(i)} className="ann-btn !px-1.5 !py-0.5" title="Re-open for editing">✎</button>
                            <button data-testid={`saved-jump-${i}`} onClick={() => { if (n.frame !== undefined) onJumpFrame?.(n.frame) }} disabled={!onJumpFrame || n.frame === undefined}
                              className={`truncate flex-1 text-left bg-transparent border-0 p-0 font-inherit text-inherit ${onJumpFrame && n.frame !== undefined ? 'cursor-pointer hover:text-ws-terracotta' : 'cursor-default'}`}
                              title={onJumpFrame && n.frame !== undefined ? `Jump to frame ${n.frame}` : picker.formatShape(n)}>{n.frame !== undefined ? `frame ${n.frame}` : n.label || n.id}</button>
                            <button data-testid={`saved-delete-${i}`} onClick={() => picker.deleteSaved(i)} className="ann-btn !px-1.5 !py-0.5" title="Delete">×</button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
