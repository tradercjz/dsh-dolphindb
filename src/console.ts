/**
 * Cluster console Remote service: the Host half of the DolphinDB operations
 * console. Runs cluster introspection and node lifecycle operations as scripts
 * through the `ctx.dolphindb` executor seam on the active server, and exports
 * them to the web client as Typert Remote methods. The web client mounts a
 * hand-written strict contribution for this namespace; the Host side resolves
 * through the gateway's SRC fallback (no generated artifacts), so this build
 * must not mangle method parameter names (tsdown default: no minify).
 * @module @tradercjz/dsh-dolphindb
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
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

/** Upper bound on one start/stop request; the wire is an untrusted boundary. */
const MAX_NODE_OPERATION = 128

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

/**
 * Cluster introspection and node lifecycle for the operations console. All
 * methods target the executor's active server at call time, so a settings
 * switch moves the console with the next call.
 */
export class DolphinDbConsoleService extends TypertRemoteService {
  static inject = ['dolphindb']

  constructor(ctx: Context) {
    super(ctx, 'dolphindbConsole')
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
const REMOTE_METHODS = ['environment', 'overview', 'startNodes', 'stopNodes'] as const

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
