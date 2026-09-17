/**
 * Hand-written Typert Remote contribution for the Host's `dolphindbConsole`
 * service (@tradercjz/dsh-dolphindb/console). The Host exports the cluster
 * console methods without generated artifacts (gateway SRC fallback), so this
 * package carries the consumer-side descriptors itself, in the generated
 * artifact's shape: strict parameter codecs (the client gateway refuses a
 * parameter without one) and a src-json result codec (results stay the Host's
 * bounded JSON projections).
 *
 * Payload types are imported type-only from the Host package; the purity gate
 * never sees them, and the single runtime value import is zod (inlined).
 */

import { z } from 'zod'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ClusterOverview, ConsoleEnvironment, DfsCatalog, DfsTablePage, DfsTablePageRequest, DfsTableRef,
  DfsTableSchema, NodeOperationRequest, NodeOperationResult, ScriptRunRequest, ScriptRunResult,
} from '@tradercjz/dsh-dolphindb/console'

/** The `dolphindbConsole` Remote namespace as this client calls it. */
export interface DolphinDbConsoleRemote {
  /** Probe the connected node's deployment identity. */
  environment: () => Promise<RemoteResult<ConsoleEnvironment>>
  /** Snapshot getClusterPerf(true) plus the deployment identity. */
  overview: () => Promise<RemoteResult<ClusterOverview>>
  /** Start data/compute nodes through the controller. */
  startNodes: (request: NodeOperationRequest) => Promise<RemoteResult<NodeOperationResult>>
  /** Stop data/compute nodes through the controller. */
  stopNodes: (request: NodeOperationRequest) => Promise<RemoteResult<NodeOperationResult>>
  /** List every visible DFS database and table path, sorted. */
  dfsCatalog: () => Promise<RemoteResult<DfsCatalog>>
  /** Read one DFS table's colDefs projection and row count. */
  dfsTableSchema: (request: DfsTableRef) => Promise<RemoteResult<DfsTableSchema>>
  /** Read one page of a DFS table's rows. */
  dfsTableData: (request: DfsTablePageRequest) => Promise<RemoteResult<DfsTablePage>>
  /** Run one interactive script on the active server. */
  runScript: (request: ScriptRunRequest) => Promise<RemoteResult<ScriptRunResult>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    /** DolphinDB cluster console: environment probe, perf overview, node start/stop. */
    'dolphindbConsole': DolphinDbConsoleRemote
  }
}

const nodeOperationRequest$schema = z.object({ nodes: z.array(z.string()) })

const nodeOperationParameter = {
  name: 'request',
  wire: 'request',
  source: 'json',
  codec: {
    mode: 'strict',
    typeSymbol: '@tradercjz/dsh-client-console#NodeOperationRequest',
    schema: nodeOperationRequest$schema,
  },
} as const

const dfsTableRefParameter = {
  name: 'request',
  wire: 'request',
  source: 'json',
  codec: {
    mode: 'strict',
    typeSymbol: '@tradercjz/dsh-client-console#DfsTableRef',
    schema: z.object({ db: z.string(), table: z.string() }),
  },
} as const

const dfsTablePageParameter = {
  name: 'request',
  wire: 'request',
  source: 'json',
  codec: {
    mode: 'strict',
    typeSymbol: '@tradercjz/dsh-client-console#DfsTablePageRequest',
    schema: z.object({
      db: z.string(),
      table: z.string(),
      offset: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
    }),
  },
} as const

const scriptRunParameter = {
  name: 'request',
  wire: 'request',
  source: 'json',
  codec: {
    mode: 'strict',
    typeSymbol: '@tradercjz/dsh-client-console#ScriptRunRequest',
    schema: z.object({ script: z.string() }),
  },
} as const

/** Consumer-side descriptors of the `dolphindbConsole` namespace. */
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@tradercjz/dsh-client-console',
  descriptors: [
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/environment',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'environment',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/overview',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'overview',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/startNodes',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'startNodes',
      invocation: { kind: 'direct' },
      parameters: [nodeOperationParameter],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/stopNodes',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'stopNodes',
      invocation: { kind: 'direct' },
      parameters: [nodeOperationParameter],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/dfsCatalog',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'dfsCatalog',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/dfsTableSchema',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'dfsTableSchema',
      invocation: { kind: 'direct' },
      parameters: [dfsTableRefParameter],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/dfsTableData',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'dfsTableData',
      invocation: { kind: 'direct' },
      parameters: [dfsTablePageParameter],
      result: { mode: 'src-json' },
    },
    {
      id: '@tradercjz/dsh-client-console#dolphindbConsole/runScript',
      service: 'dolphindbConsole',
      namespace: 'dolphindbConsole',
      method: 'runScript',
      invocation: { kind: 'direct' },
      parameters: [scriptRunParameter],
      result: { mode: 'src-json' },
    },
  ],
}

export default TYPERT_REMOTE
