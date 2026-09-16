/**
 * Service Definition for the `ctx.dolphindb` capability seam: one abstract query
 * executor. Providers own connection transport, credential resolution, and result
 * bounding; consumers own the model-facing tool. Credentials belong to
 * `@deepseek-ai/dsh-credentials` and are resolved per execution.
 * @module @tradercjz/dsh-dolphindb
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { DolphinDbQueryRequest, DolphinDbQuerySpec, DolphinDbResult } from './types.ts'

export type { DolphinDbQueryRequest, DolphinDbQuerySpec, DolphinDbResult, JsonValue } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    dolphindb: DolphinDbExecutor
  }
}

/**
 * Abstract DolphinDB query execution service. Subclass, implement the abstract
 * methods, and load the subclass as a plugin — it registers as `ctx.dolphindb`
 * (one implementation per context; a second throws, which is Cordis' standard
 * duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - {@link execute} rejects only for infrastructure failures (connect, missing
 *   credential, timeout, or cancellation); a bounded query result resolves.
 * - {@link resolve} fills the caller's optional fields from implementation-owned
 *   defaults and caps; {@link execute} never re-defaults.
 * - The result must be lossless JSON and bounded: `maxRows` and `maxBytes` apply
 *   to the complete result, and `truncated` reports any applied bound.
 */
export abstract class DolphinDbExecutor extends Service {
  constructor(ctx: Context) {
    super(ctx, 'dolphindb')
  }

  /**
   * Apply implementation-owned defaults and caps to a request before execution.
   * @param request - the caller's request; omitted fields get defaults, capped fields are clamped.
   * @returns the fully-specified spec to hand to {@link execute}.
   */
  abstract resolve(request: DolphinDbQueryRequest): DolphinDbQuerySpec

  /**
   * Run one resolved query and return a bounded lossless-JSON result.
   * @param spec - a resolved spec from {@link resolve}, never a raw request.
   * @param signal - cancellation; providers abort or reject when it fires.
   * @returns the bounded result.
   */
  abstract execute(spec: DolphinDbQuerySpec, signal?: AbortSignal): Promise<DolphinDbResult>

  /**
   * The name of the server that requests without an explicit `server` run on.
   * @returns the active server name from the provider's registry.
   */
  abstract activeServer(): string
}

export default DolphinDbExecutor
