import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Select } from '../lib/ui/Select'

afterEach(cleanup)
describe('Select (Radix, walk 4 P2)', () => {
  it('shows the current label and carries data-value, including the empty value', () => {
    render(<Select testid="s" value="" onChange={() => {}} options={[{ value: '', label: '(none)' }, { value: 'a', label: 'Alpha' }]} />)
    const t = screen.getByTestId('s'); expect(t.getAttribute('data-value')).toBe(''); expect(t.textContent).toContain('(none)')
  })
  it('renders a known value with its label', () => {
    const on = vi.fn()
    render(<Select testid="s" value="a" onChange={on} options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} />)
    expect(screen.getByTestId('s').textContent).toContain('Alpha'); expect(screen.getByTestId('s').getAttribute('data-value')).toBe('a')
  })
})
