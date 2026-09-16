/**
 * The bundle's substance is its patch file: the `dsh.bundle.patch` manifest
 * field must name a real, parseable patch list that mounts the executor, the
 * tools, and the bundled-skills glue row — and never a literal credential.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

interface PatchRow {
  id?: string
  name?: string
  config?: Record<string, unknown>
}

function rowsOf(): PatchRow[] {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    dsh?: { bundle?: { patch?: string } }
  }
  expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  const parsed = parseYaml(
    readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
  ) as Array<{ insert?: PatchRow[] }> | undefined
  if (!Array.isArray(parsed)) throw new TypeError('bundle patch must parse to a patch list')
  return parsed.flatMap(entry => entry.insert ?? [])
}

describe('dsh-dolphindb bundle patch', () => {
  it('mounts the executor, the tool, and the skills glue row', () => {
    const rows = rowsOf()
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dolphindb', name: '@tradercjz/dsh-dolphindb/executor' }),
      expect.objectContaining({ id: 'tool-dolphindb', name: '@tradercjz/dsh-dolphindb/tool' }),
      expect.objectContaining({ id: 'dolphindb-console', name: '@tradercjz/dsh-dolphindb/console' }),
      expect.objectContaining({ id: 'dolphin-skills', name: '@tradercjz/dsh-dolphindb' }),
    ]))
  })

  it('references the password by credential name, never a literal', () => {
    const executor = rowsOf().find(row => row.id === 'dolphindb')
    const servers = executor?.config?.servers as Record<string, Record<string, unknown>> | undefined
    expect(servers?.local?.passwordRef).toBe('DOLPHINDB_PASSWORD')
    expect(servers?.local !== undefined && Object.keys(servers.local)).toEqual(['passwordRef'])
  })
})
