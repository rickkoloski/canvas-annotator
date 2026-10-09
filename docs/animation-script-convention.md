# Animation Script convention

How we capture and share a motion design in this project: as a single markdown
**Animation Script**. One readable doc — authored and reviewed in md-editor —
that anyone, human or agent, can read to understand, review, or rebuild an
animation.

Established 2026-06-14. Canonical example:
[`../animation-scripts/orrery-progress-tracking-memory-loop.md`](../animation-scripts/orrery-progress-tracking-memory-loop.md).

## Why a doc, not a tool

GSAP is deliberately **code-first** — there is no canonical commercial GUI
editor for it. The closest options are GSDevTools (a runtime *scrubber* /
debugger, not an authoring tool), Theatre.js (editor-first, often paired *with*
GSAP), and Webflow's 2025 native GSAP integration (only inside Webflow). So
rather than reach for a tool that doesn't exist, we describe motion in a doc
that pairs with our **own** tools: the canvas-annotator (authoring anchors)
upstream, and GSDevTools-style timeline-seek for verification.

## Sections

A script has five sections plus a Decision log:

1. **Meta** — canvas (svg + viewBox), surface, status (`draft`/`live`/`retired`),
   loop length, scope, rules, source file, updated date.
2. **Intent** — one paragraph: what the motion *means*.
3. **Anchors** — named shapes in canvas (viewBox) units. Paste the
   **canvas-annotator** "copy all" output verbatim (the `{ kind: … }` literals),
   then a small table of the Figma layer ids the animation drives. The
   annotator's output *is* this section — draw → script with zero transcription.
4. **Beats** — the timeline, as a table (see below).
5. **Notes** — implementation gotchas, gating flags, rules-in-practice.
6. **Decision log** — `Date | Decision | Decided by`, each row self-contained
   with the alternative considered. Review decisions land here.

## The Beats table

One row per beat. Columns:

| col | meaning |
| --- | --- |
| **#** | beat number (`7b` etc. for a sub-beat at the same instant) |
| **Δ** | seconds since the previous beat — "how long after the last thing" |
| **t** | cumulative seconds from loop start (at speed = 1) — "where in the loop" |
| **\<lanes\>** | one narrow column per concurrent **thread**: `●` fires here, `│` held open across the row, blank = idle |
| **motion** | how it moves (property + duration) |
| **target** | the anchor / layer id it acts on |
| **meaning** | the narrative beat |

Carry **both** Δ and t — they answer different questions, and a reader wants
each at a glance.

The lane columns are a **swimlane** — the standard, simple way to show
concurrency: read a row across to see what runs at once, and a `│` lane held
across rows is something that stays active while other lanes fire (e.g. shared
memory held open while the sparkle re-lights, the dot travels, and the app
lights again). Keep lanes to the few real tracks; split finer only when it earns
its keep.

## Sharing & review (md-editor)

Scripts are authored and reviewed in **md-editor** (`~/src/apps/md-editor-mac`):
open via its CLI, it live-renders and watches external edits. Mark review points
inline — `**Question:**`, `**Decision:**`, `**Assumption:**`, `**Bug:**` (one
per line, self-contained). The reviewer annotates with `rak:` notes and hits
**Submit**; resolved items move into the **Decision log** and the inline marker
is cleared in the same edit.

## Where scripts live

`docs/animation-scripts/<script-id>.md` — one file per animation.

## Template

````md
# Animation Script — <Surface>: <Name>

- **Canvas:** `<file.svg>` (viewBox `…`)
- **Surface:** …
- **Status:** draft | live | retired
- **Loop:** …s
- **Scope:** …
- **Rules:** …
- **Source:** `…` · **Updated:** YYYY-MM-DD

## Intent
<one paragraph: what the motion means>

## Anchors
```ts
<paste canvas-annotator "copy all" here>
```
| layer id | role |
| --- | --- |
| … | … |

## Beats
| # | Δ | t | <lane> | <lane> | motion | target | meaning |
| --- | --: | --: | :-: | :-: | --- | --- | --- |
| 1 | 0 | 0 | ● |   | … | … | … |

## Notes
- …

## Decision log
_(none yet)_
````
