import { useRef, useState } from 'react'
import { moveBox, resizeBox, type Box } from './handles'

/**
 * Handles on the canvas for the selected layer (layers L1; Camtasia's handles): drag the body to move, a corner to
 * resize (aspect kept). Positions are fractions of the container, which must be `position: relative`. The box
 * follows the pointer locally and `onCommit` fires once on release with the final box, so the file of truth gets
 * one write per gesture.
 */
export function SelectionBox({ box, aspect, label, onCommit, movable = true, resizable = true, testid = 'selection-box' }: {
  box: Box; aspect: number; label?: string; onCommit: (b: Box) => void; movable?: boolean; resizable?: boolean; testid?: string
}) {
  const [live, setLive] = useState<Box | null>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; start: { x: number; y: number }; box: Box; rect: DOMRect } | null>(null)
  const b = live ?? box
  const begin = (mode: 'move' | 'resize') => (e: React.MouseEvent) => {
    if ((mode === 'move' && !movable) || (mode === 'resize' && !resizable)) return
    e.preventDefault(); e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).closest('[data-canvas-root]')?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
    drag.current = { mode, start: { x: e.clientX, y: e.clientY }, box, rect }
    const onMove = (ev: MouseEvent) => {
      const d = drag.current; if (!d) return
      const fx = (ev.clientX - d.start.x) / d.rect.width, fy = (ev.clientY - d.start.y) / d.rect.height
      setLive(d.mode === 'move' ? moveBox(d.box, fx, fy) : resizeBox(d.box, (ev.clientX - d.rect.left) / d.rect.width, aspect))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      const d = drag.current; drag.current = null
      setLive((l) => { if (l && d && (l.x !== d.box.x || l.y !== d.box.y || l.w !== d.box.w)) onCommit(l); return null })
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }
  const corner = (name: string, style: React.CSSProperties) => (
    <div data-testid={`handle-${name}`} onMouseDown={begin('resize')} className={`absolute w-3 h-3 bg-ws-text-primary border border-ws-terracotta rounded-sm ${resizable ? 'cursor-nwse-resize' : 'opacity-40'}`} style={{ ...style, transform: 'translate(-50%, -50%)' }} />
  )
  return (
    <div data-testid={testid} onMouseDown={begin('move')} onClick={(e) => e.stopPropagation()}
      className={`absolute border-2 border-ws-terracotta ${movable ? 'cursor-move' : ''}`}
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 1px rgba(0,0,0,.5)' }}>
      {label && <span className="absolute -top-5 left-0 font-ws-mono text-[0.6rem] px-1 rounded bg-ws-terracotta text-[#1a0e07] whitespace-nowrap">{label}</span>}
      {corner('tl', { left: 0, top: 0 })}{corner('tr', { left: '100%', top: 0 })}{corner('br', { left: '100%', top: '100%' })}{corner('bl', { left: 0, top: '100%' })}
    </div>
  )
}
