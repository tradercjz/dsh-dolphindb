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
import { DataBrowserController } from './data-controller.ts'
import { DataPanel } from './DataPanel.tsx'
import { DataIcon } from './DataIcon.tsx'
import { ScriptConsoleController } from './script-controller.ts'
import { ScriptPanel } from './ScriptPanel.tsx'
import { ScriptIcon } from './ScriptIcon.tsx'
import { en, zh } from './locales.ts'
import { en as dataEn, zh as dataZh } from './data-locales.ts'
import { en as scriptEn, zh as scriptZh } from './script-locales.ts'
import type {} from './slot-contract.ts'

export { TYPERT_REMOTE } from './contribution.ts'
export type { DolphinDbConsoleRemote } from './contribution.ts'
export type { ClusterPanelProps } from './ClusterPanel.tsx'
export type {
  ClusterActionReceipt, ClusterConsoleFace, ClusterConsoleState, ClusterPerfCell, ClusterPerfRow,
} from './controller.ts'
export type { ClusterConsoleLocaleKey } from './locales.ts'
export type { DataPanelProps } from './DataPanel.tsx'
export type {
  CatalogState, DataBrowserFace, DataBrowserState, DataCell, DataRow, PageState, SchemaState, TableSelection,
} from './data-controller.ts'
export { PAGE_SIZES } from './data-controller.ts'
export type { DataBrowserLocaleKey } from './data-locales.ts'
export type { ScriptPanelProps } from './ScriptPanel.tsx'
export type { ScriptCell, ScriptConsoleFace, ScriptConsoleState, ScriptRow, ScriptRunState } from './script-controller.ts'
export type { ScriptConsoleLocaleKey } from './script-locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'dolphindb.console'

/** Main panel key and sidebar panellist id of the cluster console. */
const PANEL_ID = 'dolphindb-cluster'

/** Dictionary namespace of the data browser panel. */
const DATA_NS = 'dolphindb.data'

/** Main panel key and sidebar panellist id of the data browser. */
const DATA_PANEL_ID = 'dolphindb-data'

/** Dictionary namespace of the script console panel. */
const SCRIPT_NS = 'dolphindb.script'

/** Main panel key and sidebar panellist id of the script console. */
const SCRIPT_PANEL_ID = 'dolphindb-script'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the console's Remote contribution, then activate the UI once the
 * mounted namespace service exists. The static inject cannot name
 * `remote.dolphindbConsole` — it only exists after the $mount below — so the
 * UI half runs in a dynamic inject fiber, the same arrangement the shipped
 * out-of-assembly Remote packages use.
 * @param ctx - the browser plugin context.
 * @returns disposer withdrawing the UI fiber and the Remote namespace.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  const ui = ctx.inject(['slots', 'locale', 'remote.dolphindbConsole'], registerUi)
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await disposeRemote()
  }
}

/** Register dictionaries, the panel controllers, and the main/sidebar slot pairs. */
function registerUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'console: dictionaries')
  ctx.effect(() => ctx.locale.register(DATA_NS, { zh: dataZh, en: dataEn }), 'data: dictionaries')
  ctx.effect(() => ctx.locale.register(SCRIPT_NS, { zh: scriptZh, en: scriptEn }), 'script: dictionaries')

  const t = ctx.locale.bind(NS)
  const controller = new ClusterConsoleController(ctx)
  ctx.effect(() => () => { controller.dispose() }, 'console: polling')
  const dataT = ctx.locale.bind(DATA_NS)
  const dataController = new DataBrowserController(ctx)
  ctx.effect(() => () => { dataController.dispose() }, 'data: loading')
  const scriptT = ctx.locale.bind(SCRIPT_NS)
  const scriptController = new ScriptConsoleController(ctx)
  ctx.effect(() => () => { scriptController.dispose() }, 'script: runs')

  // The shell declares both seats from its own activation path; inject waits
  // for each declaration instead of racing the boot order.
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => controller.inject(),
  }, ClusterPanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('panelLabel'),
  }, SidebarIcon))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: DATA_PANEL_ID,
    locale: DATA_NS,
    inject: () => dataController.inject(),
  }, DataPanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: DATA_PANEL_ID,
    order: 21,
    label: () => dataT('panelLabel'),
  }, DataIcon))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: SCRIPT_PANEL_ID,
    locale: SCRIPT_NS,
    inject: () => scriptController.inject(),
  }, ScriptPanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: SCRIPT_PANEL_ID,
    order: 22,
    label: () => scriptT('panelLabel'),
  }, ScriptIcon))
}
