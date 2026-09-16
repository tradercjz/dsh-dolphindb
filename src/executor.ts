/**
 * Local Service Provider for the DolphinDB executor seam over the official
 * `dolphindb` WebSocket client. Owns connection lifecycle, credential
 * resolution, timeout, and result bounding. Execution policy (allow/deny/ask)
 * belongs in `tools/pre-execute`, not here.
 * @module @tradercjz/dsh-dolphindb
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DolphinDbExecutor } from './service.ts'
import type { DolphinDbQueryRequest, DolphinDbQuerySpec, DolphinDbResult, JsonValue } from './types.ts'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
// Brings the `ctx.settings` declaration merge into scope.
import type {} from '@deepseek-ai/dsh-settings'
import { DDB } from 'dolphindb'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8848
const DEFAULT_USERNAME = 'admin'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_ROWS = 1_000
const DEFAULT_MAX_BYTES = 512 * 1024

/** One named DolphinDB server in the registry. */
export interface ServerProfile {
  /** DolphinDB host. */
  host?: string
  /** DolphinDB port (default 8848). */
  port?: number
  /** DolphinDB login username (default `admin`). */
  username?: string
  /** Credential reference (an environment-variable name or a managed credential) holding the login password; resolved per connection. */
  passwordRef: string
}

/**
 * Plugin config: a named server registry, the active selection, and executor
 * caps. The same schema resolves the `dolphindb` settings section, whose user
 * layer merges over this composition entry per key.
 */
export interface Config {
  /** Named servers the executor may connect to. */
  servers?: Record<string, ServerProfile>
  /** Name of the server used when a request carries no explicit `server`. */
  active?: string
  /** Wall-clock query deadline in milliseconds. */
  timeoutMs?: number
  /** Upper bound on returned rows. */
  maxRows?: number
  /** Upper bound on the serialized result in bytes. */
  maxBytes?: number
}

/** A server profile after schemastery applies every field default. */
export type ResolvedServerProfile = Required<ServerProfile>

/** Config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`dolphindb: ${name} must be a positive finite number`)
  }
}

/**
 * Reject a resolved config this executor could not run with. The schema does not
 * express positivity or registry membership, so a stored value is refused where
 * it is written instead of failing at the next query.
 * @param config - the resolved config, schema-valid by construction.
 * @throws Error naming the field that cannot be used.
 */
export function assertServiceableConfig(config: Config): void {
  const resolved = config as ResolvedConfig
  assertPositiveFinite('timeoutMs', resolved.timeoutMs)
  assertPositiveFinite('maxRows', resolved.maxRows)
  assertPositiveFinite('maxBytes', resolved.maxBytes)
  for (const [name, profile] of Object.entries(resolved.servers)) {
    assertPositiveFinite(`servers.${name}.port`, (profile as ResolvedServerProfile).port)
    if (profile.passwordRef === '') {
      throw new Error(`dolphindb: servers.${name}.passwordRef is required`)
    }
  }
  const names = Object.keys(resolved.servers)
  if (names.length > 0 && resolved.servers[resolved.active] === undefined) {
    throw new Error(`dolphindb: active server "${resolved.active}" is not in servers [${names.join(', ')}]`)
  }
}

/**
 * Clamp a caller's requested row limit to the executor's configured maximum.
 * @param limit - the requested limit, or `undefined` for the configured maximum.
 * @param maxRows - the executor's configured row cap.
 * @returns the effective row cap, a positive integer no greater than `maxRows`.
 */
export function clampRows(limit: number | undefined, maxRows: number): number {
  if (limit === undefined) return maxRows
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('dolphindb: limit must be a positive integer')
  }
  return Math.min(Math.floor(limit), maxRows)
}

/** Convert a DolphinDB result value into a lossless-JSON snapshot (BigInt becomes a string). */
function snapshotJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(snapshotJson)
  // DolphinDB dictionaries and sets come back as `Map`/`Set`, not plain objects.
  if (value instanceof Map) {
    const out: Record<string, JsonValue> = {}
    for (const [key, entry] of value) out[String(key)] = snapshotJson(entry)
    return out
  }
  if (value instanceof Set) return Array.from(value).map(snapshotJson)
  if (typeof value === 'object') {
    // `Date` and Dayjs values expose `toJSON`, which yields an ISO string.
    const toJson = (value as { toJSON?: unknown }).toJSON
    if (typeof toJson === 'function') return snapshotJson((value as { toJSON(): unknown }).toJSON())
    const out: Record<string, JsonValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = snapshotJson(entry)
    }
    return out
  }
  // Remaining `undefined`, `symbol`, and `function` values are not lossless JSON.
  return null
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

/** Whether a value is a plain JSON record (not an array, `null`, or `undefined`). */
function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Project a raw DolphinDB result into a bounded {@link DolphinDbResult}. A table
 * (array of row objects) keeps its real column names; a matrix (array of arrays)
 * becomes columns `col0..colN-1`; a flat array becomes a single `value` column;
 * any other value becomes a single-cell row; `undefined` marks a statement/DDL/
 * write that produced no result (`executed: true`). `maxRows` and `maxBytes`
 * bound the complete result; `truncated` reports either.
 * @param raw - the value returned by the DolphinDB SDK.
 * @param maxRows - the row cap.
 * @param maxBytes - the serialized-byte cap.
 * @param elapsedMs - measured execution time.
 * @param server - the server the query ran on.
 * @returns the bounded result.
 */
export function normalizeResult(raw: unknown, maxRows: number, maxBytes: number, elapsedMs: number, server: string): DolphinDbResult {
  if (raw === undefined) {
    return { columns: [], rows: [], rowCount: 0, truncated: false, elapsedMs, executed: true, server }
  }
  const snapshot = snapshotJson(raw)
  let columns: string[] = ['value']
  let rows: JsonValue[][] = []
  if (Array.isArray(snapshot)) {
    const first = snapshot[0]
    if (Array.isArray(first)) {
      const matrix = snapshot as JsonValue[][]
      columns = Array.from({ length: first.length }, (_, index) => `col${index}`)
      rows = matrix
    } else if (isRecord(first)) {
      // A table comes back as an array of row objects: reuse the real column names.
      columns = Object.keys(first)
      rows = snapshot.map((entry) => {
        const record = entry as Record<string, JsonValue>
        return columns.map(column => record[column] ?? null)
      })
    } else {
      rows = snapshot.map(entry => [entry])
    }
  } else {
    rows = [[snapshot]]
  }

  const rowCount = rows.length
  let truncated = rowCount > maxRows
  rows = rows.slice(0, maxRows)

  // Apply the byte budget to the complete serialized payload, shrinking the tail.
  while (byteLength(JSON.stringify(rows)) > maxBytes && rows.length > 1) {
    rows = rows.slice(0, -1)
    truncated = true
  }

  return { columns, rows, rowCount, truncated, elapsedMs, executed: false, server }
}

class DolphinDbTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`dolphindb: query timed out after ${timeoutMs}ms`)
    this.name = 'DolphinDbTimeoutError'
  }
}

/**
 * Race a promise against a wall-clock deadline and an optional abort signal. The
 * DolphinDB SDK does not accept an `AbortSignal`, so the underlying message is
 * not cancelled in flight — only the caller's await is released.
 */
function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error ? reason : new Error('aborted')
}

async function withTimeout<T>(run: () => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DolphinDbTimeoutError(timeoutMs))
    }, timeoutMs)
    timer.unref()
  })
  const abort = signal === undefined
    ? new Promise<never>(() => {})
    : new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => {
        reject(abortReason(signal))
      }, { once: true })
    })
  try {
    return await Promise.race([run(), timeout, abort])
  } finally {
    /* v8 ignore next -- the `timeout` promise constructor runs synchronously, so `timer` is always assigned here. */
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * Local DolphinDB executor over the official `dolphindb` WebSocket client. The
 * connection is established lazily and torn down on composition disposal; a
 * timed-out or failed call drops the connection so a busy socket never poisons
 * the next query. The server registry and `active` selection live in the
 * `dolphindb` settings section when a settings provider is present (hot-applied,
 * user-editable); the composition entry is the fallback. Connections re-key on
 * the active profile, so a committed settings change takes effect on the next
 * execution without any listener.
 */
export class DolphinDbLocalExecutor extends DolphinDbExecutor {
  static inject = ['credentials']

  static Config: z<Config> = z.object({
    servers: z.dict(z.object({
      host: z.string().default(DEFAULT_HOST),
      port: z.number().default(DEFAULT_PORT),
      username: z.string().default(DEFAULT_USERNAME),
      passwordRef: z.string().role('credential-ref'),
    })).default({}),
    active: z.string().default('local'),
    timeoutMs: z.number().default(DEFAULT_TIMEOUT_MS),
    maxRows: z.number().default(DEFAULT_MAX_ROWS),
    maxBytes: z.number().default(DEFAULT_MAX_BYTES),
  })

  /** The validated composition entry (schemastery applied the defaults before construction). */
  private readonly fallback: ResolvedConfig
  /** The live config source: the settings projection when a provider is present, else the composition entry. */
  private current: () => ResolvedConfig

  private conn: DDB | undefined
  /** The registry name + connection parameters `conn` was opened for; any change reopens it. */
  private connKey: string | undefined

  constructor(ctx: Context, config: Config) {
    super(ctx)
    const entry = config as ResolvedConfig
    assertServiceableConfig(entry)
    this.fallback = entry
    this.current = () => this.fallback
    // Deferred inject, not ctx.get: loader entries activate concurrently, so a
    // construct-time read races the settings service and can silently skip the
    // section (which is exactly what the web settings card enumerates).
    ctx.inject(['settings'], (settingsCtx) => {
      settingsCtx.settings.installSection(ctx, 'dolphindb', DolphinDbLocalExecutor.Config, config, {
        setSource: (source) => {
          this.current = source as () => ResolvedConfig
        },
        // Connections re-key lazily in connect(), so a committed change needs no work here.
        onChange: () => {},
        validate: (value) => {
          assertServiceableConfig(value)
        },
      })
    })
    ctx.effect(() => () => {
      this.dropConnection()
    })
  }

  activeServer(): string {
    return this.current().active
  }

  resolve(request: DolphinDbQueryRequest): DolphinDbQuerySpec {
    const config = this.current()
    const server = request.server ?? config.active
    // Fail an unknown name here, where the caller can fix it, not mid-execution.
    this.profile(server)
    return {
      script: request.script,
      maxRows: clampRows(request.limit, config.maxRows),
      maxBytes: config.maxBytes,
      readOnly: request.readOnly ?? true,
      timeoutMs: config.timeoutMs,
      server,
    }
  }

  async execute(spec: DolphinDbQuerySpec, signal?: AbortSignal): Promise<DolphinDbResult> {
    const startedAt = Date.now()
    try {
      const conn = await this.connect(spec.server, signal)
      const raw = await withTimeout(() => conn.execute<unknown>(spec.script), spec.timeoutMs, signal)
      return normalizeResult(raw, spec.maxRows, spec.maxBytes, Date.now() - startedAt, spec.server)
    } catch (error) {
      // A timed-out or failed in-flight message can leave the socket busy; drop it.
      this.dropConnection()
      throw error
    }
  }

  /** Resolve a server's profile, failing loud on an unknown name or an empty registry. */
  private profile(server: string): ResolvedServerProfile {
    const servers = this.current().servers
    const profile = servers[server]
    if (profile === undefined) {
      const names = Object.keys(servers)
      if (names.length === 0) {
        throw new Error('dolphindb: no servers configured; add one to the "dolphindb" settings section or the executor cordis config')
      }
      throw new Error(`dolphindb: unknown server "${server}" (configured: [${names.join(', ')}])`)
    }
    return profile as ResolvedServerProfile
  }

  private async connect(server: string, signal?: AbortSignal): Promise<DDB> {
    const profile = this.profile(server)
    const key = JSON.stringify({ server, ...profile })
    if (this.conn !== undefined && this.connKey === key) return this.conn
    this.dropConnection()
    const password = await this.resolvePassword(profile)
    const ddb = new DDB(`ws://${profile.host}:${profile.port}`, {
      autologin: true,
      username: profile.username,
      password,
    })
    await withTimeout(() => ddb.connect(), this.current().timeoutMs, signal)
    this.conn = ddb
    this.connKey = key
    return ddb
  }

  private dropConnection(): void {
    this.conn?.disconnect()
    this.conn = undefined
    this.connKey = undefined
  }

  private async resolvePassword(profile: ResolvedServerProfile): Promise<string> {
    const resolved = await this.ctx.credentials.resolve(credentialRef(profile.passwordRef))
    if (resolved === undefined) {
      throw new Error(`dolphindb: credential "${profile.passwordRef}" is not configured`)
    }
    return resolved.value
  }
}

export default DolphinDbLocalExecutor
