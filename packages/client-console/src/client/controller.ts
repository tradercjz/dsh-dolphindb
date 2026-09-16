/**
 * The cluster console's polling controller over the `dolphindbConsole`
 * Remote namespace. One snapshot store carries the last good overview, the
 * current selection, and the in-flight operation; the panel renders nothing
 * the controller did not publish.
 *
 * Polling is bound to the store's own subscription ledger: the first
 * subscriber (the mounted panel) starts the 10s loop with an immediate
 * refresh, the last unsubscribe stops it, and dispose() covers a teardown
 * that races an open panel. A failed poll keeps the last successful
 * overview and surfaces only the error line — the table a user is about to
 * act on never blanks out under a transient failure. Node operations clear
 * the selection on settle and force an out-of-turn refresh, so the table
 * converges on the controller's answer without waiting for the next tick.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program. Cross-plugin
// collaboration goes through the service, never a value import.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ClusterOverview, NodeOperationResult } from '@tradercjz/dsh-dolphindb/console'
// Type-only: pulls the dolphindbConsole TypertRemoteNamespaceMap merge in.
import type {} from './contribution.ts'

/** Overview poll cadence while the panel is mounted. */
const POLL_INTERVAL_MS = 10_000

/** One getClusterPerf row, as the overview carries it. */
export type ClusterPerfRow = ClusterOverview['rows'][number]

/** One cell of a perf row. */
export type ClusterPerfCell = ClusterPerfRow[number]

/**
 * Read one named cell of a perf row.
 * @param overview - the perf snapshot whose columns name the cells.
 * @param row - one row of that snapshot.
 * @param column - the getClusterPerf column name.
 * @returns the cell, or undefined when the deployment's table lacks the column.
 */
export function perfCell(overview: ClusterOverview, row: ClusterPerfRow, column: string): ClusterPerfCell | undefined {
  const index = overview.columns.indexOf(column)
  return index < 0 ? undefined : row[index]
}

/** Numeric mode cell of one row; undefined when absent or not numeric. */
export function perfMode(overview: ClusterOverview, row: ClusterPerfRow): number | undefined {
  const mode = Number(perfCell(overview, row, 'mode'))
  return Number.isFinite(mode) ? mode : undefined
}

/** A node the controller accepts start/stop for: data (0) or computing (4). */
export function nodeOperable(overview: ClusterOverview, row: ClusterPerfRow): boolean {
  const mode = perfMode(overview, row)
  return mode === 0 || mode === 4
}

/** The alias a row answers to (the `name` column), as node operations address it. */
export function nodeName(overview: ClusterOverview, row: ClusterPerfRow): string {
  const name = perfCell(overview, row, 'name')
  return name === undefined || name === null ? '' : String(name)
}

/** What the console last asked the controller to do, and how it answered. */
export type ClusterActionReceipt =
  | { readonly kind: 'start' | 'stop'; readonly ok: true; readonly result: NodeOperationResult }
  | { readonly kind: 'start' | 'stop'; readonly ok: false; readonly message: string }

/** What the cluster console renders. */
export interface ClusterConsoleState {
  /** 'loading' before the first settle, 'ready' once an overview landed, 'error' when none ever did. */
  status: 'loading' | 'ready' | 'error'
  /** The last successful overview; kept across later poll failures. */
  overview: ClusterOverview | undefined
  /** The last poll failure's message; undefined while polls succeed. */
  errorMessage: string | undefined
  /** Aliases of the operable rows the user checked. */
  selected: string[]
  /** Whether a start/stop request is crossing the wire. */
  operating: boolean
  /** The last operation's receipt; cleared by the next operation. */
  receipt: ClusterActionReceipt | undefined
  /** Date.now() of the last successful poll; undefined before the first. */
  updatedAt: number | undefined
}

/** The registration-side face the panel's slot entry injects. */
export interface ClusterConsoleFace {
  hooks: {
    /** Console snapshot bound by the renderer as useClusterConsole. */
    clusterConsole: SnapshotStore<ClusterConsoleState>
  }
  /** Poll the overview out of turn. */
  refresh: () => void
  /** Check or uncheck one operable node. */
  toggleSelect: (name: string) => void
  /** Drop the whole selection. */
  clearSelection: () => void
  /** Start the selected nodes through the controller. */
  startSelected: () => void
  /** Stop the selected nodes through the controller. */
  stopSelected: () => void
}

const INITIAL_STATE: ClusterConsoleState = {
  status: 'loading',
  overview: undefined,
  errorMessage: undefined,
  selected: [],
  operating: false,
  receipt: undefined,
  updatedAt: undefined,
}

/** Bridges the `dolphindbConsole` Remote namespace onto the panel. */
export class ClusterConsoleController {
  private readonly store: SnapshotStore<ClusterConsoleState>
  private subscribers = 0
  private timer: ReturnType<typeof setInterval> | undefined
  private generation = 0
  private inFlight = false
  private disposed = false

  /**
   * @param ctx - the panel plugin's context, whose `remote.dolphindbConsole`
   * namespace the mounted contribution supplies.
   */
  constructor(private readonly ctx: ClientContext) {
    const store = createSnapshotStore<ClusterConsoleState>({ ...INITIAL_STATE })
    const rawSubscribe = store.subscribe
    store.subscribe = (fn) => this.track(rawSubscribe, fn)
    this.store = store
  }

  /**
   * Build the face the panel's slot registration injects.
   * @returns the console snapshot and its actions.
   */
  inject(): ClusterConsoleFace {
    return {
      hooks: { clusterConsole: this.store },
      refresh: () => { void this.poll() },
      toggleSelect: (name) => { this.toggleSelect(name) },
      clearSelection: () => { this.clearSelection() },
      startSelected: () => { void this.operate('start') },
      stopSelected: () => { void this.operate('stop') },
    }
  }

  /** Stop polling for good; settles in flight keep their answers to themselves. */
  dispose(): void {
    this.disposed = true
    this.stopPolling()
  }

  /** Count one store subscriber; the first starts polling, the last stops it. */
  private track(rawSubscribe: SnapshotStore<ClusterConsoleState>['subscribe'], fn: () => void): () => void {
    this.subscribers += 1
    if (this.subscribers === 1 && !this.disposed) this.startPolling()
    const release = rawSubscribe(fn)
    let active = true
    return () => {
      if (!active) return
      active = false
      release()
      this.subscribers -= 1
      if (this.subscribers === 0) this.stopPolling()
    }
  }

  private startPolling(): void {
    if (this.timer !== undefined) return
    void this.poll()
    this.timer = setInterval(() => {
      // A tick that arrives while the previous poll is still out is dropped
      // rather than stacked; the next tick closes the gap.
      if (this.inFlight) return
      void this.poll()
    }, POLL_INTERVAL_MS)
  }

  private stopPolling(): void {
    if (this.timer === undefined) return
    clearInterval(this.timer)
    this.timer = undefined
  }

  /**
   * One overview poll. Out-of-order settles are dropped by generation: a
   * response is published only while it still answers for the read in force.
   */
  private async poll(): Promise<void> {
    if (this.disposed) return
    const generation = ++this.generation
    this.inFlight = true
    let result: Awaited<ReturnType<typeof this.ctx.remote.dolphindbConsole.overview>>
    try {
      result = await this.ctx.remote.dolphindbConsole.overview()
    } catch (error) {
      // A local throw (transport down, namespace withdrawn) is a poll failure
      // too; without this branch the loop would wedge with inFlight stuck set.
      this.inFlight = false
      if (this.disposed || generation !== this.generation) return
      this.store.update((draft) => {
        draft.status = draft.overview === undefined ? 'error' : 'ready'
        draft.errorMessage = error instanceof Error ? error.message : String(error)
      })
      return
    }
    this.inFlight = false
    if (this.disposed || generation !== this.generation) return
    if (result.ok) {
      const overview = result.value
      this.store.update((draft) => {
        draft.status = 'ready'
        draft.overview = overview
        draft.errorMessage = undefined
        draft.updatedAt = Date.now()
        draft.selected = draft.selected.filter(name =>
          overview.rows.some(row => nodeOperable(overview, row) && nodeName(overview, row) === name))
      })
    } else {
      this.store.update((draft) => {
        // With an earlier overview in hand the table stays and the banner
        // carries the failure; without one the panel is the error.
        draft.status = draft.overview === undefined ? 'error' : 'ready'
        draft.errorMessage = result.error.message
      })
    }
  }

  private toggleSelect(name: string): void {
    const { overview, selected } = this.store.getSnapshot()
    if (overview === undefined) return
    const row = overview.rows.find(candidate => nodeName(overview, candidate) === name)
    if (row === undefined || !nodeOperable(overview, row)) return
    this.store.update((draft) => {
      draft.selected = selected.includes(name)
        ? selected.filter(candidate => candidate !== name)
        : [...selected, name]
    })
  }

  private clearSelection(): void {
    if (this.store.getSnapshot().selected.length === 0) return
    this.store.update((draft) => {
      draft.selected = []
    })
  }

  /**
   * Run one node operation over the current selection. The receipt is read
   * back from the wire, never predicted: an accepted list is what the
   * controller acknowledged, a refusal keeps its message for the banner.
   * Settle clears the selection and forces a refresh.
   */
  private async operate(kind: 'start' | 'stop'): Promise<void> {
    const state = this.store.getSnapshot()
    const overview = state.overview
    if (state.operating || overview === undefined || !overview.clustered) return
    const nodes = state.selected.filter(name =>
      overview.rows.some(row => nodeOperable(overview, row) && nodeName(overview, row) === name))
    if (nodes.length === 0) return
    this.store.update((draft) => {
      draft.operating = true
      draft.receipt = undefined
    })
    const remote = this.ctx.remote.dolphindbConsole
    let result: Awaited<ReturnType<typeof remote.startNodes>>
    try {
      result = kind === 'start'
        ? await remote.startNodes({ nodes })
        : await remote.stopNodes({ nodes })
    } catch (error) {
      if (this.disposed) return
      this.store.update((draft) => {
        draft.operating = false
        draft.receipt = { kind, ok: false, message: error instanceof Error ? error.message : String(error) }
      })
      return
    }
    if (this.disposed) return
    this.store.update((draft) => {
      draft.operating = false
      draft.selected = []
      draft.receipt = result.ok
        ? { kind, ok: true, result: result.value }
        : { kind, ok: false, message: result.error.message }
    })
    await this.poll()
  }
}
