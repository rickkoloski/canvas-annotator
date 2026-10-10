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
