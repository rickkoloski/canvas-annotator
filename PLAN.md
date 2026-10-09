# Merge plan: canvas-annotator and video-fx keyframes

Two tools, built four months apart, turned out to be halves of one thing.

| | canvas-annotator (June 2026) | video-fx keyframes engine (Oct 2026) |
|---|---|---|
| Lives in | this repo (React, Vite) | `~/src/ops/creative/video-fx` (Python, OpenCV, ffmpeg) |
| Does | a person clicks named anchors onto a canvas and copies them out | takes approximate anchors at a few frames, refines them against pixels, interpolates, renders effects |
| Canvas | inline SVG (Figma exports, D3) | video frames at a fixed resolution |
| Output | shape literals, pasted into an Animation Script | `track.keyframes` YAML, consumed by `vidfx track` |
| Missing | any notion of time or frames; no pixel refinement | any UI; positions come from Claude reading grid frames, roughly 15 px off |

The merge keeps each where it is strong: **the annotator is the authoring surface,
video-fx is the engine, and a small shared interchange joins them.** No Python in the
browser, no React in the renderer.

## Principles

- One interchange document, versioned, that both sides read and write. Everything
  else stays private to its side.
- The annotator stays canvas-agnostic. Frames are just another `CanvasSpace`.
- video-fx stays headless. The page talks to it through files on disk, not sockets,
  so Claude Code, a human in a browser, and a script all look the same to it.
- Each phase ships something usable on its own and is checked on a real shot.

## Phases

### Phase 0: lift (done 2026-10-09)
Annotator copied unchanged into this repo with a standalone demo, including an image
canvas that proves `createSvgSpace` already handles a raster frame wrapped in an SVG.

### Phase 1: the interchange (done 2026-10-09)
Define `anchors.json` (schema in `docs/anchors.schema.md`):

```json
{ "version": 1, "canvas": { "kind": "video", "width": 1920, "height": 1080, "fps": 25, "source": "…" },
  "shapes": [ { "kind": "polygon", "id": "monitor", "label": "monitor", "frame": 248,
               "points": [ {"x":1028,"y":308}, … ] } ] }
```

Two additions to the shape vocabulary: an optional `frame` (integer) and a `canvas`
header. Shapes without `frame` are timeless, which is today's behaviour.

- annotator: "copy all" gains a JSON mode alongside the literal mode; `formatShape`
  learns `frame`.
- video-fx: `vidfx track` accepts `track.anchors: path/to/anchors.json` as an
  alternative to inline `track.keyframes`; a 4-point polygon with the same `id` at
  several frames is one tracked quad. Inline YAML keeps working.

Check: re-run `shots/frustration-keyframes.yaml` from an `anchors.json` and get the
same corners file.

### Phase 2: frames in the page (done 2026-10-09; first walk rehearsed 4× clean, see creative/walks)
- `vidfx keyframes` writes `work/<shot>/keyframes_sample/manifest.json` (frame index,
  time, path, width, height) next to the grid images it already writes.
- The page gets a **frame strip**: load a manifest, step through frames, the
  current frame is the canvas, shapes are tagged with the current frame
  automatically. Previously placed shapes for the same `id` show faintly on other
  frames so a corner can be followed.
- A "save" writes `anchors.json` back next to the manifest (Vite dev-server endpoint
  in dev; download as a fallback).

Check: keyframe the frustration clip's monitor by clicking instead of by Claude
reading grids; compare the refined track's crops.

### Phase 3: round trip (engine side done: `refined.json` is written; page side next)
- `vidfx track` writes `work/<shot>/refined.json` in the same schema, with the
  refined positions and the per-corner move distance.
- The page overlays refined (green) against given (red) per frame, the same view the
  engine's debug JPEGs give today, but live. Accept a refinement with one click to
  make it the new given; drag to correct the rest.

This is the "click-as-refinement" step the commercial tools have, built on the
engine we already trust.

### Phase 4: single points and pins
- Allow `circle` shapes with a `frame` to drive a `pin` effect in video-fx (a label
  follows a hand, a cursor, a badge). The engine interpolates single points exactly
  as it interpolates quads; the effect needs an offset and an anchor side.
- First real shot that SIFT cannot do, which is also the second shot the
  `creative/knowledge` store is waiting for.

### Phase 5: time in the annotator
- Adopt the Animation Script's **Beats** table as a first-class panel: anchors on the
  left, a beats table on the right, Δ and cumulative time, swimlanes. Export the
  whole script as markdown (today the Anchors section is the only generated part).
- Remotion briefs in `creative/workflows` use this instead of the ad-hoc beats list.

### Later, if earned
- Load a Figma frame directly (the sandbox's id-tagged SVG export script) so
  Anchors reference layer ids.
- A GSDevTools-style scrubber for Remotion or GSAP timelines inside the page, to
  "verify by seeking" against the beats table.
- Multi-object tracks and occlusion flags in the schema.

## What does not merge

- The Orrery-specific projection code in the website stays there.
- video-fx's SIFT engine has no UI role beyond showing its result in Phase 3.
- The md-editor review workflow for Animation Scripts stays as it is; this page
  generates the doc, it does not replace the review surface.

## Open decisions

1. Repo ownership: created under the personal GitHub account; transfer to the
   `portablemind-ai` org when the lane settles.
2. License: none yet (all rights reserved by default). Decide before anyone outside
   is pointed at it.
3. Whether Phase 2's save endpoint is a Vite plugin (dev only) or a tiny
   `vidfx serve` command. Vite plugin first; it is 30 lines.
