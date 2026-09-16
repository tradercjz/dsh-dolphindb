/**
 * Model-facing DolphinDB tools. `dolphindb_query` runs read-only scripts;
 * `dolphindb_execute` runs write/mutation scripts behind the approval seam. Both
 * read through the `ctx.dolphindb` executor seam and render a bounded result. A
 * function plugin (no default export) so the Loader keeps its named injection
 * metadata.
 * @module @tradercjz/dsh-dolphindb
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallView } from '@deepseek-ai/dsh-tools'
import type { DolphinDbResult, JsonValue } from './types.ts'
// Brings the `ctx.dolphindb` declaration merge into scope.
import type {} from './service.ts'
// Brings the `ctx.fs` and `ctx.approval` declaration merges into scope for `ctx.get`.
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-user-approval'
// Brings the `ctx.settings` declaration merge into scope.
import type {} from '@deepseek-ai/dsh-settings'
// Brings the `ctx.dolphindbConsole` declaration merge into scope.
import type {} from './console.ts'

export const name = 'tool-dolphindb'
export const inject = ['tools', 'dolphindb', 'dolphindbConsole', 'settings']

/** Model-facing DolphinDB tool configuration. */
export interface Config {
  /** Default row limit passed to the provider when the model omits `limit`. */
  maxRows?: number
}

/** Schemastery configuration for the tool consumer. */
export const Config: z<Config> = z.object({
  maxRows: z.number().default(1_000),
})

/** The shared script-source arguments: exactly one of `script` or `file`, plus an optional target server. */
interface ScriptArgs {
  script?: string
  file?: string
  server?: string
}

/**
 * Break a single-line DolphinDB script at top-level commas (`, ` at paren/bracket
 * depth 0, outside string literals) so a long statement renders as readable
 * clauses instead of one unbroken line. Whitespace-only: it never changes the
 * script's meaning.
 */
function formatDolphinDbScript(script: string): string {
  let depth = 0
  let quote: '"' | "'" | undefined
  let out = ''
  let skipSpace = false
  for (const char of script) {
    if (skipSpace && char === ' ') {
      continue
    }
    skipSpace = false
    if (quote !== undefined) {
      out += char
      if (char === quote) quote = undefined
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      out += char
      continue
    }
    if (char === '(' || char === '[') {
      depth += 1
      out += char
      continue
    }
    if (char === ')' || char === ']') {
      depth -= 1
      out += char
      continue
    }
    if (char === ',' && depth === 0) {
      out += ',\n'
      skipSpace = true
      continue
    }
    out += char
  }
  return out
}

/**
 * Project the pending call into a generic card that shows the script verbatim as
 * a fenced code block, so the user can review it (especially before approving a
 * write). A `file` call shows the path instead, because a presenter is pure and
 * cannot read the file.
 * @param title - the card title (query vs write).
 * @param args - the model-supplied script source.
 * @returns the pending-call render intent.
 */
function presentScriptCall(title: string, args: ScriptArgs): ToolCallView {
  const titled = args.server === undefined ? title : `${title} @ ${args.server}`
  if (args.script !== undefined) {
    return {
      card: 'generic',
      title: titled,
      kind: 'execute',
      rawInput: args.script,
      content: [{ type: 'text', text: '```dolphindb\n' + formatDolphinDbScript(args.script) + '\n```' }],
    }
  }
  return {
    card: 'generic',
    title: `${titled}: ${args.file ?? ''}`,
    kind: 'execute',
    rawInput: args.file,
  }
}

/**
 * Provider-neutral chart request projected from a bounded result, persisted in
 * `presentationMeta.chartSpec` for a chart-capable UI to pick up.
 */
interface ChartSpec {
  type: 'line' | 'bar' | 'scatter' | 'area'
  x: Array<string | number>
  series: Array<{ name: string; values: number[] }>
}

/**
 * Project a bounded result plus the model's chart request into a provider-neutral
 * {@link ChartSpec}. Fails loud on an unknown chart type or a column name that is
 * not in the result, so a typo surfaces instead of a silently empty chart.
 * @param value - the query result to plot.
 * @param chart - the model's chart request (type, x column, series columns).
 * @returns the chart spec to hand a chart-capable UI.
 */
function buildChartSpec(value: DolphinDbResult, chart: { type?: string; x?: string; series?: string[] }): ChartSpec {
  if (chart.type !== 'line' && chart.type !== 'bar' && chart.type !== 'scatter' && chart.type !== 'area') {
    throw new Error(`dolphindb_query: chart.type must be line, bar, scatter, or area (got "${chart.type}")`)
  }
  if (chart.x === undefined) {
    throw new Error('dolphindb_query: chart.x (a column name) is required')
  }
  if (chart.series === undefined || chart.series.length === 0) {
    throw new Error('dolphindb_query: chart.series (at least one column name) is required')
  }
  const columnIndex = (name: string): number => {
    const index = value.columns.indexOf(name)
    if (index < 0) {
      throw new Error(`dolphindb_query: chart column "${name}" is not in the result columns [${value.columns.join(', ')}]`)
    }
    return index
  }
  const xIndex = columnIndex(chart.x)
  const x = value.rows.map(row => row[xIndex] as string | number)
  const series = chart.series.map((name) => {
    const index = columnIndex(name)
    return { name, values: value.rows.map(row => Number(row[index])) }
  })
  return { type: chart.type, x, series }
}

/** Render one cell as tab-separated text. */
function formatCell(cell: JsonValue): string {
  if (cell === null) return ''
  if (typeof cell === 'string') return cell
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell)
  return JSON.stringify(cell)
}

/** Project a bounded result into model-facing text: the target server, then a table or an executed notice. */
function renderResult(result: DolphinDbResult): string {
  if (result.executed) {
    return `Executed on ${result.server} in ${result.elapsedMs}ms.`
  }
  const lines = [`server: ${result.server}`, result.columns.join('\t')]
  for (const row of result.rows) {
    lines.push(row.map(formatCell).join('\t'))
  }
  if (result.truncated) {
    lines.push(`… (${result.rowCount} rows total, truncated)`)
  }
  return lines.join('\n')
}

/**
 * Resolve the script text from exactly one of `script` (inline) or `file` (read
 * through `ctx.fs`). Both may not be absent; both may not be present.
 * @param ctx - Cordis context carrying the filesystem seam.
 * @param args - the model-supplied script source.
 * @param signal - cancellation.
 * @returns the script text to execute.
 */
async function resolveScript(ctx: Context, args: ScriptArgs, signal: AbortSignal): Promise<string> {
  if (args.script !== undefined) return args.script
  if (args.file === undefined) {
    throw new Error('dolphindb: provide exactly one of "script" or "file"')
  }
  const fs = ctx.get('fs')
  if (fs === undefined) {
    throw new Error('dolphindb: "file" execution requires a filesystem provider (ctx.fs)')
  }
  const target = await fs.resolve(args.file, { signal })
  return await fs.readText(target, signal)
}

/** The canonical output schema shared by both execution tools. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    columns: { type: 'array', items: { type: 'string' } },
    rows: { type: 'array', items: { type: 'array', items: { type: 'json' } } },
    rowCount: { type: 'number' },
    truncated: { type: 'boolean' },
    elapsedMs: { type: 'number' },
    executed: { type: 'boolean' },
    server: { type: 'string' },
  },
} as const

/**
 * Register the `dolphindb_query` (read-only) and `dolphindb_execute` (write,
 * approval-gated) tools. The model supplies a DolphinDB script or SQL query; the
 * provider resolves and bounds the result, and this consumer renders it.
 * @param ctx - Cordis context carrying the tools registry, executor seam, and optional fs/approval seams.
 * @param config - the resolved tool config.
 */
export function apply(ctx: Context, config: Config): void {
  const maxRows = config.maxRows ?? 1_000

  ctx.tools.register(defineTool({
    name: 'dolphindb_query',
    description: 'Run a read-only DolphinDB script or SQL query and return tabular results. Use for time-series and analytics data. Provide exactly one of script (inline) or file (a .dos script path). Runs on the active server unless server names another configured server. To render the result as a chart, pass chart with a type (line, bar, scatter, area), the x column name, and the series column names.',
    parameters: {
      script: { type: 'string', description: 'DolphinDB script or SQL to execute (read-only)' },
      file: { type: 'string', description: 'Path to a .dos script file to run' },
      limit: { type: 'number', description: 'Maximum rows to return (default from configuration)' },
      server: { type: 'string', description: 'Target server name from the dolphindb settings registry (default: the active server)' },
      chart: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', description: 'Chart type: line, bar, scatter, or area' },
          x: { type: 'string', description: 'Column name for the x-axis' },
          series: { type: 'array', items: { type: 'string' }, description: 'Column names for the y-axis series' },
        },
      },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderResult(value as unknown as DolphinDbResult) }],
      presentationMeta: (args, value) => {
        const result = value as unknown as DolphinDbResult
        const meta: Record<string, unknown> = {}
        if (result.columns.length > 0) {
          meta.table = { columns: result.columns, rows: result.rows.map(row => row.map(formatCell)) }
        }
        if (args.chart !== undefined) {
          meta.chartSpec = buildChartSpec(result, args.chart)
        }
        // The meta is the persisted projection; both shapes are JSON by construction.
        return meta as unknown as JsonValue
      },
    },
    presentCall: args => presentScriptCall('DolphinDB query', args),
    async execute(args, exec) {
      const script = await resolveScript(ctx, args, exec.signal)
      const spec = ctx.dolphindb.resolve({
        script,
        limit: args.limit ?? maxRows,
        readOnly: true,
        ...args.server === undefined ? {} : { server: args.server },
      })
      return ctx.dolphindb.execute(spec, exec.signal)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dolphindb_execute',
    description: 'Run a DolphinDB script that may create, mutate, or drop data (DDL/DML, function definitions, writes). Requires user approval. Provide exactly one of script (inline) or file (a .dos script path). Runs on the active server unless server names another configured server.',
    parameters: {
      script: { type: 'string', description: 'DolphinDB script to execute (may write)' },
      file: { type: 'string', description: 'Path to a .dos script file to run' },
      server: { type: 'string', description: 'Target server name from the dolphindb settings registry (default: the active server)' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderResult(value as unknown as DolphinDbResult) }],
    },
    presentCall: args => presentScriptCall('DolphinDB write script', args),
    async execute(args, exec) {
      // Resolve the script BEFORE asking so a missing/unreadable file fails
      // before the user is prompted; the approval UI sees the script through
      // the pending-call card attached by callId.
      const script = await resolveScript(ctx, args, exec.signal)
      const approval = ctx.get('approval')
      if (approval === undefined) {
        throw new Error('dolphindb_execute requires an approval channel (ctx.approval) to run write scripts')
      }
      if (exec.agent === undefined) {
        throw new Error('dolphindb_execute requires an agent to route the approval through')
      }
      const spec = ctx.dolphindb.resolve({
        script,
        readOnly: false,
        ...args.server === undefined ? {} : { server: args.server },
      })
      const outcome = await approval.request({
        agent: exec.agent,
        toolName: 'dolphindb_execute',
        callId: exec.callId,
        reason: `Run a DolphinDB script that may create, mutate, or drop data on "${spec.server}".`,
        signal: exec.signal,
      })
      if (outcome !== 'allowed-once') {
        throw new Error(`dolphindb_execute: not approved (${outcome})`)
      }
      return ctx.dolphindb.execute(spec, exec.signal)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dolphindb_switch',
    description: 'Switch the active DolphinDB server environment. The active server is the default target of dolphindb_query and dolphindb_execute when they receive no explicit server argument. The selection persists in user settings and applies from the next call. For a one-off query on another server, prefer their server argument instead of switching.',
    parameters: {
      server: { type: 'string', required: true, description: 'Server name from the dolphindb settings registry to make active' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value as string }],
    },
    async execute(args) {
      const previous = ctx.dolphindb.activeServer()
      // The section's validate hook rejects an unknown server name; the write
      // persists to the user settings document and hot-applies.
      await ctx.settings.update('dolphindb', { active: args.server })
      return `Switched DolphinDB server: ${previous} → ${args.server}`
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dolphindb_cluster',
    description: 'Start or stop DolphinDB data/compute nodes in the cluster of the active server, through its controller. Requires user approval. Use dolphindb_query with getClusterPerf(true) to list node names, states, and modes first. Single-node deployments have no controller and reject this operation.',
    parameters: {
      action: { type: 'string', required: true, description: 'Node lifecycle action: "start" or "stop"' },
      nodes: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: 'Node aliases from getClusterPerf to start or stop (data/compute nodes only)',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value as string }],
    },
    presentCall: args => ({
      card: 'generic',
      title: `DolphinDB ${args.action === 'start' ? 'start' : 'stop'} nodes`,
      kind: 'execute',
      rawInput: (args.nodes as string[] | undefined)?.join(', '),
      content: [{ type: 'text', text: (args.nodes as string[] | undefined)?.map(name => `- ${name}`).join('\n') ?? '' }],
    }),
    async execute(args, exec) {
      if (args.action !== 'start' && args.action !== 'stop') {
        throw new Error(`dolphindb_cluster: action must be "start" or "stop" (got "${args.action}")`)
      }
      const nodes = args.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error('dolphindb_cluster: nodes must be a nonempty array of node aliases')
      }
      const approval = ctx.get('approval')
      if (approval === undefined) {
        throw new Error('dolphindb_cluster requires an approval channel (ctx.approval) to change node state')
      }
      if (exec.agent === undefined) {
        throw new Error('dolphindb_cluster requires an agent to route the approval through')
      }
      const outcome = await approval.request({
        agent: exec.agent,
        toolName: 'dolphindb_cluster',
        callId: exec.callId,
        reason: `${args.action === 'start' ? 'Start' : 'Stop'} ${nodes.length} DolphinDB node(s) on "${ctx.dolphindb.activeServer()}": ${nodes.join(', ')}`,
        signal: exec.signal,
      })
      if (outcome !== 'allowed-once') {
        throw new Error(`dolphindb_cluster: not approved (${outcome})`)
      }
      const request = { nodes: nodes as string[] }
      const result = args.action === 'start'
        ? await ctx.dolphindbConsole.startNodes(request, exec.signal)
        : await ctx.dolphindbConsole.stopNodes(request, exec.signal)
      return `${args.action === 'start' ? 'Started' : 'Stopped'} ${result.nodes.length} node(s) on ${result.server}: ${result.nodes.join(', ')} (${result.elapsedMs}ms)`
    },
  }))
}
