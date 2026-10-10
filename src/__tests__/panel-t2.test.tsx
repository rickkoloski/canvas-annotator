import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { AnnotatorPanel, useShapePicker, type CanvasShape, type CanvasSpace } from '../lib/canvas-annotator'

const space: CanvasSpace = { getSvg: () => null, screenToCanvas: (x, y) => ({ x, y }), pxToCanvas: (px) => px, unit: () => 1, mountOverlay: () => null }
const poly = (id: string, frame: number): CanvasShape => ({ kind: 'polygon', id, label: id, frame, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] })
const circ = (id: string, frame: number): CanvasShape => ({ kind: 'circle', id, label: id, frame, x: 0, y: 0, r: 1 })

function Host({ onJumpFrame, onSelectTracker, selected }: { onJumpFrame?: (f: number) => void; onSelectTracker?: (id: string) => void; selected?: string }) {
  const picker = useShapePicker({ space, enabled: true, frame: 0 })
  useEffect(() => { picker.loadSaved([poly('monitor', 0), poly('monitor', 124), circ('head', 62)]) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return <AnnotatorPanel picker={picker} onJumpFrame={onJumpFrame} onSelectTracker={onSelectTracker} selectedTracker={selected} />
}

afterEach(cleanup)

describe('T2: clicks on the tracker tree', () => {
  it('a keyframe row jumps to its frame', () => {
    const jump = vi.fn()
    render(<Host onJumpFrame={jump} />)
    fireEvent.click(screen.getByTestId('saved-jump-1'))
    expect(jump).toHaveBeenCalledWith(124)
  })
  it('a tracker name selects it and shows as selected', () => {
    const sel = vi.fn()
    render(<Host onSelectTracker={sel} selected="monitor" />)
    fireEvent.click(screen.getByTestId('tracker-name-head'))
    expect(sel).toHaveBeenCalledWith('head')
    expect(screen.getByTestId('tracker-name-monitor').textContent).toMatch(/^▸ /)
    expect(screen.getByTestId('tracker-name-head').textContent).not.toMatch(/^▸ /)
  })
  it('without handlers the names are inert', () => {
    render(<Host />)
    expect((screen.getByTestId('saved-jump-0') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('tracker-name-head') as HTMLButtonElement).disabled).toBe(true)
  })
})
