/**
 * The script console's sidebar navigation icon: a code glyph — angle
 * brackets flanking a cursor stroke. The sidebar owns the row's button,
 * label, and selection — this entry is the glyph only, colored by the row
 * through currentColor.
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './slot-contract.ts'

/**
 * Render the code glyph at the row's requested size.
 * @param props - panellist owner share: pixel size and the panel's active flag.
 * @returns the inline SVG (aria-hidden; the row's label names it).
 */
export function ScriptIcon({ size, active }: PropsRuntime<'sidebar.panellist'>) {
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
        d="M5.6 4.8 2.4 8l3.2 3.2M10.4 4.8 13.6 8l-3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.9 3.4 7.1 12.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity={active ? 1 : 0.45}
      />
    </svg>
  )
}
