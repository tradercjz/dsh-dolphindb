/**
 * The cluster console's sidebar navigation icon: three node dots joined by
 * edges. The sidebar owns the row's button, label, and selection — this
 * entry is the glyph only, colored by the row through currentColor.
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './slot-contract.ts'

/**
 * Render the cluster glyph at the row's requested size.
 * @param props - panellist owner share: pixel size and the panel's active flag.
 * @returns the inline SVG (aria-hidden; the row's label names it).
 */
export function SidebarIcon({ size, active }: PropsRuntime<'sidebar.panellist'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      data-active={active || undefined}
    >
      <path
        d="M4.6 5.2 11 4.1M5.4 10.4l5.4-4.4M5.3 11.5l5.5.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="4" cy="7.6" r="2.1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.2" cy="3.6" r="2.1" stroke="currentColor" strokeWidth="1.2" fill={active ? 'currentColor' : 'none'} />
      <circle cx="12" cy="12.4" r="2.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
