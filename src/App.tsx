import { useMemo, useRef, useState } from 'react'
import { AnnotatorPanel, createSvgSpace, useShapePicker } from './lib/canvas-annotator'
import { DemoVectorCanvas, ImageCanvas, useShapeOverlay } from './AnnotatedCanvas'

type Mode = 'vector' | 'image'

export default function App() {
  const [mode, setMode] = useState<Mode>('vector')
  const [drawing, setDrawing] = useState(true)
  const [img, setImg] = useState<{ src: string; w: number; h: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // One space, one picker, regardless of which canvas is mounted: the space
  // re-resolves the <svg> on every call, which is what makes canvases swappable.
  const space = useMemo(() => createSvgSpace(() => svgRef.current), [])
  const picker = useShapePicker({ space, enabled: drawing })
  useShapeOverlay(space, picker.liveShapes)

  const onFile = (f: File | undefined) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    const probe = new Image()
    probe.onload = () => setImg({ src: url, w: probe.naturalWidth, h: probe.naturalHeight })
    probe.src = url
  }

  return (
    <div className="min-h-screen p-6 max-w-[1400px] mx-auto">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-ws-mono text-ws-terracotta-text text-lg">canvas-annotator</h1>
        <span className="text-ws-text-tertiary text-sm">click a canvas to drop named anchors in its own units; copy them out</span>
        <div className="ml-auto flex items-center gap-2">
          <button className={`ann-chip ${mode === 'vector' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setMode('vector')}>vector demo</button>
          <button className={`ann-chip ${mode === 'image' ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setMode('image')}>image / video frame</button>
          <label className="ann-chip text-ws-text-secondary cursor-pointer">
            load image<input type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); setMode('image') }} />
          </label>
          <button className="ann-btn" onClick={() => setDrawing((d) => !d)}>{drawing ? 'drawing: on' : 'drawing: off'}</button>
        </div>
      </header>

      <div onClick={picker.onCanvasClick} className={`rounded-xl overflow-hidden border border-ws-border-subtle ${drawing && picker.active ? 'cursor-crosshair' : ''}`}>
        {mode === 'vector' && <DemoVectorCanvas svgRef={svgRef} />}
        {mode === 'image' && (img
          ? <ImageCanvas src={img.src} width={img.w} height={img.h} svgRef={svgRef} />
          : <div className="p-16 text-center text-ws-text-tertiary">load an image (a video frame from <code>vidfx keyframes</code> works) to annotate it in pixel units</div>)}
      </div>

      {img && mode === 'image' && (
        <p className="mt-2 text-xs text-ws-text-tertiary font-ws-mono">image {img.w}×{img.h} · shapes are in image pixels</p>
      )}

      {drawing && <AnnotatorPanel picker={picker} />}
    </div>
  )
}
