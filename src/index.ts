/**
 * @tradercjz/dsh-dolphindb — the DolphinDB integration bundle's runtime glue
 * plugin plus the bundle patch (`cordis.patch.yml`, declared by the
 * `dsh.bundle.patch` manifest field). The plugin owns the bundled DolphinDB
 * skills: it registers a `bundled`-source provider on `ctx.skills` that scans
 * this package's shipped `assets/skills/` tree (workspace knowledge, never user
 * config). The bundle patch mounts the executor and the tool rows.
 * @module @tradercjz/dsh-dolphindb
 */

import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillProvider } from '@deepseek-ai/dsh-skill'
import { findSkillDirs, parseSkillFile, type LoadedSkill, type SkillWarn } from './scan.ts'

/** Unique provider name in the `ctx.skills` registry. */
const PROVIDER_NAME = 'dolphindb'
/** Shipped skill tree: every directory under this root that holds a `SKILL.md` is one skill. */
const SKILLS_ROOT = fileURLToPath(new URL('../assets/skills/', import.meta.url))

/** Stable Cordis plugin name. */
export const name = 'dolphindb'
/** The skill registry this provider registers into. */
export const inject = ['skills']

/**
 * Register the bundled DolphinDB skills provider. Registration is an effect:
 * the returned disposer unregisters the provider when the bundle's fiber
 * disposes (the HMR-safety contract).
 * @param ctx - the plugin context carrying the `skills` registry.
 */
export function apply(ctx: Context): void {
  ctx.skills.registerProvider(() => createProvider(ctx))
}

/** Build the provider with a per-registration catalog cache and a logger bound to this context. */
function createProvider(ctx: Context): SkillProvider {
  let loaded: Promise<LoadedSkill[]> | undefined
  const load = (): Promise<LoadedSkill[]> => {
    if (loaded === undefined) loaded = loadAll(ctx)
    return loaded
  }
  return {
    name: PROVIDER_NAME,
    async list() {
      return (await load()).map(skill => skill.candidate)
    },
    async get(candidate) {
      const skill = (await load()).find(item => item.name === candidate.name)
      return skill?.definition
    },
  }
}

/** Scan the shipped tree, parse every skill, and sort deterministically by name. */
async function loadAll(ctx: Context): Promise<LoadedSkill[]> {
  const warn: SkillWarn = ctx.logger.warn
  const skills: LoadedSkill[] = []
  for (const dir of await findSkillDirs(SKILLS_ROOT)) {
    const skill = await parseSkillFile(dir, warn)
    /* v8 ignore next -- the shipped tree parses cleanly; the skip branch is covered in scan.spec.ts */
    if (skill === undefined) continue
    skills.push(skill)
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}
