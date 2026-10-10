import type { CanvasShape, Pt, Vtx } from './types'

/**
 * SVG markup for one annotation shape, drawn in CANVAS (viewBox) units.
 *
 * `unit` scales every marker / label / stroke size (NOT the geometry coords)
 * so the overlay reads consistently across canvases with different viewBox
 * extents — `unit = 1` is the reference canvas (vbMin ≈ 2549). A canvas half
 * that size passes `unit ≈ 0.5` and the crosshairs/labels shrink to match.
 *
 * `wip` (the live, in-progress shape) draws its connecting lines at 2× weight
 * so the shape being authored stands out from already-saved ones.
 */
export function shapeMarkup(s: CanvasShape, unit = 1): string {
  const c = s.color ?? '#FF3B81'
  const w = s.wip ? 2 : 1
  const u = (n: number) => +(n * unit).toFixed(2)

  const cross = (x: number, y: number) =>
    `<line x1="${x - u(9)}" y1="${y}" x2="${x + u(9)}" y2="${y}" stroke="${c}" stroke-width="${u(2)}"/>` +
    `<line x1="${x}" y1="${y - u(9)}" x2="${x}" y2="${y + u(9)}" stroke="${c}" stroke-width="${u(2)}"/>`
  const vtx = (p: Pt, i: number) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${i === 0 ? u(7) : u(5)}" fill="${i === 0 ? 'none' : c}" stroke="${c}" stroke-width="${u(2)}"/>`
  const lbl = (x: number, y: number) =>
    `<text x="${x}" y="${y}" fill="${c}" font-family="'DM Mono', monospace" font-size="${u(22)}">${s.label || s.id}</text>`

  if (s.kind === 'circle') {
    return (
      `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="none" stroke="${c}" stroke-width="${u(2 * w)}" stroke-dasharray="${u(5)} ${u(4)}"/>` +
      cross(s.x, s.y) +
      lbl(s.x + s.r + u(8), s.y - s.r - u(4))
    )
  }
  const pts = s.points
  if (!pts.length) return ''
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const verts = pts.map(vtx).join('')
  const f = pts[0]
  if (s.kind === 'line') {
    return `<polyline points="${poly}" fill="none" stroke="${c}" stroke-width="${u(3 * w)}"/>` + verts + lbl(f.x + u(12), f.y - u(12))
  }
  const curved = (pts as Vtx[]).some((p) => p.in || p.out)
  const body = curved
    ? `<path d="${pathD(pts as Vtx[], !s.open)}" fill="${s.open ? 'none' : c + '22'}" stroke="${c}" stroke-width="${u(2.5 * w)}" stroke-dasharray="${u(6)} ${u(4)}"/>`
    : s.open
      ? `<polyline points="${poly}" fill="none" stroke="${c}" stroke-width="${u(2.5 * w)}" stroke-dasharray="${u(6)} ${u(4)}"/>`
      : `<polygon points="${poly}" fill="${c}22" stroke="${c}" stroke-width="${u(2.5 * w)}" stroke-dasharray="${u(6)} ${u(4)}"/>`
  const handles = curved ? (pts as Vtx[]).map((p) => [p.in, p.out].filter((h): h is Pt => !!h).map((h) =>
    `<line x1="${p.x}" y1="${p.y}" x2="${h.x}" y2="${h.y}" stroke="${c}" stroke-width="${u(1)}" opacity="0.8"/><circle cx="${h.x}" cy="${h.y}" r="${u(4)}" fill="#FAF7F0" stroke="${c}" stroke-width="${u(1.5)}"/>`).join('')).join('') : ''
  return body + handles + verts + lbl(f.x + u(12), f.y - u(16))
}

/** Replace `container`'s contents with the rendered shapes. */
export function renderShapes(container: Element, shapes: CanvasShape[], unit = 1): void {
  container.innerHTML = shapes.map((s) => shapeMarkup(s, unit)).join('')
}


/** SVG path for a polygon whose vertices may carry bezier handles: edge i→i+1 is C (P_i.out, P_{i+1}.in, P_{i+1}); a missing handle sits on its vertex. */
export function pathD(pts: Vtx[], close: boolean): string {
  if (!pts.length) return ''
  const n = pts.length; let d = `M ${pts[0].x} ${pts[0].y}`
  const edges = close ? n : n - 1
  for (let k = 0; k < edges; k++) {
    const a = pts[k], b = pts[(k + 1) % n]
    const c0 = a.out ?? a, c1 = b.in ?? b
    if (!a.out && !b.in) { if (!(close && k === n - 1)) d += ` L ${b.x} ${b.y}` }   // a straight closing edge is Z
    else d += ` C ${c0.x} ${c0.y} ${c1.x} ${c1.y} ${b.x} ${b.y}`
  }
  return close ? d + ' Z' : d
}
