# anchors.json (version 1)

The interchange between canvas-annotator (authoring) and video-fx (engine). Either side may
write it; both read it. One file per canvas, or per shot when the canvas is a video.

```json
{
  "version": 1,
  "canvas": {
    "kind": "video",            // "svg" | "image" | "video"
    "width": 1920,              // canvas units; for video, the tracking resolution
    "height": 1080,
    "fps": 25,                  // video only
    "source": "~/Desktop/frustration.mov",   // video or image path, or an svg id (informational)
    "shot": "frustration-walk"  // video only: the vidfx shot name
  },
  "shapes": [
    { "kind": "polygon", "id": "monitor", "label": "monitor", "frame": 0,
      "points": [ { "x": 847, "y": 324 }, { "x": 1270, "y": 243 }, { "x": 1309, "y": 827 }, { "x": 874, "y": 756 } ] },
    { "kind": "polygon", "id": "monitor", "label": "monitor", "frame": 124,
      "points": [ /* four points, any click order */ ] },
    { "kind": "circle",  "id": "cursor",  "label": "cursor",  "frame": 124, "x": 900, "y": 640, "r": 12 },
    { "kind": "line",    "id": "sightline", "label": "sightline", "points": [ { "x": 1, "y": 2 }, { "x": 3, "y": 4 } ] }
  ]
}
```

## Rules

- **Shape vocabulary** is the annotator's `CanvasShape` unchanged: `circle` (x, y, r),
  `line` (points), `polygon` (points, optional `open`), each with `id` and `label`, optional
  `color`. Units are the canvas's own: viewBox units for SVG, pixels at `canvas.width` by
  `canvas.height` for images and video.
- **`frame`** (integer, optional) places a shape on one video frame. Shapes without `frame`
  are timeless, which is the June 2026 behaviour. `frame` is meaningless for `svg` and
  `image` canvases and is ignored there.
- **A track** is all shapes sharing an `id` across frames. video-fx reads a polygon track
  with four points per frame as a quad (`track.anchors`, `track.anchor_id`), and orders the
  points TL, TR, BR, BL itself, so click order does not matter. Circle tracks are the
  planned input for a `pin` effect.
- **Scaling.** If `canvas.width` differs from the engine's tracking resolution, the engine
  scales the points. Authoring at the tracking resolution avoids rounding.
- **Engine output** uses the same document with two extra per-shape fields:
  `given` (the points as received) and `moved_px` (per-point refinement distance), written
  to `work/<shot>/refined.json`. A page can show given against refined and accept either.
- Unknown fields are preserved by both sides; `version` bumps only on an incompatible change.

## Where files live

| file | written by | read by |
|---|---|---|
| `work/<shot>/keyframes_sample/manifest.json` | `vidfx keyframes` | the annotator's frame strip |
| `work/<shot>/anchors.json` | the annotator (Save), or by hand | `vidfx track` via `track.anchors` |
| `work/<shot>/refined.json` | `vidfx track` | the annotator's review view (Phase 3) |

The manifest is not an anchors file; it lists frames: `{frame, t, path, grid, width, height}`
plus `canvas`, `fps`, `frames_total`, `source`, `shot`.
