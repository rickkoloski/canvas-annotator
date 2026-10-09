import { useEffect, useRef } from 'react'
import { renderShapes, type CanvasShape, type CanvasSpace } from './lib/canvas-annotator'

/**
 * Host-side glue the sandbox had inside its Orrery component: mount the overlay
 * <g> inside the canvas's <svg> and re-render the picker's live shapes into it.
 * Works for any canvas that exposes an <svg> through the CanvasSpace, including
 * a raster frame wrapped as <svg viewBox><image/></svg>.
 */
export function useShapeOverlay(space: CanvasSpace, shapes: CanvasShape[], overlayId = 'annotator-overlay') {
  useEffect(() => {
    const g = space.mountOverlay(overlayId)
    if (g) renderShapes(g, shapes, space.unit())
  }, [space, shapes, overlayId])
}

/** A raster image presented as an SVG canvas so clicks land in image pixel units. */
export function ImageCanvas({ src, width, height, svgRef }: {
  src: string; width: number; height: number; svgRef: React.RefObject<SVGSVGElement>
}) {
  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block select-none" xmlns="http://www.w3.org/2000/svg">
      <image href={src} width={width} height={height} />
    </svg>
  )
}

/** A small vector demo canvas, standing in for a Figma frame export. */
export function DemoVectorCanvas({ svgRef }: { svgRef: React.RefObject<SVGSVGElement> }) {
  const r = useRef<SVGSVGElement>(null)
  // forward the inner ref without a forwardRef wrapper
  useEffect(() => { (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = r.current }, [svgRef])
  return (
    <svg ref={r} viewBox="0 0 1600 900" className="w-full h-auto block select-none" xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="900" fill="#0B111B" />
      <g id="monitor">
        <rect x="560" y="180" width="700" height="420" rx="14" fill="#101824" stroke="#6E6962" strokeWidth="4" />
        <rect x="590" y="210" width="640" height="340" fill="#EAE2D4" />
        <rect x="860" y="600" width="100" height="60" fill="#101824" />
        <rect x="780" y="660" width="260" height="14" rx="7" fill="#101824" />
      </g>
      <g id="brain">
        <ellipse cx="300" cy="420" rx="150" ry="120" fill="none" stroke="#7FA3A0" strokeWidth="4" strokeDasharray="10 6" />
        <circle cx="260" cy="400" r="18" fill="#C06A45" />
        <circle cx="340" cy="450" r="12" fill="#E09B58" />
      </g>
      <text x="40" y="860" fill="#6E6962" fontFamily="'DM Mono', monospace" fontSize="26">demo canvas · viewBox 1600×900 · click to drop anchors</text>
    </svg>
  )
}
