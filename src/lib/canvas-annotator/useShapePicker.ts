import { useEffect, useMemo, useState } from 'react'
import type { CanvasShape, Pt, ShapeKind } from './types'
import type { CanvasSpace } from './space'

const slug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shape'
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Serialize a shape to a paste-ready record literal. */
export function formatShape(s: CanvasShape): string {
  const id = slug(s.label || s.id)
  if (s.kind === 'circle') return `{ kind: 'circle', id: '${id}', label: '${s.label}', x: ${s.x}, y: ${s.y}, r: ${s.r} },`
  const pts = s.points.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ')
  return `{ kind: '${s.kind}', id: '${id}', label: '${s.label}', points: [${pts}] },`
}

export type ShapePicker = ReturnType<typeof useShapePicker>

type Options = {
  /** Maps clicks ↔ canvas units and overlay mounting. */
  space: CanvasSpace
  /** When false, canvas clicks are ignored (tool "off"). */
  enabled: boolean
  /** Snap-to-close radius for polygons, in SCREEN px (scale-stable). */
  snapPx?: number
  /** Default radius for a freshly-placed circle, in canvas units. */
  defaultRadius?: number
  /** Highlight color applied to the live in-progress shape. */
  highlightColor?: string
}

/**
 * Headless annotation capture. Owns the shape-drawing state machine and emits
 * `liveShapes` (saved + the in-progress one) for a canvas to render. No JSX, no
 * canvas knowledge beyond the injected `space`.
 *
 *  · circle  — one click (center) + radius stepper
 *  · line    — two clicks (endpoints)
 *  · polygon — N clicks; close on the first point, finish(), or Enter; Esc cancels
 */
export function useShapePicker({
  space,
  enabled,
  snapPx = 18,
  defaultRadius = 18,
  highlightColor = '#F0B47A',
}: Options) {
  const [shapeType, setShapeTypeRaw] = useState<ShapeKind>('circle')
  const [current, setCurrent] = useState<CanvasShape | null>(null)
  const [drawing, setDrawing] = useState(false) // mid multi-point capture
  const [selPt, setSelPt] = useState(0) // selected vertex for line/polygon
  const [saved, setSaved] = useState<CanvasShape[]>([])
  const [copied, setCopied] = useState('')
  const [active, setActiveState] = useState(true) // editor pause/resume — when false, no canvas capture

  const finish = () => {
    if (!current || current.kind === 'circle') return
    if (current.kind === 'polygon') setCurrent({ ...current, open: false })
    setDrawing(false)
    setSelPt(0)
  }
  const cancel = () => {
    setCurrent(null)
    setDrawing(false)
  }
  // switching shape type abandons any in-progress capture
  const setShapeType = (t: ShapeKind) => {
    setShapeTypeRaw(t)
    cancel()
  }

  const onCanvasClick = (e: { clientX: number; clientY: number }) => {
    if (!enabled || !active) return
    const p = space.screenToCanvas(e.clientX, e.clientY)
    if (!p) return
    setCopied('')

    if (shapeType === 'circle') {
      setCurrent({ kind: 'circle', id: 'draft', label: '', x: p.x, y: p.y, r: defaultRadius })
      setDrawing(false)
      return
    }
    if (shapeType === 'line') {
      if (!drawing || !current || current.kind !== 'line') {
        setCurrent({ kind: 'line', id: 'draft', label: '', points: [p] })
        setDrawing(true)
      } else {
        const points = [...current.points, p]
        setCurrent({ ...current, points })
        if (points.length >= 2) { setDrawing(false); setSelPt(0) }
      }
      return
    }
    // polygon
    if (!drawing || !current || current.kind !== 'polygon') {
      setCurrent({ kind: 'polygon', id: 'draft', label: '', points: [p], open: true })
      setDrawing(true)
    } else {
      const pts = current.points
      const snap = space.pxToCanvas(snapPx)
      if (pts.length >= 3 && dist(p, pts[0]) < snap) {
        setCurrent({ ...current, open: false })
        setDrawing(false)
        setSelPt(0)
      } else {
        setCurrent({ ...current, points: [...pts, p] })
      }
    }
  }

  // keyboard: Enter finishes a multi-point shape, Esc cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!drawing) return
      if (e.key === 'Enter') {
        if (current && current.kind !== 'circle' && current.points.length >= (current.kind === 'line' ? 2 : 3)) finish()
      } else if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawing, current])

  // ── coordinate editors ──
  const setName = (label: string) => current && setCurrent({ ...current, label })
  const setCircle = (axis: 'x' | 'y' | 'r', v: number) => {
    if (!current || current.kind !== 'circle') return
    setCurrent({ ...current, [axis]: axis === 'r' ? Math.max(1, Math.round(v)) : Math.round(v) })
  }
  const setPoint = (axis: 'x' | 'y', v: number) => {
    if (!current || current.kind === 'circle') return
    const points = current.points.map((p, i) => (i === selPt ? { ...p, [axis]: Math.round(v) } : p))
    setCurrent({ ...current, points })
  }

  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(tag)
    window.setTimeout(() => setCopied(''), 1400)
  }
  const copyCurrent = () => current && copy(formatShape({ ...current, id: slug(current.label) }), 'node')
  const copyAll = () => copy(saved.map(formatShape).join('\n'), 'all')
  const clearSaved = () => setSaved([])
  const addToList = () => {
    if (!current) return
    const node = { ...current, id: slug(current.label), label: current.label || slug(current.label) }
    setSaved((s) => [...s.filter((n) => n.id !== node.id), node])
    setCurrent(null)
  }

  const liveShapes: CanvasShape[] = useMemo(
    () => [...saved, ...(current ? [{ ...current, color: highlightColor, wip: true }] : [])],
    [saved, current, highlightColor],
  )

  /** True when the name/refine editor should show (a shape exists, not drawing). */
  const editing = Boolean(current) && !drawing

  return {
    // state
    shapeType, setShapeType,
    current, drawing, editing, selPt, setSelPt, saved, copied,
    // active/pause — the editor owns its capture state (deactivating cancels
    // any in-progress draw and frees the canvas for the host)
    active,
    setActive: (v: boolean) => { if (!v) cancel(); setActiveState(v) },
    // canvas wiring
    onCanvasClick, liveShapes,
    // capture control
    finish, cancel,
    // editing
    setName, setCircle, setPoint, addToList,
    // export
    copyCurrent, copyAll, clearSaved, formatShape,
  }
}
