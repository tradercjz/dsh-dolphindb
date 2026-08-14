/**
 * Bundled skill-tree scanning: walk a root directory for every folder holding
 * a `SKILL.md`, and parse each into a discovery candidate plus its loaded
 * definition. I/O happens here; parsing is delegated to {@link ./frontmatter}.
 * @module @tradercjz/dsh-dolphindb/src/scan
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BUNDLED_SKILL_RANK,
  isSkillName,
  type SkillCandidate,
  type SkillDefinition,
  type SkillInvocationPolicy,
} from '@deepseek-ai/dsh-skill'
import {
  optionalMetadata,
  optionalString,
  parseFrontmatter,
  parseInvocationPolicy,
  stringField,
  type Frontmatter,
} from './frontmatter.ts'

const SKILL_MD = 'SKILL.md'

/** One fully parsed bundled skill: its discovery candidate and its loaded body. */
export interface LoadedSkill {
  name: string
  candidate: SkillCandidate
  definition: SkillDefinition
}

/** A logging sink so the scanner stays decoupled from the plugin Context. */
export type SkillWarn = (message: string) => void

/**
 * Return every directory under `root` that contains a `SKILL.md`, recursing
 * through group directories that hold skills rather than one themselves.
 * @param root - the shipped skill tree root.
 * @returns the skill directories, in discovery (depth-first) order.
 */
export async function findSkillDirs(root: string): Promise<string[]> {
  const results: string[] = []
  const stack: string[] = [root]
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop()) {
    let hasSkill = false
    const children: string[] = []
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name === SKILL_MD) hasSkill = true
      else if (entry.isDirectory()) children.push(join(dir, entry.name))
    }
    if (hasSkill) results.push(dir)
    stack.push(...children)
  }
  return results
}

/**
 * Read and parse one skill directory's `SKILL.md` into a candidate + definition
 * pair. A missing or malformed file is skipped (warned) rather than failing
 * discovery, because the shipped tree is trusted but still file content read at
 * runtime.
 * @param dir - the skill directory holding `SKILL.md`.
 * @param warn - sink for per-skill skip diagnostics.
 * @returns the loaded skill, or `undefined` when the file is absent or malformed.
 */
export async function parseSkillFile(dir: string, warn: SkillWarn): Promise<LoadedSkill | undefined> {
  const path = join(dir, SKILL_MD)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    warn(`bundled skill ${path} ignored: unreadable`)
    return undefined
  }
  let parsed: Frontmatter | undefined
  try {
    parsed = parseFrontmatter(raw)
  } catch (error) {
    warn(`bundled skill ${path} ignored: invalid YAML frontmatter: ${errorMessage(error)}`)
    return undefined
  }
  if (parsed === undefined) {
    warn(`bundled skill ${path} ignored: missing YAML frontmatter`)
    return undefined
  }
  const name = stringField(parsed.data, 'name')
  const description = stringField(parsed.data, 'description')
  if (name === undefined || description === undefined || !isSkillName(name)) {
    warn(`bundled skill ${path} ignored: frontmatter requires name and description`)
    return undefined
  }
  let invocation: SkillInvocationPolicy
  try {
    invocation = parseInvocationPolicy(parsed.data)
  } catch (error) {
    warn(`bundled skill ${path} ignored: invalid invocation frontmatter: ${errorMessage(error)}`)
    return undefined
  }
  const resourceBase = { kind: 'directory', path: dir } as const
  const base = {
    name,
    description,
    ...optionalString(parsed.data, 'whenToUse'),
    invocation,
    ...optionalMetadata(parsed.data),
    provider: 'dolphindb',
    source: 'bundled' as const,
    resourceBase,
  }
  return {
    name,
    candidate: { ...base, rank: BUNDLED_SKILL_RANK, locator: path, path },
    definition: { ...base, content: parsed.body.trim(), path },
  }
}

function errorMessage(error: unknown): string {
  return String(error)
}
