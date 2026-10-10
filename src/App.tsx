import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppFrame } from './AppFrame'
import { MediaBin } from './MediaBin'
import { EffectsPanel, ToolsRail, type Tool } from './ToolsRail'
import { loadProject, rememberRecent, saveProject, withShot, type ProjectDoc } from './project'
import { AnnotatorPanel, createSvgSpace, useShapePicker } from './lib/canvas-annotator'
import { DemoVectorCanvas, ImageCanvas, useShapeOverlay } from './AnnotatedCanvas'
import { FramesMode } from './FramesMode'
import { AnimationMode } from './AnimationMode'

type Mode = 'vector' | 'image' | 'frames'

const params = new URLSearchParams(window.location.search)

export default function App() {
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || (params.get('shot') || params.get('anim') ? 'frames' : 'vector'))
  const [shot, setShot] = useState(params.get('shot') ?? '')
  const anim = params.get('anim') ?? undefined          // app frame A5b: an animation in the project
  const project = params.get('project') ?? undefined   // app frame A1: shots live in projects/<name>/; absent = legacy video-fx mounts
  // app frame A2: the project document, the unsaved dot, one Save for project.json + the shot's anchors
  const [proj, setProj] = useState<ProjectDoc | null>(null); const [projError, setProjError] = useState('')
  const [shotDirty, setShotDirty] = useState(false); const [saveTick, setSaveTick] = useState(0); const [view, setView] = useState('frames')
  // A7: the tools rail (Camtasia's left column); which group is open is a per-browser convenience
  const [tool, setToolState] = useState<Tool | null>(() => { try { const v = localStorage.getItem('canvas-annotator.tool'); return v === 'none' ? null : ((v as Tool) || (params.get('project') ? 'media' : 'trackers')) } catch { return 'media' } })
  const setTool = (t: Tool | null) => { setToolState(t); try { localStorage.setItem('canvas-annotator.tool', t ?? 'none') } catch { /* no storage */ } }
  const [trackersSlot, setTrackersSlot] = useState<HTMLElement | null>(null)
  const [trackers, setTrackers] = useState<{ id: string; kind: string }[]>([])
  useEffect(() => {
    if (!project) return
    loadProject(project).then((p) => { setProj(p); rememberRecent(p.name) }).catch((e) => setProjError(`cannot open project '${project}': ${String(e.message ?? e)}`))
  }, [project])
  const projDirty = !!proj && !!shot && (proj.recent?.shot !== shot || !proj.shots.includes(shot))
  const onSave = useCallback(async () => {
    let ok = true
    if (proj) { try { setProj(await saveProject(withShot(proj, shot, view))) } catch (e) { setProjError(String((e as Error).message ?? e)); ok = false } }
    if (shot && mode === 'frames') setSaveTick((t) => t + 1)
    return ok
  }, [proj, shot, view, mode])
  const [drawing, setDrawing] = useState(true)
  const [img, setImg] = useState<{ src: string; w: number; h: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // One space, one picker, regardless of which static canvas is mounted: the space
  // re-resolves the <svg> on every call, which is what makes canvases swappable.
  const space = useMemo(() => createSvgSpace(() => svgRef.current), [])
  const picker = useShapePicker({ space, enabled: drawing && mode !== 'frames' })
  useShapeOverlay(space, picker.liveShapes)

  const onFile = (f: File | undefined) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    const probe = new Image()
    probe.onload = () => setImg({ src: url, w: probe.naturalWidth, h: probe.naturalHeight })
    probe.src = url
  }
  const chip = (m: Mode, label: string) => (
    <button data-testid={`mode-${m}`} className={`ann-chip ${mode === m ? 'text-ws-text-primary border-ws-terracotta' : 'text-ws-text-secondary'}`} onClick={() => setMode(m)}>{label}</button>
  )

  return (
    <div className={`min-h-screen p-6 mx-auto ${proj || mode === 'frames' || anim ? 'max-w-[1760px]' : 'max-w-[1400px]'}`}>
      <AppFrame project={proj} dirty={shotDirty || projDirty} onSave={onSave} shot={shot} view={view} error={projError} anim={anim} />
      <div className="flex gap-4 items-start">
      {(proj || mode === 'frames' || anim) && (
        <ToolsRail tool={tool} onTool={setTool} groups={[
          { id: 'media', label: 'Media', icon: '🎞', available: !!proj, why: 'open a project (File › New Project… or Open Project…)' },
          { id: 'effects', label: 'Effects', icon: '✦', available: !!shot && !anim, why: 'open a shot' },
          { id: 'trackers', label: 'Trackers', icon: '◎', available: !!shot && !anim && drawing, why: drawing ? 'open a shot' : 'turn drawing on' },
        ]}>
          {tool === 'media' && proj && <MediaBin project={proj} onProject={setProj} />}
          {tool === 'effects' && <EffectsPanel trackers={trackers} />}
          {tool === 'trackers' && <div ref={setTrackersSlot} data-testid="trackers-slot" className="flex flex-col min-h-0 overflow-y-auto" />}
        </ToolsRail>
      )}
      <div className="flex-1 min-w-0">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-ws-mono text-ws-terracotta-text text-lg">canvas-annotator</h1>
        <span className="text-ws-text-tertiary text-sm">click a canvas to drop named anchors in its own units; copy them out</span>
        <div className="ml-auto flex items-center gap-2">
          {chip('vector', 'vector demo')}
          {chip('image', 'image')}
          {chip('frames', 'video frames')}
          <label className="ann-chip text-ws-text-secondary cursor-pointer">
            load image<input data-testid="load-image" type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); setMode('image') }} />
          </label>
          <button data-testid="drawing-toggle" className="ann-btn" onClick={() => setDrawing((d) => !d)}>{drawing ? 'drawing: on' : 'drawing: off'}</button>
        </div>
      </header>

      {anim && proj ? (
        <AnimationMode projectDoc={proj} anim={anim} onProject={setProj} />
      ) : mode === 'frames' ? (
        <FramesMode shot={shot} drawing={drawing} onShotChange={setShot} project={project} projectDoc={proj} onProject={setProj} saveTick={saveTick} onDirty={setShotDirty} onView={setView} trackersSlot={tool === 'trackers' ? trackersSlot : null} onTrackers={setTrackers} />
      ) : (
        <>
          <div data-testid="canvas" onClick={picker.onCanvasClick} className={`rounded-xl overflow-hidden border border-ws-border-subtle ${drawing && picker.active ? 'cursor-crosshair' : ''}`}>
            {mode === 'vector' && <DemoVectorCanvas svgRef={svgRef} />}
            {mode === 'image' && (img
              ? <ImageCanvas src={img.src} width={img.w} height={img.h} svgRef={svgRef} />
              : <div className="p-16 text-center text-ws-text-tertiary">load an image to annotate it in pixel units, or switch to video frames for a vidfx shot</div>)}
          </div>
          {img && mode === 'image' && <p className="mt-2 text-xs text-ws-text-tertiary font-ws-mono">image {img.w}×{img.h} · shapes are in image pixels</p>}
          {drawing && <AnnotatorPanel picker={picker} />}
        </>
      )}
      </div>
      </div>
    </div>
  )
}
