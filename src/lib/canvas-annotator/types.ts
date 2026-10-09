/**
 * Canvas annotator — shared shape vocabulary.
 *
 * A "canvas shape" is a named anchor authored in a canvas's OWN coordinate
 * space (e.g. SVG viewBox units). The tool only authors these records; how a
 * host consumes them (animation anchors, hotspots, hit-targets…) is the host's
 * concern, which is what keeps this reusable.
 *
 * `frame` (optional, added 2026-10-09) places a shape on one video frame. Shapes
 * without it are timeless, the original behaviour. See docs/anchors.schema.md.
 */
export type Pt = { x: number; y: number }

export type ShapeKind = 'circle' | 'line' | 'polygon'

type Common = { id: string; label: string; color?: string; wip?: boolean; frame?: number }

export type CanvasShape =
  | ({ kind: 'circle'; x: number; y: number; r: number } & Common)
  | ({ kind: 'line'; points: Pt[] } & Common)
  | ({ kind: 'polygon'; points: Pt[]; open?: boolean } & Common)
