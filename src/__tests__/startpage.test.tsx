import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProjectHome, Welcome, APP_NAME } from '../StartPage'
import { emptyProject } from '../project'

afterEach(cleanup)
describe('start page (P3)', () => {
  it('welcome shows the suite name and the two actions', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    render(<Welcome onNew={() => {}} onOpen={() => {}} />)
    expect(screen.getByTestId('start-welcome').textContent).toContain(APP_NAME)
    expect(screen.getByTestId('welcome-new')).toBeTruthy(); expect(screen.getByTestId('welcome-open')).toBeTruthy()
  })
  it('project home lists shots and animations as cards', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    const p = { ...emptyProject('demo'), shots: ['a', 'b'], animations: ['intro'] }
    render(<ProjectHome project={p} onNewShot={() => {}} onNewAnimation={() => {}} />)
    expect(screen.getByTestId('home-shot-a').getAttribute('href')).toBe('/?project=demo&shot=a')
    expect(screen.getByTestId('home-anim-intro').getAttribute('href')).toBe('/?project=demo&anim=intro')
    expect(screen.getByTestId('home-new-shot')).toBeTruthy()
  })
})
