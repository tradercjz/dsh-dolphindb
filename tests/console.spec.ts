/**
 * Behavioral tests for the cluster console Remote service: the Remote method
 * marks the gateway's SRC fallback serves from, environment parsing across
 * deployments, overview projection, and node-operation validation and script
 * generation — all through a fake `dolphindb` executor seam.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it } from 'vitest'
import { DolphinDbConsoleService, NODE_TYPE } from '../src/console.ts'
import type { DolphinDbQueryRequest, DolphinDbQuerySpec, DolphinDbResult } from '../src/types.ts'

interface RecordedCall {
  readonly request: DolphinDbQueryRequest
  readonly spec: DolphinDbQuerySpec
}

/** Fake executor seam: scripts are answered from a queue, calls are recorded. */
class FakeExecutor extends Service {
  readonly calls: RecordedCall[] = []
  /** Results handed out per execute() call, in order. */
  readonly answers: DolphinDbResult[] = []

  constructor(ctx: Context) {
    super(ctx, 'dolphindb')
  }

  activeServer(): string {
    return 'main'
  }

  resolve(request: DolphinDbQueryRequest): DolphinDbQuerySpec {
    return {
      script: request.script,
      maxRows: 1_000,
      maxBytes: 512 * 1024,
      readOnly: request.readOnly ?? true,
      timeoutMs: 30_000,
      server: request.server ?? 'main',
    }
  }

  async execute(spec: DolphinDbQuerySpec): Promise<DolphinDbResult> {
    this.calls.push({ request: { script: spec.script }, spec })
    const answer = this.answers.shift()
    if (answer === undefined) throw new Error(`unexpected script: ${spec.script}`)
    return answer
  }
}

/** Stub typert registry: records host contributions handed to register(). */
class StubTypertRegistry extends Service {
  readonly contributions: { package: string, invocations: readonly { id: string }[] }[] = []

  constructor(ctx: Context) {
    super(ctx, 'typert')
  }

  register(contribution: { package: string, invocations: readonly { id: string }[] }): () => Promise<void> {
    this.contributions.push(contribution)
    return async () => {}
  }
}

function envResult(nodeType: number, controllerAlias: string): DolphinDbResult {
  return {
    columns: ['value'],
    rows: [[{ nodeType: String(nodeType), nodeAlias: 'dn1', controllerAlias }]],
    rowCount: 1,
    truncated: false,
    elapsedMs: 1,
    executed: false,
    server: 'main',
  }
}

function perfResult(): DolphinDbResult {
  return {
    columns: ['name', 'mode', 'state'],
    rows: [['ctl', 2, 1], ['dn1', 0, 1]],
    rowCount: 2,
    truncated: false,
    elapsedMs: 3,
    executed: false,
    server: 'main',
  }
}

function executedResult(): DolphinDbResult {
  return { columns: [], rows: [], rowCount: 0, truncated: false, elapsedMs: 5, executed: true, server: 'main' }
}

async function setup(): Promise<{ ctx: Context, executor: FakeExecutor, registry: StubTypertRegistry, service: DolphinDbConsoleService }> {
  const ctx = new Context()
  await ctx.plugin(FakeExecutor)
  await ctx.plugin(StubTypertRegistry)
  await ctx.plugin(DolphinDbConsoleService)
  const executor = ctx.get('dolphindb') as unknown as FakeExecutor
  const registry = ctx.get('typert') as unknown as StubTypertRegistry
  const service = ctx.get('dolphindbConsole')
  return { ctx, executor, registry, service }
}

describe('DolphinDbConsoleService', () => {
  it('marks the console methods for Remote serving', async () => {
    const { service } = await setup()
    const exports = remoteMethods(service).map(marker => marker.exportName ?? marker.method)
    expect(exports).toEqual([
      'environment', 'overview', 'startNodes', 'stopNodes',
      'dfsCatalog', 'dfsTableSchema', 'dfsTableData', 'runScript',
    ])
  })

  it('registers the host contribution with strict descriptors at construction', async () => {
    const { registry } = await setup()
    expect(registry.contributions).toHaveLength(1)
    const contribution = registry.contributions[0]!
    expect(contribution.package).toBe('@tradercjz/dsh-dolphindb')
    expect(contribution.invocations.map(invocation => invocation.id)).toEqual([
      '@tradercjz/dsh-dolphindb#dolphindbConsole/environment',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/overview',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/startNodes',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/stopNodes',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/dfsCatalog',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/dfsTableSchema',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/dfsTableData',
      '@tradercjz/dsh-dolphindb#dolphindbConsole/runScript',
    ])
  })

  it('parses a clustered environment from the probe dictionary', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.data, 'ctl'))
    const environment = await service.environment()
    expect(environment).toEqual({
      server: 'main',
      nodeType: NODE_TYPE.data,
      nodeAlias: 'dn1',
      controllerAlias: 'ctl',
      clustered: true,
    })
    expect(executor.calls[0]?.spec.readOnly).toBe(true)
  })

  it('reads a single-node deployment as controllerless and unclustered', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.single, ''))
    const environment = await service.environment()
    expect(environment.controllerAlias).toBeNull()
    expect(environment.clustered).toBe(false)
  })

  it('projects the perf table plus identity as the overview', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.data, 'ctl'), perfResult())
    const overview = await service.overview()
    expect(overview.columns).toEqual(['name', 'mode', 'state'])
    expect(overview.rows).toHaveLength(2)
    expect(overview.controllerAlias).toBe('ctl')
    expect(overview.elapsedMs).toBe(3)
    expect(executor.calls.every(call => call.spec.readOnly)).toBe(true)
  })

  it('routes node starts to the controller as a write script', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.data, 'ctl'), executedResult())
    const result = await service.startNodes({ nodes: ['dn1', 'dn2'] })
    expect(result).toEqual({ server: 'main', nodes: ['dn1', 'dn2'], elapsedMs: 5 })
    const operation = executor.calls[1]?.spec
    expect(operation?.script).toBe('rpc(getControllerAlias(), startDataNode{["dn1", "dn2"]})')
    expect(operation?.readOnly).toBe(false)
  })

  it('routes node stops to the controller as a write script', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.data, 'ctl'), executedResult())
    await service.stopNodes({ nodes: ['dn1'] })
    expect(executor.calls[1]?.spec.script).toBe('rpc(getControllerAlias(), stopDataNode{["dn1"]})')
  })

  it('rejects node operations on a single-node server before writing', async () => {
    const { executor, service } = await setup()
    executor.answers.push(envResult(NODE_TYPE.single, ''))
    await expect(service.stopNodes({ nodes: ['dn1'] })).rejects.toThrow(/single-node/)
    expect(executor.calls).toHaveLength(1)
  })

  it('validates the wire request before touching the server', async () => {
    const { executor, service } = await setup()
    await expect(service.startNodes({ nodes: [] })).rejects.toThrow(/nonempty/)
    await expect(service.startNodes({ nodes: [''] })).rejects.toThrow(/nonempty strings/)
    await expect(service.startNodes({ nodes: ['x'.repeat(0)].filter(Boolean) })).rejects.toThrow(/nonempty/)
    await expect(service.startNodes({ nodes: Array.from({ length: 129 }, (_, i) => `n${i}`) })).rejects.toThrow(/128/)
    expect(executor.calls).toHaveLength(0)
  })
})

function catalogResult(databases: string[], tables: string[]): DolphinDbResult {
  return {
    columns: ['value'],
    rows: [[{ databases, tables }]],
    rowCount: 1,
    truncated: false,
    elapsedMs: 7,
    executed: false,
    server: 'main',
  }
}

function colDefsResult(): DolphinDbResult {
  return {
    columns: ['name', 'typeString'],
    rows: [['id', 'INT'], ['ts', 'TIMESTAMP']],
    rowCount: 2,
    truncated: false,
    elapsedMs: 3,
    executed: false,
    server: 'main',
  }
}

function countResult(count: string): DolphinDbResult {
  return {
    columns: ['count'],
    rows: [[count]],
    rowCount: 1,
    truncated: false,
    elapsedMs: 2,
    executed: false,
    server: 'main',
  }
}

function pageResult(truncated: boolean): DolphinDbResult {
  return {
    columns: ['id', 'ts'],
    rows: [[1, '2024.01.01T00:00:00'], [2, '2024.01.01T00:00:01']],
    rowCount: 2,
    truncated,
    elapsedMs: 11,
    executed: false,
    server: 'main',
  }
}

describe('DolphinDbConsoleService DFS browsing', () => {
  it('reads the catalog dictionary and reports both path lists', async () => {
    const { executor, service } = await setup()
    executor.answers.push(catalogResult(['dfs://db1'], ['dfs://db1/t1', 'dfs://db1/t2']))
    const catalog = await service.dfsCatalog()
    expect(catalog).toEqual({
      server: 'main',
      databases: ['dfs://db1'],
      tables: ['dfs://db1/t1', 'dfs://db1/t2'],
      truncated: false,
      elapsedMs: 7,
    })
    expect(executor.calls[0]?.spec.script).toContain('getClusterDFSDatabases')
    expect(executor.calls[0]?.spec.script).toContain('getClusterDFSTables')
    expect(executor.calls[0]?.spec.readOnly).toBe(true)
  })

  it('drops non-string cells and cuts overlong catalogs with the flag set', async () => {
    const { executor, service } = await setup()
    const tables = Array.from({ length: 50_001 }, (_, index) => `dfs://db/t${index}`)
    executor.answers.push(catalogResult([], [...tables, 42 as unknown as string]))
    const catalog = await service.dfsCatalog()
    expect(catalog.truncated).toBe(true)
    expect(catalog.tables).toHaveLength(50_000)
    expect(catalog.databases).toEqual([])
  })

  it('tolerates a malformed catalog cell', async () => {
    const { executor, service } = await setup()
    executor.answers.push({
      columns: ['value'], rows: [[null]], rowCount: 1, truncated: false, elapsedMs: 1, executed: false, server: 'main',
    })
    const catalog = await service.dfsCatalog()
    expect(catalog.databases).toEqual([])
    expect(catalog.tables).toEqual([])
    expect(catalog.truncated).toBe(false)
  })

  it('runs schema and count as two read-only round trips and parses the count string', async () => {
    const { executor, service } = await setup()
    executor.answers.push(colDefsResult(), countResult('1000000'))
    const schema = await service.dfsTableSchema({ db: 'dfs://db1', table: 't1' })
    expect(schema).toEqual({
      server: 'main',
      db: 'dfs://db1',
      table: 't1',
      columns: ['name', 'typeString'],
      rows: [['id', 'INT'], ['ts', 'TIMESTAMP']],
      rowCount: 1_000_000,
      elapsedMs: 5,
    })
    expect(executor.calls).toHaveLength(2)
    expect(executor.calls[0]?.spec.script).toBe('schema(loadTable("dfs://db1", "t1")).colDefs')
    expect(executor.calls[1]?.spec.script).toBe('select count(*) from loadTable("dfs://db1", "t1")')
    expect(executor.calls.every(call => call.spec.readOnly)).toBe(true)
  })

  it('rejects malformed table references before touching the server', async () => {
    const { executor, service } = await setup()
    await expect(service.dfsTableSchema({ db: '', table: 't' })).rejects.toThrow(/nonempty/)
    await expect(service.dfsTableSchema({ db: 'dfs://db', table: 'a\nb' })).rejects.toThrow(/control/)
    await expect(service.dfsTableSchema({ db: 'x'.repeat(513), table: 't' })).rejects.toThrow(/nonempty|control/)
    expect(executor.calls).toHaveLength(0)
  })

  it('pages table data with the window in the script and the truncation flag read back', async () => {
    const { executor, service } = await setup()
    executor.answers.push(pageResult(true))
    const page = await service.dfsTableData({ db: 'dfs://db1', table: 't1', offset: 200, limit: 100 })
    expect(page).toEqual({
      server: 'main',
      db: 'dfs://db1',
      table: 't1',
      columns: ['id', 'ts'],
      rows: [[1, '2024.01.01T00:00:00'], [2, '2024.01.01T00:00:01']],
      offset: 200,
      truncated: true,
      elapsedMs: 11,
    })
    expect(executor.calls[0]?.spec.script).toBe('select * from loadTable("dfs://db1", "t1") limit 200, 100')
    expect(executor.calls[0]?.spec.readOnly).toBe(true)
  })

  it('quotes names carrying quotes or spaces as string literals', async () => {
    const { executor, service } = await setup()
    executor.answers.push(pageResult(false))
    await service.dfsTableData({ db: 'dfs:// dayFactorDB ', table: 'weird"tbl', offset: 0, limit: 10 })
    expect(executor.calls[0]?.spec.script).toBe(
      'select * from loadTable("dfs:// dayFactorDB ", "weird\\"tbl") limit 0, 10',
    )
  })

  it('validates the page window before touching the server', async () => {
    const { executor, service } = await setup()
    const ref = { db: 'dfs://db', table: 't' }
    await expect(service.dfsTableData({ ...ref, offset: -1, limit: 10 })).rejects.toThrow(/offset/)
    await expect(service.dfsTableData({ ...ref, offset: 0.5, limit: 10 })).rejects.toThrow(/offset/)
    await expect(service.dfsTableData({ ...ref, offset: 0, limit: 0 })).rejects.toThrow(/limit/)
    await expect(service.dfsTableData({ ...ref, offset: 0, limit: 1001 })).rejects.toThrow(/1000/)
    expect(executor.calls).toHaveLength(0)
  })
})

describe('DolphinDbConsoleService script runs', () => {
  it('executes the script as-is with write semantics and returns the bounded projection', async () => {
    const { executor, service } = await setup()
    executor.answers.push({
      columns: ['value'], rows: [[42]], rowCount: 1, truncated: false, elapsedMs: 9, executed: false, server: 'main',
    })
    const result = await service.runScript({ script: '1 + 41' })
    expect(result).toEqual({
      columns: ['value'], rows: [[42]], rowCount: 1, truncated: false, elapsedMs: 9, executed: false, server: 'main',
    })
    expect(executor.calls[0]?.spec.script).toBe('1 + 41')
    expect(executor.calls[0]?.spec.readOnly).toBe(false)
  })

  it('carries the executed marker for DDL and writes', async () => {
    const { executor, service } = await setup()
    executor.answers.push(executedResult())
    const result = await service.runScript({ script: 'share table(1..3 as id) as st' })
    expect(result.executed).toBe(true)
    expect(result.rows).toEqual([])
  })

  it('rejects empty and oversized scripts before touching the server', async () => {
    const { executor, service } = await setup()
    await expect(service.runScript({ script: '' })).rejects.toThrow(/nonempty/)
    await expect(service.runScript({ script: '   \n  ' })).rejects.toThrow(/nonempty/)
    await expect(service.runScript({ script: 'x'.repeat(65_537) })).rejects.toThrow(/65536/)
    expect(executor.calls).toHaveLength(0)
  })
})
