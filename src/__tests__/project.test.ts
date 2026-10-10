import { describe, it, expect } from 'vitest'
import { bridgePaths, emptyProject, validateProject, touch } from '../project'

describe('project.json (A1)', () => {
  it('emptyProject has the v1 shape and the canvas given', () => {
    const p = emptyProject('laptop-demo', { width: 1920, height: 1080, fps: 25 }, new Date('2026-10-10T18:00:00Z'))
    expect(p).toMatchObject({ version: 1, name: 'laptop-demo', created: '2026-10-10T18:00:00.000Z', media: [], shots: [] })
    expect(validateProject(p)).toEqual(p)
  })
  it('validateProject rejects what it cannot open', () => {
    expect(() => validateProject(null)).toThrow()
    expect(() => validateProject({ version: 2, name: 'x', canvas: { width: 1, height: 1, fps: 1 } })).toThrow(/version/)
    expect(() => validateProject({ version: 1, name: '../x', canvas: { width: 1, height: 1, fps: 1 } })).toThrow(/name/)
    expect(() => validateProject({ version: 1, name: 'x', canvas: { width: 1920 } })).toThrow(/canvas/)
    expect(validateProject({ version: 1, name: 'x', canvas: { width: 1, height: 1, fps: 1 } }).media).toEqual([])
  })
  it('touch bumps modified only', () => {
    const p = emptyProject('x'); const q = touch(p, new Date('2030-01-01T00:00:00Z'))
    expect(q.modified).toBe('2030-01-01T00:00:00.000Z'); expect(q.created).toBe(p.created)
  })
  it('bridgePaths: legacy mounts without a project, project-relative with one', () => {
    const l = bridgePaths(null)
    expect(l.work('s')).toBe('/work/s'); expect(l.shots).toBe('/shots'); expect(l.renders).toBe('/renders')
    const p = bridgePaths('laptop-demo')
    expect(p.work('s')).toBe('/projects/laptop-demo/work/s'); expect(p.shots).toBe('/projects/laptop-demo/shots')
    expect(p.renders).toBe('/projects/laptop-demo/renders'); expect(p.projectJson).toBe('/projects/laptop-demo/project.json')
  })
})

import { pushRecent, withShot, pageUrl } from '../project'
import { dirtyKey } from '../FramesMode'
import { emptyBeats } from '../beats'

describe('app frame A2 helpers', () => {
  it('pushRecent puts the name first, dedupes, keeps five', () => {
    expect(pushRecent(['a', 'b'], 'b')).toEqual(['b', 'a'])
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd'])
  })
  it('withShot records the shot once and the view', () => {
    const p = withShot(emptyProject('x'), 's1', 'beats')
    expect(p.shots).toEqual(['s1']); expect(p.recent).toEqual({ shot: 's1', view: 'beats' })
    expect(withShot(p, 's1').shots).toEqual(['s1'])
  })
  it('pageUrl builds the query', () => {
    expect(pageUrl(null)).toBe('/'); expect(pageUrl('p')).toBe('/?project=p'); expect(pageUrl('p', 's', 'beats')).toBe('/?project=p&shot=s&view=beats'); expect(pageUrl(null, 's', 'frames')).toBe('/?shot=s')
  })
  it('dirtyKey ignores UI-only fields and changes with content', () => {
    const a = dirtyKey([{ kind: 'circle', id: 'c', label: 'c', x: 1, y: 2, r: 3, wip: true, color: '#fff' }], emptyBeats(), {}, [], [])
    const b = dirtyKey([{ kind: 'circle', id: 'c', label: 'c', x: 1, y: 2, r: 3 }], emptyBeats(), {}, [], [])
    const c = dirtyKey([{ kind: 'circle', id: 'c', label: 'c', x: 1, y: 9, r: 3 }], emptyBeats(), {}, [], [])
    expect(a).toBe(b); expect(c).not.toBe(b)
  })
})
