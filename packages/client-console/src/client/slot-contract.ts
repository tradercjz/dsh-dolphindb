/**
 * The `main` and `sidebar.panellist` slot types as this package consumes
 * them — a full-page panel keyed by panel id, paired with its sidebar
 * navigation icon under the same id. Both slots are DECLARED at runtime by
 * the shell (ui-layout's root entry declares `main`; ui-sidebar's sidebar
 * entry declares `sidebar.panellist`); this merge only re-states the
 * contracts so this package compiles without a cross-plugin value import.
 * The sidebar owns the row's button, selection, and label — the icon entry
 * is purely presentational.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Central panel selected by sidebar entry id (see module JSDoc). */
    'main': { kind: 'keyed'; scope: 'root' }
    /** Global panel icons; each list id addresses the matching main panel. */
    'sidebar.panellist': { kind: 'list'; scope: 'root'; owner: SidebarPanelIconOwnerProps }
  }
}

/** Icon presentation supplied by the sidebar's global panel row. */
export interface SidebarPanelIconOwnerProps {
  /** Requested square edge in pixels. */
  size: number
  /** Whether this panel is selected in the main column. */
  active: boolean
}
