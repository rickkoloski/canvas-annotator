import type { Pt } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'
/** vbMin at which the shapeMarkup sizes (font 22, etc.) read as unit = 1. */
const REFERENCE_VBMIN = 2549

/**
 * A CanvasSpace is the ONLY thing that differs between canvases. It maps screen
 * coordinates into the canvas's own units and knows how to mount an overlay
 * there. Swap the implementation (SVG / raster / DOM) and the rest of the
 * annotator — the picker hook, the panel, the renderer — works unchanged.
 */
export interface CanvasSpace {
  /** The live target element (re-resolved each call, so it survives remounts). */
  getSvg(): SVGSVGElement | null
  /** Screen (clientX/Y) → canvas units, rounded. Null if not measurable yet. */
  screenToCanvas(clientX: number, clientY: number): Pt | null
  /** Screen pixels → canvas units, for scale-stable thresholds (snap radius). */
  pxToCanvas(px: number): number
  /** Size multiplier for markers/labels, derived from the viewBox extent. */
  unit(): number
  /** Ensure an overlay <g id> exists inside the canvas and return it. */
  mountOverlay(id: string): SVGGElement | null
}

/**
 * CanvasSpace over an inline SVG with a viewBox — covers every vector canvas in
 * this project (Figma frame exports, D3 charts, the gantt). `getSvg` is a
 * thunk so the space can be created once and still find the current <svg> after
 * a host component remounts.
 */
export function createSvgSpace(getSvg: () => SVGSVGElement | null): CanvasSpace {
  return {
    getSvg,
    screenToCanvas(clientX, clientY) {
      const svg = getSvg()
      const ctm = svg?.getScreenCTM()
      if (!svg || !ctm) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return { x: Math.round(p.x), y: Math.round(p.y) }
    },
    pxToCanvas(px) {
      const ctm = getSvg()?.getScreenCTM()
      const scale = ctm ? Math.hypot(ctm.a, ctm.b) : 1
      return scale ? px / scale : px
    },
    unit() {
      const vb = getSvg()?.viewBox?.baseVal
      const vbMin = vb && vb.width && vb.height ? Math.min(vb.width, vb.height) : REFERENCE_VBMIN
      return vbMin / REFERENCE_VBMIN
    },
    mountOverlay(id) {
      const svg = getSvg()
      if (!svg) return null
      let g = svg.querySelector<SVGGElement>(`#${id}`)
      if (!g) {
        g = document.createElementNS(SVG_NS, 'g')
        g.setAttribute('id', id)
        svg.appendChild(g)
      }
      return g
    },
  }
}
