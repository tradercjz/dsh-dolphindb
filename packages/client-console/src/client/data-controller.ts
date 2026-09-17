/**
 * The data browser's controller over the `dolphindbConsole` Remote namespace.
 * One snapshot store carries the DFS catalog, the tree expansion, the current
 * table selection, and that table's schema and page window; the panel renders
 * nothing the controller did not publish.
 *
 * The catalog loads lazily on the first subscriber (the mounted panel) and
 * reloads only on demand — unlike the cluster console there is no polling,
 * because a schema page is a reading surface, not a monitoring one. Every
 * in-flight request captures the selection it answers for and publishes only
 * while that selection is still in force (object identity), so a late settle
 * from an abandoned table never clobbers the live one. Page navigation is
 * serialized by a request counter: only the latest page request publishes.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program. Cross-plugin
// collaboration goes through the service, never a value import.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { DfsTablePage } from '@tradercjz/dsh-dolphindb/console'
// Type-only: pulls the dolphindbConsole TypertRemoteNamespaceMap merge in.
import type {} from './contribution.ts'

/** One row of a page or a colDefs projection. */
export type DataRow = DfsTablePage['rows'][number]

/** One cell of a data row. */
export type DataCell = DataRow[number]

/** The DFS catalog snapshot the tree renders. */
export interface CatalogState {
  /** 'loading' before the first settle, 'ready' once a catalog landed, 'error' when none ever did. */
  status: 'loading' | 'ready' | 'error'
  /** The server the catalog was read from. */
  server: string | undefined
  /** Database paths, sorted. */
  databases: string[]
  /** Full table paths, sorted. */
  tables: string[]
  /** The host cut an overlong list. */
  truncated: boolean
  /** The last load failure's message; undefined while loads succeed. */
  errorMessage: string | undefined
  /** Date.now() of the last successful load; undefined before the first. */
  updatedAt: number | undefined
}

/** The table the content pane answers for. */
export interface TableSelection {
  readonly db: string
  readonly table: string
}

/** The selected table's colDefs projection plus row count. */
export interface SchemaState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  columns: string[]
  rows: DataRow[]
  rowCount: number | undefined
  errorMessage: string | undefined
}

/** The selected table's current page window. */
export interface PageState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  columns: string[]
  rows: DataRow[]
  /** The offset the current (or in-flight) page answers for. */
  offset: number
  limit: number
  truncated: boolean
  elapsedMs: number | undefined
  errorMessage: string | undefined
}

/** What the data browser renders. */
export interface DataBrowserState {
  catalog: CatalogState
  /** Database paths expanded in the tree. */
  expanded: string[]
  selection: TableSelection | undefined
  schema: SchemaState
  page: PageState
}

/** The registration-side face the panel's slot entry injects. */
export interface DataBrowserFace {
  hooks: {
    /** Browser snapshot bound by the renderer as useDataBrowser. */
    dataBrowser: SnapshotStore<DataBrowserState>
  }
  /** Reload the DFS catalog. */
  refreshCatalog: () => void
  /** Expand or collapse one database in the tree. */
  toggleExpand: (db: string) => void
  /** Open one table: loads its schema and first page. */
  selectTable: (db: string, table: string) => void
  /** Move the page window one page back. */
  prevPage: () => void
  /** Move the page window one page forward. */
  nextPage: () => void
  /** Change the page size; reloads from offset zero. */
  setPageLimit: (limit: number) => void
  /** Reload the current page. */
  refreshPage: () => void
}

/** Page sizes the panel offers; the host caps every page at 1000. */
export const PAGE_SIZES = [50, 100, 200, 500, 1000] as const

const DEFAULT_PAGE_LIMIT = 100

const INITIAL_STATE: DataBrowserState = {
  catalog: {
    status: 'loading',
    server: undefined,
    databases: [],
    tables: [],
    truncated: false,
    errorMessage: undefined,
    updatedAt: undefined,
  },
  expanded: [],
  selection: undefined,
  schema: { status: 'idle', columns: [], rows: [], rowCount: undefined, errorMessage: undefined },
  page: {
    status: 'idle',
    columns: [],
    rows: [],
    offset: 0,
    limit: DEFAULT_PAGE_LIMIT,
    truncated: false,
    elapsedMs: undefined,
    errorMessage: undefined,
  },
}

/** The database path a full table path belongs to (split at the last slash). */
export function tableDb(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? path : path.slice(0, slash)
}

/** The table name of a full table path. */
export function tableName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? path : path.slice(slash + 1)
}

/** System databases hidden from the tree (the catalog call cannot hide them on older servers). */
function isSystemPath(path: string): boolean {
  return path.startsWith('dfs://sys')
}

/**
 * Order grid columns by the schema's colDefs order. The result's own column
 * order is untrustworthy — integer-like column names reorder in the wire
 * projection — so schema names lead and result-only extras trail.
 */
export function orderColumns(schemaNames: readonly string[], pageColumns: readonly string[]): string[] {
  const present = new Set(pageColumns)
  const ordered = schemaNames.filter(name => present.has(name))
  const extras = pageColumns.filter(name => !schemaNames.includes(name))
  return [...ordered, ...extras]
}

/** Bridges the `dolphindbConsole` DFS methods onto the data browser panel. */
export class DataBrowserController {
  private readonly store: SnapshotStore<DataBrowserState>
  private subscribers = 0
  private catalogRequested = false
  private pageRequest = 0
  private disposed = false

  /**
   * @param ctx - the panel plugin's context, whose `remote.dolphindbConsole`
   * namespace the mounted contribution supplies.
   */
  constructor(private readonly ctx: ClientContext) {
    const store = createSnapshotStore<DataBrowserState>({
      ...INITIAL_STATE,
      catalog: { ...INITIAL_STATE.catalog },
      schema: { ...INITIAL_STATE.schema },
      page: { ...INITIAL_STATE.page },
    })
    const rawSubscribe = store.subscribe
    store.subscribe = (fn) => this.track(rawSubscribe, fn)
    this.store = store
  }

  /**
   * Build the face the panel's slot registration injects.
   * @returns the browser snapshot and its actions.
   */
  inject(): DataBrowserFace {
    return {
      hooks: { dataBrowser: this.store },
      refreshCatalog: () => { void this.loadCatalog() },
      toggleExpand: (db) => { this.toggleExpand(db) },
      selectTable: (db, table) => { void this.selectTable(db, table) },
      prevPage: () => { void this.turnPage(-1) },
      nextPage: () => { void this.turnPage(1) },
      setPageLimit: (limit) => { void this.setPageLimit(limit) },
      refreshPage: () => { void this.refreshPage() },
    }
  }

  /** Stop answering for good; settles in flight keep their answers to themselves. */
  dispose(): void {
    this.disposed = true
  }

  /** Count one store subscriber; the first triggers the lazy catalog load. */
  private track(rawSubscribe: SnapshotStore<DataBrowserState>['subscribe'], fn: () => void): () => void {
    this.subscribers += 1
    if (!this.catalogRequested && !this.disposed) {
      this.catalogRequested = true
      void this.loadCatalog()
    }
    const release = rawSubscribe(fn)
    let active = true
    return () => {
      if (!active) return
      active = false
      release()
      this.subscribers -= 1
    }
  }

  /**
   * One catalog load. A failed reload keeps the last good lists and surfaces
   * only the error line — the tree a user is about to click never blanks out
   * under a transient failure.
   */
  private async loadCatalog(): Promise<void> {
    if (this.disposed) return
    let result: Awaited<ReturnType<typeof this.ctx.remote.dolphindbConsole.dfsCatalog>>
    try {
      result = await this.ctx.remote.dolphindbConsole.dfsCatalog()
    } catch (error) {
      if (this.disposed) return
      this.store.update((draft) => {
        draft.catalog.status = draft.catalog.updatedAt === undefined ? 'error' : 'ready'
        draft.catalog.errorMessage = error instanceof Error ? error.message : String(error)
      })
      return
    }
    if (this.disposed) return
    if (result.ok) {
      const catalog = result.value
      this.store.update((draft) => {
        draft.catalog.status = 'ready'
        draft.catalog.server = catalog.server
        draft.catalog.databases = catalog.databases.filter(path => !isSystemPath(path))
        draft.catalog.tables = catalog.tables.filter(path => !isSystemPath(path))
        draft.catalog.truncated = catalog.truncated
        draft.catalog.errorMessage = undefined
        draft.catalog.updatedAt = Date.now()
        // A path the reloaded catalog no longer lists cannot stay expanded.
        const listed = new Set(draft.catalog.databases)
        draft.expanded = draft.expanded.filter(db => listed.has(db))
      })
    } else {
      this.store.update((draft) => {
        draft.catalog.status = draft.catalog.updatedAt === undefined ? 'error' : 'ready'
        draft.catalog.errorMessage = result.error.message
      })
    }
  }

  private toggleExpand(db: string): void {
    this.store.update((draft) => {
      draft.expanded = draft.expanded.includes(db)
        ? draft.expanded.filter(candidate => candidate !== db)
        : [...draft.expanded, db]
    })
  }

  /**
   * Open one table. The schema loads first, then the first page: the grid's
   * column order comes from the schema, so the page is only useful after it.
   * Both settles check the captured selection's identity before publishing.
   */
  private async selectTable(db: string, table: string): Promise<void> {
    if (this.disposed) return
    const selection: TableSelection = { db, table }
    const request = ++this.pageRequest
    this.store.update((draft) => {
      draft.selection = selection
      draft.expanded = draft.expanded.includes(db) ? draft.expanded : [...draft.expanded, db]
      draft.schema = { status: 'loading', columns: [], rows: [], rowCount: undefined, errorMessage: undefined }
      draft.page = { ...draft.page, status: 'idle', columns: [], rows: [], offset: 0, errorMessage: undefined }
    })
    const remote = this.ctx.remote.dolphindbConsole
    let schemaResult: Awaited<ReturnType<typeof remote.dfsTableSchema>>
    try {
      schemaResult = await remote.dfsTableSchema(selection)
    } catch (error) {
      if (this.disposed || !this.answersFor(selection)) return
      this.store.update((draft) => {
        draft.schema = {
          status: 'error',
          columns: [],
          rows: [],
          rowCount: undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      })
      return
    }
    if (this.disposed || !this.answersFor(selection)) return
    if (!schemaResult.ok) {
      this.store.update((draft) => {
        draft.schema = {
          status: 'error',
          columns: [],
          rows: [],
          rowCount: undefined,
          errorMessage: schemaResult.error.message,
        }
      })
      return
    }
    this.store.update((draft) => {
      draft.schema = {
        status: 'ready',
        columns: schemaResult.value.columns,
        rows: schemaResult.value.rows,
        rowCount: schemaResult.value.rowCount,
        errorMessage: undefined,
      }
    })
    await this.loadPage(selection, 0, request)
  }

  /** Whether `selection` is still the selection in force. */
  private answersFor(selection: TableSelection): boolean {
    return this.store.getSnapshot().selection === selection
  }

  private async turnPage(direction: -1 | 1): Promise<void> {
    const { selection, page, schema } = this.store.getSnapshot()
    if (selection === undefined || schema.status !== 'ready') return
    if (page.status === 'loading') return
    const offset = page.offset + direction * page.limit
    if (offset < 0) return
    if (direction === 1 && schema.rowCount !== undefined && offset >= schema.rowCount) return
    await this.loadPage(selection, offset, ++this.pageRequest)
  }

  private async setPageLimit(limit: number): Promise<void> {
    const { selection, page, schema } = this.store.getSnapshot()
    if (selection === undefined || schema.status !== 'ready') return
    if (page.status === 'loading' || limit === page.limit || limit <= 0) return
    this.store.update((draft) => {
      draft.page.limit = limit
      draft.page.offset = 0
    })
    await this.loadPage(selection, 0, ++this.pageRequest)
  }

  private async refreshPage(): Promise<void> {
    const { selection, page, schema } = this.store.getSnapshot()
    if (selection === undefined || schema.status !== 'ready' || page.status === 'loading') return
    await this.loadPage(selection, page.offset, ++this.pageRequest)
  }

  /**
   * One page load. Out-of-order settles are dropped by request counter: a
   * page is published only while it still answers for the navigation in force.
   */
  private async loadPage(selection: TableSelection, offset: number, request: number): Promise<void> {
    const limit = this.store.getSnapshot().page.limit
    this.store.update((draft) => {
      draft.page.status = 'loading'
      draft.page.offset = offset
      draft.page.errorMessage = undefined
    })
    const remote = this.ctx.remote.dolphindbConsole
    let result: Awaited<ReturnType<typeof remote.dfsTableData>>
    try {
      result = await remote.dfsTableData({ ...selection, offset, limit })
    } catch (error) {
      if (this.disposed || request !== this.pageRequest || !this.answersFor(selection)) return
      this.store.update((draft) => {
        draft.page.status = 'error'
        draft.page.errorMessage = error instanceof Error ? error.message : String(error)
      })
      return
    }
    if (this.disposed || request !== this.pageRequest || !this.answersFor(selection)) return
    if (result.ok) {
      const page = result.value
      this.store.update((draft) => {
        draft.page.status = 'ready'
        // An empty page projects no columns; the grid falls back to schema order.
        draft.page.columns = page.rows.length === 0 ? [] : page.columns
        draft.page.rows = page.rows
        draft.page.truncated = page.truncated
        draft.page.elapsedMs = page.elapsedMs
        draft.page.errorMessage = undefined
      })
    } else {
      this.store.update((draft) => {
        draft.page.status = 'error'
        draft.page.errorMessage = result.error.message
      })
    }
  }
}
