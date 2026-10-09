# canvas-annotator

Click any inline SVG, or an image wrapped as one, to drop named **circle / line /
polygon** anchors in the canvas's own coordinate units, then refine, name, and copy
them out. The "copy all" output is paste-ready: it is the **Anchors** section of an
[Animation Script](docs/animation-script-convention.md), and it is one adapter away
from a keyframe list for a tracked video composite.

Built in June 2026 inside the PortableMind website-redesign sandbox to author the
Orrery hero animation, where it closed the loop *draw → script* with zero
transcription. Lifted here in October 2026 as a standalone utility so it can also
serve video work (see [PLAN.md](PLAN.md)).

## Run

```
npm install
npm run dev        # http://localhost:5181
npm run build      # typecheck + bundle
```

Two canvases in the demo: a vector frame (stands in for a Figma export) and an
image canvas where you load any PNG/JPEG, for example a frame written by
`vidfx keyframes`. Shapes land in the canvas's units either way.

## Use it in your own app

```tsx
import { AnnotatorPanel, createSvgSpace, useShapePicker, renderShapes } from './lib/canvas-annotator'

const space  = createSvgSpace(() => wrapRef.current?.querySelector('svg') ?? null)
const picker = useShapePicker({ space, enabled })
// <div onClick={picker.onCanvasClick}><MyCanvas/></div>  then render picker.liveShapes
// into an overlay <g> inside the svg (see src/AnnotatedCanvas.tsx for the glue)
// <AnnotatorPanel picker={picker} />
```

The only canvas-specific piece is the `CanvasSpace`. `createSvgSpace` covers every
inline SVG with a viewBox, which includes a raster frame presented as
`<svg viewBox="0 0 W H"><image/></svg>`.

## Layout

```
src/lib/canvas-annotator/   the tool, unchanged from the sandbox (types, space, picker hook, panel, renderer)
src/AnnotatedCanvas.tsx     host glue: overlay mounting, image canvas, demo vector canvas
src/App.tsx                 the demo page
docs/                       Animation Script convention and its canonical example
PLAN.md                     merge plan with the video-fx keyframe work
```

## Provenance

Copied from `pm-site-redesign` at commit `e3479c7` (local sandbox repo). The
production website carries only the shape types and renderer; the interactive tool
was intentionally left out of the site bundle.
