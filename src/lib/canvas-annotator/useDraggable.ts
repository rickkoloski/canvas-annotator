import { useCallback, useRef, useState } from 'react'

/**
 * Pointer-based drag for a fixed-position element. Attach `handleProps` to the
 * drag handle (e.g. a panel header); read `pos` for `left`/`top`. Position is
 * clamped to stay on-screen so a panel can't be lost off an edge.
 */
export function useDraggable(initial: { x: number; y: number }) {
  const [pos, setPos] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const offset = useRef<{ dx: number; dy: number } | null>(null)

  const clamp = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x, window.innerWidth - 64)),
    y: Math.max(8, Math.min(y, window.innerHeight - 48)),
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // don't start a drag from an interactive control inside the handle
      if ((e.target as HTMLElement).closest('button,input,a')) return
      offset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [pos],
  )
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!offset.current) return
    setPos(clamp(e.clientX - offset.current.dx, e.clientY - offset.current.dy))
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    offset.current = null
    setDragging(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  return {
    pos,
    setPos,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      style: { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' as const },
    },
  }
}
