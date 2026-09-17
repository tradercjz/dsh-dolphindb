/**
 * The script console's controller over the `dolphindbConsole` Remote
 * namespace. The store carries only the last run's outcome — the editor's
 * text lives in the CodeMirror component, not here, so typing never
 * republishes the panel. A run publishes while it is the latest request;
 * a superseded run's settle is dropped by counter, and a failed run keeps
 * the previous result under the error banner.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program. Cross-plugin
// collaboration goes through the service, never a value import.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ScriptRunResult } from '@tradercjz/dsh-dolphindb/console'
// Type-only: pulls the dolphindbConsole TypertRemoteNamespaceMap merge in.
import type {} from './contribution.ts'

/** One row of a script result projection. */
export type ScriptRow = ScriptRunResult['rows'][number]

/** One cell of a script result row. */
export type ScriptCell = ScriptRow[number]

/** The last run's outcome. */
export interface ScriptRunState {
  /** 'idle' before the first run, 'running' while the wire is out, 'ready'/'error' after. */
  status: 'idle' | 'running' | 'ready' | 'error'
  columns: string[]
  rows: ScriptRow[]
  /** Rows the script produced before the executor's budgets. */
  rowCount: number
  /** The executor's row/byte budget cut the result. */
  truncated: boolean
  /** The script ran but returned no value (statement/DDL/write). */
  executed: boolean
  elapsedMs: number | undefined
  /** The server the last run executed on. */
  server: string | undefined
  errorMessage: string | undefined
  /** Date.now() of the last settled run. */
  ranAt: number | undefined
}

/** What the script console renders. */
export interface ScriptConsoleState {
  run: ScriptRunState
}

/** The registration-side face the panel's slot entry injects. */
export interface ScriptConsoleFace {
  hooks: {
    /** Console snapshot bound by the renderer as useScriptConsole. */
    scriptConsole: SnapshotStore<ScriptConsoleState>
  }
  /** Execute one script on the active server. */
  runScript: (script: string) => void
}

const INITIAL_STATE: ScriptConsoleState = {
  run: {
    status: 'idle',
    columns: [],
    rows: [],
    rowCount: 0,
    truncated: false,
    executed: false,
    elapsedMs: undefined,
    server: undefined,
    errorMessage: undefined,
    ranAt: undefined,
  },
}

/** Bridges the `dolphindbConsole` script method onto the script console panel. */
export class ScriptConsoleController {
  private readonly store: SnapshotStore<ScriptConsoleState>
  private request = 0
  private disposed = false

  /**
   * @param ctx - the panel plugin's context, whose `remote.dolphindbConsole`
   * namespace the mounted contribution supplies.
   */
  constructor(private readonly ctx: ClientContext) {
    this.store = createSnapshotStore<ScriptConsoleState>({ run: { ...INITIAL_STATE.run } })
  }

  /**
   * Build the face the panel's slot registration injects.
   * @returns the console snapshot and its action.
   */
  inject(): ScriptConsoleFace {
    return {
      hooks: { scriptConsole: this.store },
      runScript: (script) => { void this.run(script) },
    }
  }

  /** Stop answering for good; settles in flight keep their answers to themselves. */
  dispose(): void {
    this.disposed = true
  }

  /**
   * One script run. The wire request carries the script verbatim; the host
   * validates and bounds it. Only the latest request publishes its settle.
   */
  private async run(script: string): Promise<void> {
    if (this.disposed || script.trim() === '') return
    const request = ++this.request
    this.store.update((draft) => {
      draft.run.status = 'running'
      draft.run.errorMessage = undefined
    })
    let result: Awaited<ReturnType<typeof this.ctx.remote.dolphindbConsole.runScript>>
    try {
      result = await this.ctx.remote.dolphindbConsole.runScript({ script })
    } catch (error) {
      if (this.disposed || request !== this.request) return
      this.store.update((draft) => {
        draft.run.status = 'error'
        draft.run.errorMessage = error instanceof Error ? error.message : String(error)
        draft.run.ranAt = Date.now()
      })
      return
    }
    if (this.disposed || request !== this.request) return
    if (result.ok) {
      const value = result.value
      this.store.update((draft) => {
        draft.run.status = 'ready'
        draft.run.columns = value.columns
        draft.run.rows = value.rows
        draft.run.rowCount = value.rowCount
        draft.run.truncated = value.truncated
        draft.run.executed = value.executed
        draft.run.elapsedMs = value.elapsedMs
        draft.run.server = value.server
        draft.run.errorMessage = undefined
        draft.run.ranAt = Date.now()
      })
    } else {
      this.store.update((draft) => {
        draft.run.status = 'error'
        draft.run.errorMessage = result.error.message
        draft.run.ranAt = Date.now()
      })
    }
  }
}
