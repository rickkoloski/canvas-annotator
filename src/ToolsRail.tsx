import type { ReactNode } from 'react'

/**
 * Tools rail (app frame A7, Rick 2026-10-10): Camtasia's left column — a vertical list of tool groups; the selected
 * group's panel opens beside it; everything in a panel drags onto the canvas. Only groups that exist are listed
 * (no placeholder rows); a group that needs context (a project, an open shot) is dimmed until it has it. Clicking
 * the active group hides the panel, which gives the canvas the width (Camtasia: hide the tools panel).
 */
export type Tool = 'media' | 'effects' | 'trackers'
export type ToolGroup = { id: Tool; label: string; icon: string; available: boolean; why?: string }

export function ToolsRail({ tool, onTool, groups, children }: { tool: Tool | null; onTool: (t: Tool | null) => void; groups: ToolGroup[]; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-0 self-start sticky top-4">
      <nav data-testid="tools-rail" className="glass rounded-2xl p-1.5 flex flex-col gap-1 w-16">
        {groups.map((g) => {
          const active = tool === g.id
          return (
            <button key={g.id} data-testid={`rail-${g.id}`} data-active={active ? 'true' : 'false'} disabled={!g.available} title={g.available ? (active ? `Hide ${g.label}` : g.label) : g.why}
              onClick={() => onTool(active ? null : g.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 border transition-colors ${active ? 'border-ws-terracotta bg-[rgba(224,155,88,.14)] text-ws-text-primary' : 'border-transparent text-ws-text-secondary hover:bg-[rgba(250,247,240,.06)]'} disabled:opacity-30 disabled:hover:bg-transparent`}>
              <span className="text-lg leading-none">{g.icon}</span>
              <span className="font-ws-mono text-[0.55rem] tracking-[0.12em] uppercase">{g.label}</span>
            </button>
          )
        })}
      </nav>
      {tool && <div data-testid="tool-panel" data-tool={tool} className="glass rounded-2xl ml-2 w-72 shrink-0 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">{children}</div>}
    </div>
  )
}

/** Effects group: the engine's effects as draggable presets (Camtasia: drag an annotation or behavior onto the canvas). */
export const EFFECT_PRESETS: { kind: 'flyout' | 'pin' | 'bubble' | 'overlay'; label: string; icon: string; needs: string; hint: string }[] = [
  { kind: 'flyout', label: 'Fly-out', icon: '⤴', needs: 'a quad tracker', hint: 'the screen lifts toward the viewer and flattens, carrying a UI (a still or a recording from the bin)' },
  { kind: 'pin', label: 'Pin', icon: '📌', needs: 'a tracker', hint: 'a card held on a quad, or beside a point, for a time window' },
  { kind: 'bubble', label: 'Speech bubble', icon: '💬', needs: 'a point tracker', hint: 'a balloon with a tail to the point; springs in, pops out' },
  { kind: 'overlay', label: 'Overlay', icon: '🖼', needs: 'an image in the bin', hint: 'an image on the frame: static, beside a point, or warped onto a quad. Drop a Media Bin image on the canvas, or this preset to use the first image' },
]

export function EffectsPanel({ trackers }: { trackers: { id: string; kind: string }[] }) {
  const quads = trackers.filter((t) => t.kind === 'polygon').length, points = trackers.filter((t) => t.kind === 'circle').length
  return (
    <div data-testid="effects-panel" className="p-3 flex flex-col gap-2 overflow-y-auto">
      <div className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">Effects <span className="text-ws-text-tertiary normal-case tracking-normal">· drag onto the canvas</span></div>
      <div className="font-ws-mono text-[0.62rem] text-ws-text-tertiary">{trackers.length ? `${quads} quad · ${points} point tracker${points === 1 ? '' : 's'} on this shot` : 'no motion trackers yet: draw one first (Trackers)'}</div>
      {EFFECT_PRESETS.map((p) => (
        <div key={p.kind} data-testid={`effect-preset-${p.kind}`} draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-effect-kind', p.kind); e.dataTransfer.setData('text/plain', p.kind) }}
          className="rounded-lg border border-ws-border-subtle hover:border-ws-border-strong p-2 cursor-grab active:cursor-grabbing bg-black/20">
          <div className="flex items-center gap-2 font-ws-mono text-xs text-ws-text-primary"><span>{p.icon}</span>{p.label}<span className="ml-auto text-[0.6rem] text-ws-text-tertiary">needs {p.needs}</span></div>
          <div className="text-[0.66rem] text-ws-text-secondary mt-1 leading-snug">{p.hint}</div>
        </div>
      ))}
    </div>
  )
}
