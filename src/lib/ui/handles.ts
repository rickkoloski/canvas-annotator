/** Direct-manipulation maths (layers L1): a box in fractions of its canvas; move by a delta, resize from a corner keeping the aspect. */
export type Box = { x: number; y: number; w: number; h: number }   // centre x,y and size, all as fractions of the canvas
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export function moveBox(b: Box, dx: number, dy: number): Box { return { ...b, x: +clamp01(b.x + dx).toFixed(3), y: +clamp01(b.y + dy).toFixed(3) } }
/** Resize from a corner: the new width follows the pointer's distance from the centre along x; aspect kept; width stays within 2%..100%. */
export function resizeBox(b: Box, pointerX: number, aspect: number): Box {
  const w = Math.min(1, Math.max(0.02, Math.abs(pointerX - b.x) * 2))
  return { ...b, w: +w.toFixed(3), h: +(w / aspect).toFixed(3) }
}
