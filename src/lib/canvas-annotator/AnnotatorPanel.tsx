import { useState } from 'react'
import type React from 'react'
import type { ShapeKind } from './types'
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
}: {
  picker: ShapePicker
  title?: string
  initialPos?: { x: number; y: number }
  /** Host-supplied buttons rendered beside "copy all" (e.g. save to a file). */
  extraActions?: React.ReactNode
}) {
  const [min, setMin] = useState(false)
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
    <div data-testid="annotator-panel" style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, width: paused ? 220 : 340 }}>
      <style>{PANEL_CSS}</style>
      <div className="glass rounded-2xl shadow-2xl overflow-hidden">
        {/* header / drag handle */}
        <div
          {...handleProps}
          className={`flex items-center justify-between px-4 py-2.5 select-none ${paused ? '' : 'border-b border-ws-border-subtle'}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-ws-text-tertiary text-base leading-none">⠿</span>
            <span className="font-ws-mono text-[0.62rem] tracking-[0.22em] uppercase text-ws-terracotta-text whitespace-nowrap">{title}</span>
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
                  <span className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-text-tertiary">Saved ({saved.length})</span>
                  <div className="flex gap-2">
                    <button data-testid="copy-all" onClick={picker.copyAll} className="ann-btn">{picker.copied === 'all' ? '✓ copied all' : 'copy all'}</button>
                    {extraActions}
                    <button data-testid="undo" onClick={picker.undo} disabled={!picker.canUndo} className="ann-btn disabled:opacity-40" title="Undo (⌘Z)">undo</button>
                    <button data-testid="clear-saved" onClick={picker.clearSaved} className="ann-btn">clear</button>
                  </div>
                </div>
                <div data-testid="saved-list" className="flex flex-col gap-1 bg-black/30 rounded-lg p-2 max-h-48 overflow-y-auto">
                  {saved.map((n, i) => (
                    <div key={`${n.id}-${n.frame ?? 'x'}-${i}`} data-testid={`saved-row-${i}`} className="flex items-center gap-2 text-[0.66rem] font-ws-mono text-ws-text-secondary">
                      <button data-testid={`saved-edit-${i}`} onClick={() => picker.editSaved(i)} className="ann-btn !px-1.5 !py-0.5" title="Re-open for editing">✎</button>
                      <span className="truncate flex-1" title={picker.formatShape(n)}>{n.kind} · {n.label || n.id}{n.frame !== undefined ? ` @${n.frame}` : ''}</span>
                      <button data-testid={`saved-delete-${i}`} onClick={() => picker.deleteSaved(i)} className="ann-btn !px-1.5 !py-0.5" title="Delete">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
