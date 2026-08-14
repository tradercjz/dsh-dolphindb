/**
 * Frontmatter parsing for bundled DolphinDB skills: the `---`-delimited YAML
 * block each `SKILL.md` opens with, plus the field extraction the provider
 * needs (name, description, optional whenToUse/metadata, invocation booleans).
 * Pure functions — no I/O, no Context — so every branch is unit-testable.
 * @module @tradercjz/dsh-dolphindb/src/frontmatter
 */

import type { SkillInvocationPolicy } from '@deepseek-ai/dsh-skill'
import { parse as parseYaml } from 'yaml'

/** One parsed skill file: its frontmatter data plus the Markdown body after it. */
export interface Frontmatter {
  data: Record<string, unknown>
  body: string
}

/**
 * Extract a `---`-delimited YAML frontmatter block from a skill body.
 * @param raw - the whole `SKILL.md` text.
 * @returns the frontmatter data and remaining body, or `undefined` when the
 *   block is absent or malformed.
 */
export function parseFrontmatter(raw: string): Frontmatter | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  const start = firstLineEnd + 1
  const closing = findClosingFrontmatter(raw, start)
  if (closing === undefined) return undefined
  const parsed = parseYaml(raw.slice(start, closing.start)) as unknown
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  return { data: parsed as Record<string, unknown>, body: raw.slice(closing.bodyStart) }
}

/** Locate the closing `---` line that ends a frontmatter block started at `start`. */
export function findClosingFrontmatter(raw: string, start: number): { start: number; bodyStart: number } | undefined {
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
}

/** Return a non-empty string frontmatter value, or `undefined`. */
export function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Wrap a non-empty string frontmatter value as an optional `whenToUse` property. */
export function optionalString(data: Record<string, unknown>, key: string): { whenToUse?: string } {
  const value = stringField(data, key)
  return value === undefined ? {} : { whenToUse: value }
}

/** Wrap a non-null object `metadata` frontmatter value as an optional property. */
export function optionalMetadata(data: Record<string, unknown>): { metadata?: Record<string, unknown> } {
  const value = data.metadata
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { metadata: value as Record<string, unknown> }
    : {}
}

/** Resolve the model/user invocation controls from the two canonical boolean frontmatter keys. */
export function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationPolicy {
  return {
    modelInvocable: frontmatterBoolean(data, 'disable-model-invocation') !== true,
    userInvocable: frontmatterBoolean(data, 'user-invocable') !== false,
  }
}

/**
 * Read a canonical boolean frontmatter value: `undefined` when absent, the
 * value when boolean, otherwise a TypeError (the shipped tree is trusted, so a
 * non-boolean here is a packaging error, not something to coerce).
 * @param data - parsed frontmatter.
 * @param key - the boolean key to read.
 * @returns the boolean, or `undefined` when the key is absent.
 */
export function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value === 'boolean') return value
  throw new TypeError(`frontmatter field "${key}" must be a boolean`)
}
