/**
 * Canvas annotator — shared shape vocabulary.
 *
 * A "canvas shape" is a named anchor authored in a canvas's OWN coordinate
 * space (e.g. SVG viewBox units). The tool only authors these records; how a
 * host consumes them (animation anchors, hotspots, hit-targets…) is the host's
 * concern, which is what keeps this reusable.
 */
export type Pt = { x: number; y: number }

export type ShapeKind = 'circle' | 'line' | 'polygon'

export type CanvasShape =
  | { kind: 'circle'; id: string; label: string; x: number; y: number; r: number; color?: string; wip?: boolean }
  | { kind: 'line'; id: string; label: string; points: Pt[]; color?: string; wip?: boolean }
  | { kind: 'polygon'; id: string; label: string; points: Pt[]; color?: string; open?: boolean; wip?: boolean }
