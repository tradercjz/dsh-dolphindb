/**
 * DolphinDB cluster console, browser half — a full-page main panel paired
 * with a sidebar navigation icon under the `dolphindb-cluster` panel id.
 * The panel talks to the Host's `dolphindbConsole` service through the
 * hand-written Typert Remote contribution mounted here; the controller owns
 * polling, selection, and node operations, and the slots pair is registered
 * directly because the shell declares both seats unconditionally.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.remote merge.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import TYPERT_REMOTE from './contribution.ts'
import { ClusterConsoleController } from './controller.ts'
import { ClusterPanel } from './ClusterPanel.tsx'
import { SidebarIcon } from './SidebarIcon.tsx'
import { en, zh } from './locales.ts'
import type {} from './slot-contract.ts'

export { TYPERT_REMOTE } from './contribution.ts'
export type { DolphinDbConsoleRemote } from './contribution.ts'
export type { ClusterPanelProps } from './ClusterPanel.tsx'
export type {
  ClusterActionReceipt, ClusterConsoleFace, ClusterConsoleState, ClusterPerfCell, ClusterPerfRow,
} from './controller.ts'
export type { ClusterConsoleLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'dolphindb.console'

/** Main panel key and sidebar panellist id of the cluster console. */
const PANEL_ID = 'dolphindb-cluster'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the console's Remote contribution, controller, dictionaries, and the
 * main/sidebar slot pair.
 * @param ctx - the browser plugin context.
 * @returns disposer withdrawing the Remote namespace (slot registrations and
 * effects unwind with the fiber).
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'console: dictionaries')

  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  try {
    const t = ctx.locale.bind(NS)
    const controller = new ClusterConsoleController(ctx)
    ctx.effect(() => () => { controller.dispose() }, 'console: polling')

    ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
      inject: () => controller.inject(),
    }, ClusterPanel)
    ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: () => t('panelLabel'),
    }, SidebarIcon)
  } catch (error) {
    await disposeRemote()
    throw error
  }
  return async () => { await disposeRemote() }
}
