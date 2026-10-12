# PortableMind Creative Suite — information architecture

As of 2026-10-12. The guide is Camtasia's main UI (Rick: "use the main UIs from Camtasia as a guide as they are
familiar to me and many others"); After Effects for what Camtasia lacks (layers, the pen tool, tracking). A feature
Camtasia does not have is placed by asking "how would Camtasia fit this feature into their IA?".

## The chrome (every page)

| row | ours | Camtasia |
|---|---|---|
| 1 | the brand (top left, → the welcome page) · theme toggle (☀/☾, right) | the window title |
| 2 | **File ▾** · project name and facts · **animation** chooser · **shot** chooser · unsaved dot | the menu bar, the project title |

File ▾: New Project…, Open Project…, Open Recent, Save (⌘S), Save As…, New Shot… (vidfx), New Animation… (Remotion),
Export Zipped Project…, Import Zipped Project…, Close Project. Camtasia's names where it has them.

## The rail (left; Camtasia's tools column) and its panel

| group | panel | Camtasia |
|---|---|---|
| **Home** | the project home (shot and animation cards, New Shot… / New Animation…) | the home icon → Welcome |
| **Media** | *Media Bin* (Import Media, from path…, views, Sort by, rename, delete, unused, missing, ⛓ linked, ✂ cut of…) · *Library* (folders, Add to Library…, add to project) | Media › Media Bin / Library |
| **Effects** | the four presets (fly-out, pin, speech bubble, overlay), dragged onto the canvas | Annotations / Behaviors / Visual Effects |
| **Layers** | one stacked list per document: guide layers (the motion trackers with their keyframes and the drawing tools) then the effect layers; an animation's layers and texts; click = select, handles on the canvas, Delete | the timeline's tracks (After Effects' layer stack with guide layers) |

Only groups that exist are listed; a group dims until it has its context (a project, an open shot). Clicking the
active group hides the panel.

## Documents (what the centre shows)

| document | URL | centre | below the canvas | renderer |
|---|---|---|---|---|
| **welcome** | `/` | New Project…, Open Project…, Recent | | |
| **project home** | `?project=` | shot cards, animation cards | | |
| **shot** | `?project=&shot=` | views **frames** (the canvas and the sampled-frame strip) · **results · draft** · **beats** · loupe; the engine row (sample frame, track motion, crops, **render draft**) | the **transport** (⏮ ▶ ⏭, time, scrub: plays the rendered draft in place, or offers to render one), the frame strip, the markers strip | vidfx |
| **animation** | `?project=&anim=` | Remotion's Player (live), render draft, open in Studio | the Player's own controls | Remotion |
| **cut** | `?project=&cut=` (Media Bin › right-click a video › Cut and speed…) | the source video | the timeline: ruler, playhead, clips as solid bars with tiled thumbnails; ✂ split, delete (ripple), speed presets, undo; Apply cut… (H.264 / ProRes) | ffmpeg (`vidfx cut`) |
| **design** (L2, later) | | an SVG or image with anchors; the Animation Script for the website | | |

The standalone June annotator (vector demo, image) remains at `?mode=vector` / `?mode=image` for the repo's own
docs; it is not part of the suite's IA.

## Files of truth

`projects/<name>/project.json` (media, shots, animations, cut lists), `shots/<shot>.yaml` (effects, edited through
`vidfx effects`), `work/<shot>/anchors.json` (motion trackers, beats; schema v2 with bezier handles),
`animations/<anim>/props.json`, `media/` (copied in; ⛓ linked stays where it is), `creative/library/`.
