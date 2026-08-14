/**
 * Package-owned invariant companion for `@tradercjz/dsh-dolphindb`.
 * @module @tradercjz/dsh-dolphindb/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@tradercjz/dsh-dolphindb'

/** Cordis companion plugin name. */
export const name = 'dolphindb-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the bundle owns one immutable provider registration and
 * two patch-mounted rows, while the skill registry and the loader own
 * registration uniqueness and lifecycle checks.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
