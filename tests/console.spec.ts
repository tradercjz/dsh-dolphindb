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
  it('marks the four console methods for Remote serving', async () => {
    const { service } = await setup()
    const exports = remoteMethods(service).map(marker => marker.exportName ?? marker.method)
    expect(exports).toEqual(['environment', 'overview', 'startNodes', 'stopNodes'])
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
