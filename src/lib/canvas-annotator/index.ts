/**
 * canvas-annotator — a reusable, canvas-agnostic shape-authoring tool.
 *
 * Click any inline SVG to drop named circle/line/polygon anchors in the
 * canvas's own coordinate units, refine/name/serialize them. The host supplies
 * a CanvasSpace (the only canvas-specific part) and consumes the emitted
 * shapes however it likes (animation anchors, hotspots, …).
 *
 *   const space  = createSvgSpace(() => wrapRef.current?.querySelector('svg') ?? null)
 *   const picker = useShapePicker({ space, enabled })
 *   // <div onClick={picker.onCanvasClick}><MyCanvas shapes={picker.liveShapes} /></div>
 *   // <AnnotatorPanel picker={picker} />
 */
export type { Pt, ShapeKind, CanvasShape } from './types'
export { shapeMarkup, renderShapes } from './shapeMarkup'
export { createSvgSpace } from './space'
export type { CanvasSpace } from './space'
export { useShapePicker, formatShape } from './useShapePicker'
export type { ShapePicker } from './useShapePicker'
export { useDraggable } from './useDraggable'
export { AnnotatorPanel, groupTrackers } from './AnnotatorPanel'
