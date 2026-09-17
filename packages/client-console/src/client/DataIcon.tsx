/**
 * The data browser's sidebar navigation icon: a data-grid glyph — a framed
 * table with a header row and a mid rule. The sidebar owns the row's button,
 * label, and selection — this entry is the glyph only, colored by the row
 * through currentColor.
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './slot-contract.ts'

/**
 * Render the data-grid glyph at the row's requested size.
 * @param props - panellist owner share: pixel size and the panel's active flag.
 * @returns the inline SVG (aria-hidden; the row's label names it).
 */
export function DataIcon({ size, active }: PropsRuntime<'sidebar.panellist'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      data-active={active || undefined}
    >
      <rect x="2.4" y="2.6" width="11.2" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.4 6h11.2M2.4 9.8h11.2M8.2 6v7.4" stroke="currentColor" strokeWidth="1.2" />
      <rect
        x="3.6"
        y="3.55"
        width="3.4"
        height="1.1"
        rx="0.55"
        fill="currentColor"
        opacity={active ? 1 : 0.45}
      />
    </svg>
  )
}
