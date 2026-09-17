/**
 * Cluster console Remote service: the Host half of the DolphinDB operations
 * console. Runs cluster introspection, node lifecycle operations, and DFS
 * data browsing (catalog, table schema, paged table data) as scripts through
 * the `ctx.dolphindb` executor seam on the active server, and exports them to
 * the web client as Typert Remote methods. The web client mounts a
 * hand-written strict contribution for this namespace; the Host side registers
 * the same descriptors into the typert registry's local store at construction
 * (the gateway's SRC claim scan does not observe Loader-fiber services in
 * time), so the endpoint claims resolve strictly and no generated artifacts
 * are required.
 * @module @tradercjz/dsh-dolphindb
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
import type { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { z } from 'zod'
import type { JsonValue } from './types.ts'
// Brings the `ctx.dolphindb` declaration merge into scope.
import type {} from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    dolphindbConsole: DolphinDbConsoleService
  }
}

/** DolphinDB node type values shared by getNodeType() and the getClusterPerf mode column. */
export const NODE_TYPE = { data: 0, agent: 1, controller: 2, single: 3, computing: 4 } as const

/** Deployment and identity of the node the active server connection lands on. */
export interface ConsoleEnvironment {
  /** Active server registry name the introspection ran on. */
  readonly server: string
  /** getNodeType() of the connected node (see {@link NODE_TYPE}). */
  readonly nodeType: number
  /** getNodeAlias() of the connected node. */
  readonly nodeAlias: string
  /** Controller alias, or null on a single-node deployment. */
  readonly controllerAlias: string | null
  /** Whether the deployment has a controller (anything but single-node). */
  readonly clustered: boolean
}

/** One getClusterPerf(true) snapshot plus the identity needed to interpret it. */
export interface ClusterOverview extends ConsoleEnvironment {
  /** Column names of the raw getClusterPerf table. */
  readonly columns: string[]
  /** Row arrays aligned with {@link columns}; bigint-valued cells are strings. */
  readonly rows: JsonValue[][]
  /** Executor-measured wall time of the perf call. */
  readonly elapsedMs: number
}

/** Node lifecycle request: data/compute node aliases from getClusterPerf. */
export interface NodeOperationRequest {
  readonly nodes: string[]
}

/** Node lifecycle receipt: the operation was accepted by the controller. */
export interface NodeOperationResult {
  readonly server: string
  readonly nodes: string[]
  readonly elapsedMs: number
}

/** The sorted dfs:// path lists of every database and table the caller may see. */
export interface DfsCatalog {
  readonly server: string
  /** Database paths, sorted server-side (e.g. `dfs://DBA.DBAA.DBAAA_1`). */
  readonly databases: string[]
  /** Full table paths, sorted server-side (e.g. `dfs://A.compo/pt`). */
  readonly tables: string[]
  /** true when a list hit {@link MAX_CATALOG_PATHS} and was cut. */
  readonly truncated: boolean
  readonly elapsedMs: number
}

/** A DFS table addressed by its database path and table name. */
export interface DfsTableRef {
  /** Database path as getClusterDFSDatabases reports it (`dfs://…`). */
  readonly db: string
  /** Table name inside the database. */
  readonly table: string
}

/** The schema().colDefs projection of one DFS table plus its row count. */
export interface DfsTableSchema extends DfsTableRef {
  readonly server: string
  /** colDefs column names; version-dependent, indexed by name on the client. */
  readonly columns: string[]
  /** colDefs rows aligned with {@link columns}. */
  readonly rows: JsonValue[][]
  /** `select count(*)` — answered from chunk metadata on DFS tables. */
  readonly rowCount: number
  /** Combined wall time of the colDefs and count round trips. */
  readonly elapsedMs: number
}

/** Paged table data request: the table plus the SQL `limit offset, size` window. */
export interface DfsTablePageRequest extends DfsTableRef {
  /** Zero-based row offset of the page. */
  readonly offset: number
  /** Page size, bounded by {@link MAX_PAGE_ROWS}. */
  readonly limit: number
}

/** One page of a DFS table's rows. */
export interface DfsTablePage extends DfsTableRef {
  readonly server: string
  /** Column names in result order (numeric-named columns may reorder; prefer schema order). */
  readonly columns: string[]
  /** Page rows aligned with {@link columns}; empty past the table's end. */
  readonly rows: JsonValue[][]
  /** The offset this page answers for. */
  readonly offset: number
  /** true when the executor's row/byte budget cut the page. */
  readonly truncated: boolean
  readonly elapsedMs: number
}

/** Upper bound on one start/stop request; the wire is an untrusted boundary. */
const MAX_NODE_OPERATION = 128

/**
 * Upper bound on each catalog path list. A catalog cell bypasses the
 * executor's row/byte budgets (a one-cell result cannot shrink), so the cap is
 * applied here instead, before the payload becomes the wire's problem.
 */
const MAX_CATALOG_PATHS = 50_000

/** Upper bound on one paged table data request; also matches the executor's default row budget. */
const MAX_PAGE_ROWS = 1_000

/** Upper bound on a wire-supplied database path or table name. */
const MAX_NAME_LENGTH = 512

/**
 * Catalog probe executed as one round trip. getClusterDFSDatabases throws for
 * a user holding only table-level grants (2.00.9+ permission model), so each
 * half is guarded independently — the web console's own load_dbs does the
 * same composition. Sorting here keeps host-side truncation deterministic.
 */
const CATALOG_SCRIPT = [
  'try { dbs = getClusterDFSDatabases() } catch(ex) { dbs = array(STRING) }',
  'try { tbls = getClusterDFSTables() } catch(ex) { tbls = array(STRING) }',
  'dict(["databases", "tables"], [sort(dbs), sort(tbls)])',
].join('\n')

/** SQL `select count(*)`: answered from chunk metadata on DFS tables (count(t) on the lazy handle reads 0). */
function countScript(ref: DfsTableRef): string {
  return `select count(*) from loadTable(${quoteName(ref.db)}, ${quoteName(ref.table)})`
}

/** schema().colDefs: name/typeString/typeInt plus version-dependent extras, projected raw. */
function schemaScript(ref: DfsTableRef): string {
  return `schema(loadTable(${quoteName(ref.db)}, ${quoteName(ref.table)})).colDefs`
}

/** One data page; offset/limit are validated integers interpolated as literals. */
function pageScript(ref: DfsTableRef, offset: number, limit: number): string {
  return `select * from loadTable(${quoteName(ref.db)}, ${quoteName(ref.table)}) limit ${offset}, ${limit}`
}

/**
 * Environment probe executed as one round trip. Single-node deployments have
 * no controller, so the controller lookup is guarded instead of failing.
 */
const ENVIRONMENT_SCRIPT = [
  'nodeType = getNodeType()',
  'controllerAlias = ""',
  'if (nodeType != 3) { controllerAlias = getControllerAlias() }',
  'dict(["nodeType", "nodeAlias", "controllerAlias"], [string(nodeType), getNodeAlias(), controllerAlias])',
].join('\n')

/** Quote one node alias as a DolphinDB double-quoted string literal. */
function quoteName(name: string): string {
  return JSON.stringify(name)
}

/** Read the single-cell dictionary produced by {@link ENVIRONMENT_SCRIPT}. */
function readEnvironment(record: JsonValue | undefined, server: string): ConsoleEnvironment {
  const value = (typeof record === 'object' && record !== null && !Array.isArray(record))
    ? record as Record<string, JsonValue>
    : {}
  const nodeType = Number(value['nodeType'])
  const nodeAlias = typeof value['nodeAlias'] === 'string' ? value['nodeAlias'] : ''
  const controller = typeof value['controllerAlias'] === 'string' ? value['controllerAlias'] : ''
  return {
    server,
    nodeType,
    nodeAlias,
    controllerAlias: controller === '' ? null : controller,
    clustered: nodeType !== NODE_TYPE.single,
  }
}

/** Validate a wire-supplied node operation request. */
function assertNodeOperation(request: NodeOperationRequest): string[] {
  const nodes = request?.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('dolphindb: nodes must be a nonempty array of node aliases')
  }
  if (nodes.length > MAX_NODE_OPERATION) {
    throw new Error(`dolphindb: one node operation is limited to ${MAX_NODE_OPERATION} nodes`)
  }
  for (const name of nodes) {
    if (typeof name !== 'string' || name === '') {
      throw new Error('dolphindb: node aliases must be nonempty strings')
    }
  }
  return [...nodes]
}

/** Whether a wire-supplied name is a usable database path / table name. */
function isUsableName(value: unknown): value is string {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' && value !== '' && value.length <= MAX_NAME_LENGTH && !/[\0-\u001f]/.test(value)
}

/** Validate a wire-supplied DFS table reference; the names are quoted into scripts as string literals. */
function assertDfsTableRef(request: DfsTableRef): DfsTableRef {
  if (!isUsableName(request?.db) || !isUsableName(request?.table)) {
    throw new Error('dolphindb: db and table must be nonempty strings without control characters')
  }
  return { db: request.db, table: request.table }
}

/** Validate a wire-supplied page request: the table reference plus integer window bounds. */
function assertDfsTablePageRequest(request: DfsTablePageRequest): { ref: DfsTableRef, offset: number, limit: number } {
  const ref = assertDfsTableRef(request)
  const { offset, limit } = request
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('dolphindb: offset must be a nonnegative integer')
  }
  if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_PAGE_ROWS) {
    throw new Error(`dolphindb: limit must be an integer in 1..${MAX_PAGE_ROWS}`)
  }
  return { ref, offset, limit }
}

/** Read one string-array entry of the catalog dictionary, dropping non-string cells. */
function readPathList(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

/** Read the dictionary produced by {@link CATALOG_SCRIPT}, applying the path cap. */
function readCatalog(record: JsonValue | undefined, server: string, elapsedMs: number): DfsCatalog {
  const value = (typeof record === 'object' && record !== null && !Array.isArray(record))
    ? record as Record<string, JsonValue>
    : {}
  const databases = readPathList(value['databases'])
  const tables = readPathList(value['tables'])
  const truncated = databases.length > MAX_CATALOG_PATHS || tables.length > MAX_CATALOG_PATHS
  return {
    server,
    databases: databases.slice(0, MAX_CATALOG_PATHS),
    tables: tables.slice(0, MAX_CATALOG_PATHS),
    truncated,
    elapsedMs,
  }
}

/** Read the single-cell count result; LONG arrives as a decimal string. */
function readCount(cell: JsonValue | undefined): number {
  const value = Number(cell)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** Wire schema of the one business parameter the mutation methods share. */
const nodeOperationRequest$schema = z.object({ nodes: z.array(z.string()) })

/** Wire schema of the DFS table reference parameter. */
const dfsTableRefRequest$schema = z.object({ db: z.string(), table: z.string() })

/** Wire schema of the paged table data parameter. */
const dfsTablePageRequest$schema = z.object({
  db: z.string(),
  table: z.string(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
})

/** One console descriptor in the registry-local shape, mirroring the web client's mounted contribution. */
function consoleDescriptor(method: string, request$schema?: z.ZodType): InvocationDescriptor {
  return {
    id: `@tradercjz/dsh-dolphindb#dolphindbConsole/${method}`,
    service: 'dolphindbConsole',
    namespace: 'dolphindbConsole',
    method,
    invocation: { kind: 'direct' },
    parameters: request$schema === undefined
      ? []
      : [{
        name: 'request',
        wire: 'request',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: `@tradercjz/dsh-dolphindb/console#${method}Request`,
          schema: request$schema,
        },
      }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'src-json' },
  }
}

/** Host contribution registered into the typert local store when the service starts. */
const CONSOLE_CONTRIBUTION: TypertContribution = {
  package: '@tradercjz/dsh-dolphindb',
  face: 'host',
  schemas: [],
  invocations: [
    consoleDescriptor('environment'),
    consoleDescriptor('overview'),
    consoleDescriptor('startNodes', nodeOperationRequest$schema),
    consoleDescriptor('stopNodes', nodeOperationRequest$schema),
    consoleDescriptor('dfsCatalog'),
    consoleDescriptor('dfsTableSchema', dfsTableRefRequest$schema),
    consoleDescriptor('dfsTableData', dfsTablePageRequest$schema),
  ],
  model: { services: [], events: [], objects: [] },
}

/**
 * Cluster introspection and node lifecycle for the operations console. All
 * methods target the executor's active server at call time, so a settings
 * switch moves the console with the next call.
 */
export class DolphinDbConsoleService extends TypertRemoteService {
  static inject = ['dolphindb', 'typert']

  constructor(ctx: Context) {
    super(ctx, 'dolphindbConsole')
    // The protocol face of ctx.typert omits register(); the concrete registry
    // service provides it, like the typert-loader consumes it.
    const registry = ctx.get('typert') as unknown as TypertRegistry
    const dispose = registry.register(CONSOLE_CONTRIBUTION)
    ctx.effect(() => dispose, 'dolphindb: console typert contribution')
  }

  /**
   * Probe the connected node's deployment identity through the Remote API.
   * @param signal - transport cancellation.
   * @returns the active server, node type/alias, and controller alias.
   */
  async environment(signal?: AbortSignal): Promise<ConsoleEnvironment> {
    const spec = this.ctx.dolphindb.resolve({ script: ENVIRONMENT_SCRIPT, readOnly: true })
    const result = await this.ctx.dolphindb.execute(spec, signal)
    return readEnvironment(result.rows[0]?.[0], spec.server)
  }

  /**
   * Snapshot getClusterPerf(true) through the Remote API.
   * @param signal - transport cancellation.
   * @returns the bounded perf table plus the deployment identity.
   */
  async overview(signal?: AbortSignal): Promise<ClusterOverview> {
    const environment = await this.environment(signal)
    const spec = this.ctx.dolphindb.resolve({ script: 'getClusterPerf(true)', readOnly: true })
    const result = await this.ctx.dolphindb.execute(spec, signal)
    return { ...environment, columns: result.columns, rows: result.rows, elapsedMs: result.elapsedMs }
  }

  /**
   * Start data/compute nodes through the controller through the Remote API.
   * @param request - node aliases from getClusterPerf.
   * @param signal - transport cancellation.
   * @returns the accepted node list.
   */
  async startNodes(request: NodeOperationRequest, signal?: AbortSignal): Promise<NodeOperationResult> {
    return await this.nodeOperation('startDataNode', request, signal)
  }

  /**
   * Stop data/compute nodes through the controller through the Remote API.
   * @param request - node aliases from getClusterPerf.
   * @param signal - transport cancellation.
   * @returns the accepted node list.
   */
  async stopNodes(request: NodeOperationRequest, signal?: AbortSignal): Promise<NodeOperationResult> {
    return await this.nodeOperation('stopDataNode', request, signal)
  }

  /**
   * List every DFS database and table the active login may see, sorted.
   * @param signal - transport cancellation.
   * @returns the bounded catalog snapshot.
   */
  async dfsCatalog(signal?: AbortSignal): Promise<DfsCatalog> {
    const spec = this.ctx.dolphindb.resolve({ script: CATALOG_SCRIPT, readOnly: true })
    const result = await this.ctx.dolphindb.execute(spec, signal)
    return readCatalog(result.rows[0]?.[0], spec.server, result.elapsedMs)
  }

  /**
   * Read one DFS table's colDefs projection and row count through the Remote
   * API. Two sequential round trips: colDefs, then `select count(*)` — the
   * executor multiplexes nothing over one connection, so concurrency would
   * only reorder the socket.
   * @param request - the table reference.
   * @param signal - transport cancellation.
   * @returns the schema snapshot plus the metadata row count.
   */
  async dfsTableSchema(request: DfsTableRef, signal?: AbortSignal): Promise<DfsTableSchema> {
    const ref = assertDfsTableRef(request)
    const schemaSpec = this.ctx.dolphindb.resolve({ script: schemaScript(ref), readOnly: true })
    const schemaResult = await this.ctx.dolphindb.execute(schemaSpec, signal)
    const countSpec = this.ctx.dolphindb.resolve({ script: countScript(ref), readOnly: true })
    const countResult = await this.ctx.dolphindb.execute(countSpec, signal)
    return {
      ...ref,
      server: schemaSpec.server,
      columns: schemaResult.columns,
      rows: schemaResult.rows,
      rowCount: readCount(countResult.rows[0]?.[0]),
      elapsedMs: schemaResult.elapsedMs + countResult.elapsedMs,
    }
  }

  /**
   * Read one page of a DFS table's rows through the Remote API.
   * @param request - the table reference plus the page window.
   * @param signal - transport cancellation.
   * @returns the page; an out-of-range offset answers an empty page.
   */
  async dfsTableData(request: DfsTablePageRequest, signal?: AbortSignal): Promise<DfsTablePage> {
    const { ref, offset, limit } = assertDfsTablePageRequest(request)
    const spec = this.ctx.dolphindb.resolve({ script: pageScript(ref, offset, limit), readOnly: true })
    const result = await this.ctx.dolphindb.execute(spec, signal)
    return {
      ...ref,
      server: spec.server,
      columns: result.columns,
      rows: result.rows,
      offset,
      truncated: result.truncated,
      elapsedMs: result.elapsedMs,
    }
  }

  private async nodeOperation(
    func: 'startDataNode' | 'stopDataNode',
    request: NodeOperationRequest,
    signal?: AbortSignal,
  ): Promise<NodeOperationResult> {
    const nodes = assertNodeOperation(request)
    const environment = await this.environment(signal)
    if (!environment.clustered || environment.controllerAlias === null) {
      throw new Error(`dolphindb: ${func} requires a cluster; server "${environment.server}" is single-node`)
    }
    const script = `rpc(getControllerAlias(), ${func}{[${nodes.map(quoteName).join(', ')}]})`
    const spec = this.ctx.dolphindb.resolve({ script, readOnly: false })
    const result = await this.ctx.dolphindb.execute(spec, signal)
    return { server: spec.server, nodes, elapsedMs: result.elapsedMs }
  }
}

/** Remote-exported method names of {@link DolphinDbConsoleService}. */
const REMOTE_METHODS = ['environment', 'overview', 'startNodes', 'stopNodes', 'dfsCatalog', 'dfsTableSchema', 'dfsTableData'] as const

/**
 * Apply the protocol's `@Remote` markers without decorator syntax: the repo's
 * vitest loads TypeScript through Node's native stripping, which rejects
 * decorator syntax. The standard decorator is an ordinary function whose
 * initializer marks the prototype, and identical marks are idempotent, so
 * applying it once here equals the annotated form.
 */
function applyRemoteMarkers(names: readonly string[]): void {
  const prototype = DolphinDbConsoleService.prototype as object
  const standin = Object.create(prototype) as object
  for (const name of names) {
    const initializers: Array<(this: object) => void> = []
    Remote(name)(
      Reflect.get(prototype, name) as (this: object, ...args: unknown[]) => unknown,
      {
        kind: 'method',
        name,
        static: false,
        private: false,
        addInitializer(initializer) {
          initializers.push(initializer as (this: object) => void)
        },
      } as ClassMethodDecoratorContext<object, (this: object, ...args: unknown[]) => unknown>,
    )
    for (const initializer of initializers) initializer.call(standin)
  }
}

applyRemoteMarkers(REMOTE_METHODS)

export default DolphinDbConsoleService
