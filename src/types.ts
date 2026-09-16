/**
 * Request/spec/result vocabulary for the DolphinDB query executor seam.
 * @module dsh-dolphindb/types
 */

/** A caller's query REQUEST: optional fields are filled by `resolve()`. */
export interface DolphinDbQueryRequest {
  /** DolphinDB script or SQL to execute. */
  script: string
  /** Requested row cap; implementations clamp it to their configured maximum. */
  limit?: number
  /** Read-only marker consumed by approval policy; defaults to `true` in providers. */
  readOnly?: boolean
  /** Target server name from the configured registry; defaults to the active server. */
  server?: string
}

/** A fully-resolved, execution-ready query SPEC (never a raw request). */
export interface DolphinDbQuerySpec {
  /** The exact script to execute. */
  script: string
  /** Upper bound on returned rows, applied to the complete result. */
  maxRows: number
  /** Upper bound on the serialized result in bytes. */
  maxBytes: number
  /** Whether the query is read-only. */
  readOnly: boolean
  /** Wall-clock deadline in milliseconds. */
  timeoutMs: number
  /** The server this spec targets (request override or the active server at resolve time). */
  server: string
}

/** A lossless JSON value; mirrors the session vocabulary without importing it. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** A bounded, lossless-JSON query result. */
export interface DolphinDbResult {
  /** Column names; a single `value` column for scalar/vector results. */
  columns: string[]
  /** Row-major cells, each a JSON-safe value. */
  rows: JsonValue[][]
  /** Number of rows the query produced before bounding. */
  rowCount: number
  /** Whether `rows` or the byte budget was applied. */
  truncated: boolean
  /** Wall-clock execution time in milliseconds. */
  elapsedMs: number
  /** True when the script ran successfully but returned no value (statement/DDL/write). */
  executed: boolean
  /** The server the query ran on (from the spec), so results and logs name their target. */
  server: string
}
