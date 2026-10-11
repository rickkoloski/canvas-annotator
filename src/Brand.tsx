import { useEffect, useState } from 'react'

/**
 * The PortableMind mark (from the main app), inlined so its fills follow `currentColor`: light on the dark theme, the
 * brand's dark blue on a light one, through the page's text tokens (Rick, 2026-10-11: "recolor the logo with currentColor").
 */
export function BrandMark({ className = '' }: { className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => { fetch('/brand/pm-mark.svg').then((r) => (r.ok ? r.text() : '')).then(setSvg).catch(() => setSvg('')) }, [])
  return <span data-testid="brand-mark" className={`inline-block text-ws-text-primary ${className}`} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" />
}
