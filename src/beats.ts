/** Beats = named timeline markers (tranche 4). Pure helpers; the engine's vidfx/beats.py mirrors them. */

export type BeatRow = { n: string; t: number; lane: string; motion: string; target: string; meaning: string }
export type Held = { lane: string; from: string; to: string }
export type Beats = { lanes: string[]; rows: BeatRow[]; held: Held[] }
export type Meta = { intent?: string; surface?: string; status?: string; loop?: number; updated?: string }

export const emptyBeats = (): Beats => ({ lanes: [], rows: [], held: [] })

/** Rows sorted by t then name, with Δ since the previous row. */
export function rowsWithDelta(b: Beats): (BeatRow & { delta: number })[] {
  const rows = [...b.rows].sort((a, c) => a.t - c.t || a.n.localeCompare(c.n, undefined, { numeric: true }))
  let prev: number | null = null
  return rows.map((r) => { const delta = prev === null ? 0 : +(r.t - prev).toFixed(3); prev = r.t; return { ...r, delta } })
}

/** Per sorted row, one cell per lane: '●' fires, '│' held open, '' idle. */
export function swimlanes(b: Beats): { lanes: string[]; rows: (BeatRow & { delta: number })[]; cells: string[][] } {
  const lanes = b.lanes.length ? b.lanes : [...new Set(b.rows.map((r) => r.lane).filter(Boolean))]
  const rows = rowsWithDelta(b); const names = rows.map((r) => r.n)
  const cells = rows.map((r, i) => lanes.map((lane) => {
    if (r.lane === lane) return '●'
    for (const h of b.held) {
      if (h.lane !== lane) continue
      const a = names.indexOf(h.from), z = names.indexOf(h.to)
      if (a >= 0 && z >= 0 && a < i && i < z) return '│'
    }
    return ''
  }))
  return { lanes, rows, cells }
}

/** Next free beat name: "1", "2", … (sub-beats are typed by hand: "3b"). */
export function nextBeatName(b: Beats): string {
  const nums = b.rows.map((r) => parseInt(r.n, 10)).filter((n) => !Number.isNaN(n))
  return String((nums.length ? Math.max(...nums) : 0) + 1)
}

/** Add a marker at t (seconds) on a lane, targeting a motion tracker. Returns the new row's name. */
export function markBeat(b: Beats, t: number, lane: string, target: string): { beats: Beats; name: string } {
  const name = nextBeatName(b)
  const row: BeatRow = { n: name, t: +t.toFixed(3), lane, motion: '', target, meaning: '' }
  return { beats: { ...b, lanes: b.lanes.includes(lane) || !lane ? b.lanes : [...b.lanes, lane], rows: [...b.rows, row] }, name }
}

/** Resolve a GSAP-style time expression against the beats (mirror of vidfx.beats.resolve_time). */
export function resolveTime(expr: string | number, b: Beats, prev?: [number, number]): number {
  if (typeof expr === 'number') return expr
  const s = expr.trim()
  const named = b.rows.find((x) => x.n === s); if (named) return named.t        // a quoted name wins over a numeric reading
  const asNum = Number(s); if (!Number.isNaN(asNum) && s !== '') return asNum
  const m = /^([<>]|[A-Za-z0-9_.-]+)(?:([+-]=)([0-9.]+))?$/.exec(s)
  if (!m) throw new Error(`bad time expression ${expr}`)
  let base: number
  if (m[1] === '<' || m[1] === '>') { if (!prev) throw new Error(`${expr}: no previous effect`); base = m[1] === '<' ? prev[0] : prev[1] }
  else { const r = b.rows.find((x) => x.n === m[1]); if (!r) throw new Error(`${expr}: no beat named ${m[1]}`); base = r.t }
  if (m[2]) base += Number(m[3]) * (m[2] === '+=' ? 1 : -1)
  return base
}
