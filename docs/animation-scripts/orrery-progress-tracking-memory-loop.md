# Animation Script — Orrery: Progress-Tracking Memory Loop

> **Animation Script** is our convention for sharing a motion design as one
> readable markdown doc: **Meta · Intent · Anchors · Beats · Notes**. This is the
> first one, and it represents the Orrery's current animation exactly as it runs.

- **Canvas:** `knowledge-server.svg` (Figma frame 10:524, viewBox `0 0 3930 2549`)
- **Surface:** Orrery — homepage `WhatIs` section + `#/demos/orrery`
- **Status:** live
- **Loop:** ~7.6s (one play; at speed = 1)
- **Trigger:** **hover** the `Kanban wireframe` panel → play once (no auto-loop). Per-surface hover triggers to follow — see Notes.
- **Scope:** scripted for the **Kanban / Progress-Tracking** surface; the other three surfaces currently get the basic forward pulse only
- **Rules:** only-the-dot-moves · stay-put (opacity/radius, never scale) · happy-path-only · reduced-motion-safe · entrance-gates-pulse
- **Source:** `src/components/Orrery.tsx` · **Updated:** 2026-06-14

## Intent

Dramatize how the LLM, shared memory, and the work surfaces act as one system:
a thought forms → instructs an app → the app does the work → the result returns →
the LLM reaches into **shared memory** → an enriched result flows back. Every
surface orbits one source of truth.

## Anchors

Named shapes in canvas (viewBox) units. The memory overlays are authored with the
**canvas-annotator** (paste its "copy all" output straight in); the rest are Figma
layer ids addressed by name.

```ts
// shared-memory overlays — annotator output
{ kind: 'polygon', id: 'progress-area-1', label: 'shared memory region',
  points: [ {x:1552,y:1891}, {x:1652,y:1916}, {x:1817,y:1844}, {x:1738,y:1780}, {x:1663,y:1776} ] }
{ kind: 'circle',  id: 'planning-1', label: 'memory point ping', x: 1674, y: 1876, r: 11 }
```

| layer id | role |
| --- | --- |
| `Group 19` (big star `path3_2` ≈ 1957,1464) | green sparkle cluster — the "thought" |
| `Line 15` | connector ray, mind → Kanban (x1,y1 = mind; x2,y2 = app) |
| `Kanban wireframe` | the app surface that lights (also the hover target) |
| `Brown Card` (+ its icon) | the rust card that advances columns |
| `Rectangle 8 / 9 / 10` | To Do / In Progress / Done (column step ≈ +324) |
| `Brain` | raster knowledge core — recedes during memory access |

## Beats

One ~7.6s play (hover-triggered) at speed = 1. **Δ** = seconds since the previous
beat; **t** = cumulative seconds from start. The four lanes show which **thread**
is running — read a row across to see what happens concurrently (swimlane view).

The first three beats — thought → dot **rushes** → board lights — are packed into
the opening **0.6s** so the hover reads instantly as "something coming toward this
surface." After that: motions stay **rigid** (snappy), and the loop relaxes via
the **elastic** dwells — beat 4 (app working), beat 8 (memory holds), beat 11
(memory lingers).

**Threads:** **S** Sparkle (the thought) · **D** Dot (data in transit) · **A** App (Kanban) · **M** Memory (region + brain). &nbsp; **●** fires · **│** held open · blank = idle.

| # | Δ | t | S | D | A | M | motion (how) | target | meaning |
| --- | --: | --: | :-: | :-: | :-: | :-: | --- | --- | --- |
| 1 | 0.05 | 0.05 | ● |   |   |   | tint gold + halo grows | `Group 19` | thought forms (≈ on hover) |
| 2 | 0.18 | 0.23 |   | ● |   |   | travel mind → app (0.37s) | `Line 15` | rushes toward the board |
| 3 | 0.37 | 0.60 |   |   | ● |   | border lights (opacity) | `Kanban wireframe` | **board lit — "something arrived"** |
| 4 | 2.10 | 2.69 |   |   | ● |   | card In Progress → Done (0.26s) | `Brown Card` | **app does the work** (elastic) |
| 5 | 0.31 | 3.00 |   | ● |   |   | travel app → mind (0.37s) | `Line 15` | result returns |
| 6 | 0.37 | 3.37 | ● |   |   |   | sparkle re-lights | `Group 19` | LLM has the output |
| 7 | 0.16 | 3.53 |   |   |   | ● | region blooms + **STAYS** | `progress-area-1` | **LLM accesses shared memory** |
| 7b | 0.0 | 3.53 |   |   |   | ● | brain recedes → 0.45 (0.10s) | `Brain` | memory access = distinct event |
| 8 | 1.56 | 5.09 | ● |   |   | │ | sparkle re-lights | `Group 19` | **combining AI + memory** (elastic hold) |
| 9 | 0.16 | 5.25 |   | ● |   | │ | travel mind → app (0.37s) | `Line 15` | enriched result sent |
| 10 | 0.37 | 5.62 |   |   | ● | │ | border lights again | `Kanban wireframe` | app benefits from AI + memory |
| 11 | 1.45 | 7.07 |   |   |   | ● | region fades; brain → 1.0 (0.19s) | `progress-area-1`, `Brain` | **memory lingers, then releases** (elastic) |
| 12 | 0.26 | 7.33 |   |   | ● |   | card masked-fade reset | `Brown Card` | reset to start |

The **M** lane held open across beats 8–10 (│) is the key concurrency: the LLM keeps shared memory engaged while the sparkle re-lights, the dot travels, and the app lights again. The memory region is visible **t ≈ 3.53–7.07 (~3.5s)** — it **breathes** (fill 0.18 ↔ 0.30) and a perimeter dash **scans** it the whole time.

## Notes

- Every light-up is **opacity or radius** only — never `scale` (SVG transform-origin drift; "only the dot moves").
- The region starts invisible and is built **into** the pulse timeline so it can form mid-sequence and persist, rather than living in the separate memory-pulse layer.
- Brain dim is gated behind `AUDITION_DIM_BRAIN_ON_MEMORY` / `BRAIN_DIM_LEVEL = 0.45` in `Orrery.tsx` — flip the const to revert, change the level to tune.
- Timing constants in `Orrery.tsx`: `STORY_RATE` (pulse timeScale — keeps motions snappy); `INTRO_LEAD` (0.05s — sparkle ≈ on hover) + `INTRO_RUSH` (0.6s — the board lights by here; the dot is positioned to *arrive* at INTRO_RUSH); and `DWELL` (the elastic holds in REAL seconds, weighted to the memory STAYS). Motions are rigid; the opening rush is INTRO_*, and only `DWELL` stretches the back half.
- The entrance stages the whole scene in ~1s; the pulse then waits for a hover (`entrance-gates-pulse`).
- **Trigger:** the story plays **once on hover** of the `Kanban wireframe` panel — a transparent hit-rect over the panel is the hover target, parented into the panel group so it floats with it; gated on the entrance; a re-hover mid-play is ignored (the play finishes), and re-hover after it ends replays. No auto-loop. **Per-surface is next:** each major surface (Plans / Conversations / Files) gets its own story + the same hover wiring.
- `planning-1` is a continuous point-ping in the memory-pulse layer (breathes r 11 → 15); the **region** is the scripted memory event.

## Decision log

| Date | Decision | Decided by |
| --- | --- | --- |
| 2026-06-14 | Convention is five sections — Meta · Intent · Anchors · Beats · Notes (+ this log). Considered looser/fewer headings; rejected for losing the at-a-glance structure. | Rick |
| 2026-06-14 | Anchors stay as raw canvas-annotator paste (the `{ kind: … }` literals), not a normalized table — keeps draw → script zero-transcription. | Rick |
| 2026-06-14 | Beats carry both Δ (since prev) and t (cumulative), with concurrency shown as a four-lane swimlane (Sparkle / Dot / App / Memory). Considered finer lanes (card out of App, brain out of Memory); deferred until a beat needs it. | Rick |
| 2026-06-14 | First compressed the loop ~14.8s → ~5s (uniform `STORY_RATE` 3.087, opening held 0.4s). Verified at 5.0s — but too tight. | Rick |
| 2026-06-14 | Relaxed 5s → ~8s by stretching ONLY the elastic dwells (app-working + memory STAYS), motions kept snappy; +3s weighted to memory. `DWELL` constants. Verified at 8.0s. | Rick |
| 2026-06-14 | Trigger: play once on **hover of the Kanban panel** (was continuous auto-loop). Play-once; playground = hover-to-play. Per-surface to follow. Verified: paused until hover, plays on mouseenter. | Rick |
| 2026-06-14 | Opening pacing: pack the first three beats (thought → rush → board) into ~0.6s so the hover reads instantly as "coming toward this surface." `INTRO_LEAD` 0.05 + `INTRO_RUSH` 0.6; dot positioned to arrive at 0.6s. Loop consequently ~7.6s (down from 8.0). Verified: sparkle 0.08s, board 0.6s, loop 7.58s. | Rick |
