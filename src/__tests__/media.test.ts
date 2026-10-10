import { describe, it, expect } from 'vitest'
import { extMime, mediaKind, sortMedia, svgSize, usageFromShots, fmtDuration, fmtSize } from '../media'
import type { MediaItem } from '../project'

const m = (id: string, type: string, added: string, size = 0): MediaItem => ({ id, file: `media/${id}`, type, added, size })

describe('media bin helpers (A3)', () => {
  it('mime from extension, kind from mime', () => {
    expect(extMime('Laptop.SVG')).toBe('image/svg+xml'); expect(extMime('clip.mov')).toBe('video/quicktime'); expect(extMime('x.unknown')).toBe('application/octet-stream')
    expect(mediaKind('image/png')).toBe('image'); expect(mediaKind('video/mp4')).toBe('video'); expect(mediaKind('application/json')).toBe('other')
  })
  it('svgSize from width/height or viewBox', () => {
    expect(svgSize('<svg xmlns="x" width="1600" height="1000" viewBox="0 0 1600 1000">')).toEqual({ width: 1600, height: 1000 })
    expect(svgSize('<svg viewBox="0 0 320 180"></svg>')).toEqual({ width: 320, height: 180 })
    expect(svgSize('<svg width="100%" height="100%"></svg>')).toBeNull(); expect(svgSize('not svg')).toBeNull()
  })
  it('sortMedia by name/type/date/size either way', () => {
    const items = [m('b.png', 'image/png', '2026-01-02', 10), m('a.mov', 'video/quicktime', '2026-01-01', 300), m('c.svg', 'image/svg+xml', '2026-01-03', 1)]
    expect(sortMedia(items, 'name', 'asc').map((x) => x.id)).toEqual(['a.mov', 'b.png', 'c.svg'])
    expect(sortMedia(items, 'type', 'asc').map((x) => x.id)).toEqual(['b.png', 'c.svg', 'a.mov'])
    expect(sortMedia(items, 'date', 'desc').map((x) => x.id)).toEqual(['c.svg', 'b.png', 'a.mov'])
    expect(sortMedia(items, 'size', 'desc').map((x) => x.id)).toEqual(['a.mov', 'b.png', 'c.svg'])
  })
  it('usageFromShots finds the basename in shot files', () => {
    const items = [m('rec.mp4', 'video/mp4', '2026-01-01'), { ...m('clip.mov', 'video/quicktime', '2026-01-01'), file: '/abs/path/clip.mov' }, m('laptop.svg', 'image/svg+xml', '2026-01-01')]
    const u = usageFromShots(items, [{ name: 's1', text: 'source: /abs/path/clip.mov\neffects:\n  - ui: ../media/rec.mp4' }, { name: 's2', text: 'source: other.mov' }])
    expect(u).toEqual({ 'rec.mp4': ['s1'], 'clip.mov': ['s1'], 'laptop.svg': [] })
  })
  it('formats', () => { expect(fmtDuration(75.2)).toBe('1:15.2'); expect(fmtSize(144 * 1048576)).toBe('144.0 MB'); expect(fmtSize(603)).toBe('603 B') })
})
