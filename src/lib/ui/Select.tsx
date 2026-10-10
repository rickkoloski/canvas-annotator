import * as RS from '@radix-ui/react-select'

/**
 * The page's one dropdown (walk 4 P2, Rick 2026-10-10): Radix Select, unstyled primitive, dressed in the ws- tokens.
 * The list renders in the page (a portal), so it is styled and anchored to the trigger; the native <select>'s
 * OS-drawn list was not. Keyboard and screen-reader behaviour come from Radix (WAI-ARIA listbox).
 *
 * API mirrors what the native selects did: `value` / `onChange(value)` with plain strings; '' is allowed as a
 * value (mapped to a sentinel, since Radix forbids empty item values). The trigger carries data-testid and
 * data-value; options carry `${testid}-opt-${value}` so the walk driver can pick them.
 */
export type Option = { value: string; label: string; disabled?: boolean }
const NONE = '__none__'
const enc = (v: string) => (v === '' ? NONE : v)
const dec = (v: string) => (v === NONE ? '' : v)

export function Select({ value, onChange, options, testid, disabled, className = '', title, ariaLabel, placeholder }: {
  value: string; onChange: (value: string) => void; options: Option[]
  testid?: string; disabled?: boolean; className?: string; title?: string; ariaLabel?: string; placeholder?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <RS.Root value={enc(value)} onValueChange={(v) => onChange(dec(v))} disabled={disabled}>
      <RS.Trigger data-testid={testid} data-value={value} title={title} aria-label={ariaLabel}
        className={`ann-btn inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-40 data-[state=open]:border-ws-terracotta ${className}`}>
        <RS.Value placeholder={placeholder ?? ''}>{current ? current.label : (placeholder ?? value)}</RS.Value>
        <RS.Icon className="text-ws-text-tertiary text-[0.6rem]">▾</RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content position="popper" sideOffset={4} className="glass z-[90] rounded-xl py-1 shadow-2xl min-w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)] overflow-hidden">
          <RS.Viewport>
            {options.map((o) => (
              <RS.Item key={o.value} value={enc(o.value)} disabled={o.disabled} data-testid={testid ? `${testid}-opt-${o.value || 'none'}` : undefined}
                className="relative flex items-center gap-2 pl-6 pr-3 py-1.5 font-ws-mono text-xs text-ws-text-primary cursor-pointer outline-none select-none data-[highlighted]:bg-[rgba(224,155,88,.18)] data-[disabled]:opacity-40 data-[disabled]:cursor-default">
                <RS.ItemIndicator className="absolute left-2 text-ws-terracotta-text">✓</RS.ItemIndicator>
                <RS.ItemText>{o.label}</RS.ItemText>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
