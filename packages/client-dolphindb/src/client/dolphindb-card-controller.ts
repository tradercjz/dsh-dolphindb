/**
 * The DolphinDB card's staged forms over the `dolphindb` settings namespace.
 *
 * The card edits a server registry rather than flat fields, so instead of one
 * section-wide form it stages per-server drafts: connection fields are written
 * as path ops (`['servers', name, field]`) and a new server as a whole registry
 * entry. Each server's password is staged with the form that sets it — one
 * submit writes the section and the credential together, and a blank password
 * draft writes nothing, which keeps the stored one. The password literal never
 * rides a response: the card learns only whether one is configured and writes
 * it through the credentials domain, addressed by the reference the section
 * names. Clearing a password stays its own deliberate gesture.
 *
 * The section snapshot stays the single authority: every write awaits the
 * scope's settlement (its recovery read included) and the outcome is read back
 * from the section and a fresh credential describe rather than predicted, so a
 * rejected write keeps its drafts for correction instead of pretending to have
 * landed.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face into
// this program. Cross-plugin collaboration goes through the service, never a
// value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'

/** Settings namespace of the DolphinDB Host plugin. */
export const DOLPHINDB_NS = 'dolphindb'

/** One registered DolphinDB server, as the settings section stores it. */
export type DolphinDBServerProfile = {
  /** Server hostname or address. */
  host: string
  /** Server port. */
  port: number
  /** Login user. */
  username: string
  /** Credential reference the password is written through; the value never rides a response. */
  passwordRef: string
}

/** The `dolphindb` settings namespace value the Host serves. */
export interface DolphinDBSettings {
  /** Server registry, keyed by server name. */
  servers: Record<string, DolphinDBServerProfile>
  /** Name of the server the tools connect to; always a key of {@link servers}. */
  active: string
  /** Query timeout budget (not edited by this card). */
  timeoutMs: number
  /** Result row cap (not edited by this card). */
  maxRows: number
  /** Result byte cap (not edited by this card). */
  maxBytes: number
}

/** Connection-field and password drafts staged for one server. */
export interface DolphinDBServerDraft {
  /** Draft host text. */
  host: string
  /** Draft port text; parsed only when the save runs. */
  port: string
  /** Draft username text. */
  username: string
  /** Draft password text; blank until typed, and a blank draft writes nothing. */
  password: string
}

/** Which form field blocks a save, when one does. */
export type DolphinDBInvalidField = 'name' | 'host' | 'port' | 'username'

/** One server as the card renders it. */
export interface DolphinDBServerRow {
  /** Registry key. */
  name: string
  /** Stored host. */
  host: string
  /** Stored port. */
  port: number
  /** Stored username. */
  username: string
  /** Whether the tools currently connect to this server. */
  active: boolean
  /** Whether the connection fields are open for editing. */
  editing: boolean
  /** Staged connection fields and password while editing; undefined when the row is closed. */
  draft: DolphinDBServerDraft | undefined
  /** The first field whose draft is not a value the save accepts, when one stands. */
  invalidField: DolphinDBInvalidField | undefined
  /** Whether a save would change anything (a staged password counts); false disables the save. */
  draftDirty: boolean
  /** Whether this row's save is crossing the wire. */
  saving: boolean
  /** Whether the Host reports a password configured for this server's reference. */
  passwordConfigured: boolean
  /** Whether the credentials domain accepts a write for the reference. */
  passwordWritable: boolean
  /** Whether this row's password clear is crossing the wire. */
  passwordBusy: boolean
}

/** Drafts of the add-a-server form. */
export interface DolphinDBAddDraft {
  /** Draft server name. */
  name: string
  /** Draft host text. */
  host: string
  /** Draft port text. */
  port: string
  /** Draft username text. */
  username: string
  /** Draft password text; optional, and a blank draft sets no credential. */
  password: string
}

/** What the DolphinDB card renders. */
export interface DolphinDBCardState {
  /** False while the namespace is not served to this client; the card renders nothing. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Registered servers, name-sorted. */
  servers: DolphinDBServerRow[]
  /** The add-a-server form's drafts. */
  addDraft: DolphinDBAddDraft
  /** Credential reference the add form's password would be written to; undefined while the name is blank. */
  addPasswordRef: string | undefined
  /** The first add-form field blocking the add, when one stands. */
  addInvalidField: DolphinDBInvalidField | undefined
  /** Whether an add is crossing the wire. */
  adding: boolean
  /** Whether the last write did not land as staged; cleared by the next edit or write. */
  failed: boolean
}

/** The registration-side face the card's slot entry injects. */
export interface DolphinDBCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useDolphinDBCard. */
    dolphinDBCard: SnapshotStore<DolphinDBCardState>
  }
  /** Make one server the one the tools connect to. */
  setActive: (name: string) => void
  /** Open a server's connection fields for editing, seeded from the section. */
  startEdit: (name: string) => void
  /** Drop a server's staged edits. */
  cancelEdit: (name: string) => void
  /** Stage one connection-field or password draft of one server. */
  stageServerField: (name: string, field: 'host' | 'port' | 'username' | 'password', text: string) => void
  /** Write one server's staged connection fields and, when staged, its password. */
  saveServer: (name: string) => void
  /** Remove one server from the registry; the active server refuses. */
  removeServer: (name: string) => void
  /** Clear one server's stored password through the credentials domain. */
  clearPassword: (name: string) => void
  /** Stage one add-form draft. */
  stageAddField: (field: 'name' | 'host' | 'port' | 'username' | 'password', text: string) => void
  /**
   * Register the add form's server and, when a password is staged, write it to
   * the derived reference; the first registered server becomes active.
   */
  addServer: () => void
}

/** What the credentials domain last reported for one reference. */
interface CredentialState {
  /** Whether any layer supplies a value for the reference. */
  configured: boolean
  /** Whether `credentials/set` can affect it; false disables the control. */
  writable: boolean
}

const EMPTY_CREDENTIAL: CredentialState = { configured: false, writable: true }

const EMPTY_ADD_DRAFT: DolphinDBAddDraft = { name: '', host: '', port: '', username: '', password: '' }

/** Parse a draft port; undefined when the text is not a whole number in range. */
function parsePort(text: string): number | undefined {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return undefined
  const port = Number(trimmed)
  return port >= 1 && port <= 65535 ? port : undefined
}

/**
 * The credential reference a server registered from this card names. The
 * grammar is the credentials domain's (`/^[A-Za-z_][A-Za-z0-9_]*$/`), so the
 * name is folded into uppercase identifier characters behind a fixed prefix.
 * @param name - the server name as registered.
 * @returns the reference addressing that server's password.
 */
export function passwordRefFor(name: string): string {
  const suffix = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `DOLPHINDB_PASSWORD_${suffix === '' ? 'SERVER' : suffix}`
}

/** Bridges the `dolphindb` scope and the credentials domain onto the card. */
export class DolphinDBCardController {
  private readonly store: SnapshotStore<DolphinDBCardState>
  private last: DolphinDBCardState | undefined
  private readonly edits = new Map<string, DolphinDBServerDraft>()
  private readonly savingProfiles = new Set<string>()
  private readonly busyPasswords = new Set<string>()
  private readonly credentials = new Map<string, CredentialState>()
  private describeGeneration = 0
  private addDraft: DolphinDBAddDraft = { ...EMPTY_ADD_DRAFT }
  private adding = false
  private failed = false

  /**
   * @param scope - the bound settings scope for the `dolphindb` namespace.
   * @param ctx - the card plugin's context, whose `remote.credentials` namespace
   * answers for the password each server references.
   */
  constructor(
    private readonly scope: SettingsScope<DolphinDBSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.last = this.store.getSnapshot()
    scope.subscribe(() => {
      this.publish()
      // A new section can rename servers or their references; the badges
      // answering for the old set would claim states nobody has checked.
      void this.describeCredentials()
    })
    void this.describeCredentials()
  }

  /**
   * Re-read after the Host reports a change to a reference this card watches.
   * A password can be written from another surface, and the settings section
   * does not change when one is, so without this a badge keeps reporting a
   * state the Host already replaced.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (!this.passwordRefs().includes(ref)) return
    void this.describeCredentials()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its actions.
   */
  inject(): DolphinDBCardFace {
    return {
      hooks: { dolphinDBCard: this.store },
      setActive: (name) => { this.setActive(name) },
      startEdit: (name) => { this.startEdit(name) },
      cancelEdit: (name) => { this.cancelEdit(name) },
      stageServerField: (name, field, text) => { this.stageServerField(name, field, text) },
      saveServer: (name) => { void this.saveServer(name) },
      removeServer: (name) => { void this.removeServer(name) },
      clearPassword: (name) => { void this.clearPassword(name) },
      stageAddField: (field, text) => { this.stageAddField(field, text) },
      addServer: () => { void this.addServer() },
    }
  }

  private projection(): DolphinDBCardState {
    const snapshot = this.scope.getSnapshot()
    const section = snapshot.value
    const servers: DolphinDBServerRow[] = []
    if (section !== undefined) {
      for (const [name, profile] of Object.entries(section.servers ?? {})) {
        const draft = this.edits.get(name)
        const credential = this.credentials.get(profile.passwordRef) ?? EMPTY_CREDENTIAL
        const parsedPort = draft === undefined ? undefined : parsePort(draft.port)
        servers.push({
          name,
          host: profile.host,
          port: profile.port,
          username: profile.username,
          active: name === section.active,
          editing: draft !== undefined,
          draft: draft === undefined ? undefined : { ...draft },
          invalidField: draft === undefined ? undefined : firstInvalidField(draft),
          draftDirty: draft !== undefined
            && (draft.host.trim() !== profile.host
              || draft.username.trim() !== profile.username
              || parsedPort !== profile.port
              || draft.password.trim() !== ''),
          saving: this.savingProfiles.has(name),
          passwordConfigured: credential.configured,
          passwordWritable: credential.writable,
          passwordBusy: this.busyPasswords.has(name),
        })
      }
      servers.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    }
    const addName = this.addDraft.name.trim()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      servers,
      addDraft: { ...this.addDraft },
      addPasswordRef: addName === '' ? undefined : passwordRefFor(addName),
      addInvalidField: this.addInvalidField(),
      adding: this.adding,
      failed: this.failed,
    }
  }

  /** The first add-form field that blocks the add, when one stands. */
  private addInvalidField(): DolphinDBInvalidField | undefined {
    const servers = this.scope.getSnapshot().value?.servers ?? {}
    const name = this.addDraft.name.trim()
    if (name === '' || Object.hasOwn(servers, name)) return 'name'
    if (this.addDraft.host.trim() === '') return 'host'
    if (parsePort(this.addDraft.port) === undefined) return 'port'
    if (this.addDraft.username.trim() === '') return 'username'
    return undefined
  }

  private profile(name: string): DolphinDBServerProfile | undefined {
    return this.scope.getSnapshot().value?.servers?.[name]
  }

  private passwordRefs(): string[] {
    const servers = this.scope.getSnapshot().value?.servers ?? {}
    return Object.values(servers).map(profile => profile.passwordRef)
  }

  /**
   * Ask the credentials domain about every reference the section currently
   * names, in one batch. Out-of-order settles are dropped by generation: a
   * response is published only while it still answers for the read in force.
   */
  private async describeCredentials(): Promise<void> {
    const generation = ++this.describeGeneration
    const refs = this.passwordRefs()
    if (refs.length === 0) {
      this.credentials.clear()
      this.publish()
      return
    }
    const response = await this.ctx.remote.credentials.describe(refs)
    if (!response.ok || generation !== this.describeGeneration) return
    for (const ref of refs) {
      const view = response.value[ref]
      this.credentials.set(ref, {
        configured: view?.configured ?? false,
        // An unknown reference is treated as writable: the control stays usable
        // and the Host is what refuses, rather than the card guessing a refusal.
        writable: view?.writable ?? true,
      })
    }
    this.publish()
  }

  private setActive(name: string): void {
    const section = this.scope.getSnapshot().value
    if (section === undefined || name === section.active || !Object.hasOwn(section.servers, name)) return
    this.failed = false
    void this.scope.set('active', name)
  }

  private startEdit(name: string): void {
    const profile = this.profile(name)
    if (profile === undefined || this.edits.has(name)) return
    this.edits.set(name, { host: profile.host, port: String(profile.port), username: profile.username, password: '' })
    this.failed = false
    this.publish()
  }

  private cancelEdit(name: string): void {
    if (!this.edits.delete(name)) return
    this.publish()
  }

  private stageServerField(name: string, field: 'host' | 'port' | 'username' | 'password', text: string): void {
    const draft = this.edits.get(name)
    if (draft === undefined) return
    draft[field] = text
    this.failed = false
    this.publish()
  }

  /**
   * Write one server's staged connection fields as path ops and its staged
   * password through the credentials domain — one save covers the whole form.
   * Outcomes are read back from the section and a fresh describe; a save that
   * did not land keeps its drafts.
   */
  private async saveServer(name: string): Promise<void> {
    const draft = this.edits.get(name)
    const profile = this.profile(name)
    if (draft === undefined || profile === undefined || this.savingProfiles.has(name)) return
    const host = draft.host.trim()
    const username = draft.username.trim()
    const port = parsePort(draft.port)
    if (host === '' || username === '' || port === undefined) return
    const password = draft.password.trim()
    const ops: SettingsPathOpView[] = []
    if (host !== profile.host) ops.push({ op: 'set', path: ['servers', name, 'host'], value: host })
    if (port !== profile.port) ops.push({ op: 'set', path: ['servers', name, 'port'], value: port })
    if (username !== profile.username) ops.push({ op: 'set', path: ['servers', name, 'username'], value: username })
    if (ops.length === 0 && password === '') {
      this.edits.delete(name)
      this.publish()
      return
    }
    this.savingProfiles.add(name)
    this.failed = false
    this.publish()
    let landed = true
    if (ops.length > 0) {
      await this.scope.mutate(ops)
      const accepted = this.profile(name)
      landed = accepted !== undefined
        && accepted.host === host && accepted.port === port && accepted.username === username
    }
    if (password !== '') {
      // Refusals surface through the re-read: the Host is the only authority
      // on whether the password now exists.
      await this.ctx.remote.credentials.set(profile.passwordRef, password)
      await this.describeCredentials()
      landed = (this.credentials.get(profile.passwordRef)?.configured ?? false) && landed
    }
    this.savingProfiles.delete(name)
    if (landed) this.edits.delete(name)
    this.failed = !landed
    this.publish()
  }

  /** Remove one registry entry; the active server is refused before any write. */
  private async removeServer(name: string): Promise<void> {
    const section = this.scope.getSnapshot().value
    if (section === undefined || name === section.active || this.savingProfiles.has(name)) return
    this.savingProfiles.add(name)
    this.failed = false
    this.publish()
    await this.scope.mutate([{ op: 'unset', path: ['servers', name] }])
    this.savingProfiles.delete(name)
    const landed = this.profile(name) === undefined
    if (landed) this.edits.delete(name)
    this.failed = !landed
    this.publish()
  }

  /** Clear the stored password, then re-read the badge from the Host. */
  private async clearPassword(name: string): Promise<void> {
    const profile = this.profile(name)
    if (profile === undefined || this.busyPasswords.has(name)) return
    this.busyPasswords.add(name)
    this.failed = false
    this.publish()
    await this.ctx.remote.credentials.unset(profile.passwordRef)
    this.busyPasswords.delete(name)
    await this.describeCredentials()
  }

  private stageAddField(field: 'name' | 'host' | 'port' | 'username' | 'password', text: string): void {
    this.addDraft[field] = text
    this.failed = false
    this.publish()
  }

  /**
   * Register the add form's server as one whole registry entry, then write the
   * staged password to the derived reference when one stands — one add covers
   * the whole form. When the section's active name is not a registered server
   * (an empty registry is the case that matters), the new server becomes
   * active in the same mutation, so the section's active-always-a-key
   * invariant holds atomically.
   */
  private async addServer(): Promise<void> {
    const section = this.scope.getSnapshot().value
    if (section === undefined || this.adding) return
    const name = this.addDraft.name.trim()
    const host = this.addDraft.host.trim()
    const username = this.addDraft.username.trim()
    const port = parsePort(this.addDraft.port)
    if (name === '' || Object.hasOwn(section.servers, name)
      || host === '' || username === '' || port === undefined) return
    const password = this.addDraft.password.trim()
    const profile: DolphinDBServerProfile = { host, port, username, passwordRef: passwordRefFor(name) }
    const ops: SettingsPathOpView[] = [{ op: 'set', path: ['servers', name], value: profile }]
    if (!Object.hasOwn(section.servers, section.active)) {
      ops.push({ op: 'set', path: ['active'], value: name })
    }
    this.adding = true
    this.failed = false
    this.publish()
    await this.scope.mutate(ops)
    let landed = this.profile(name) !== undefined
    if (password !== '') {
      await this.ctx.remote.credentials.set(profile.passwordRef, password)
      await this.describeCredentials()
      landed = (this.credentials.get(profile.passwordRef)?.configured ?? false) && landed
    }
    this.adding = false
    if (landed) this.addDraft = { ...EMPTY_ADD_DRAFT }
    this.failed = !landed
    this.publish()
  }

  /** Publish a rebuilt projection, keeping the snapshot reference while no rendered fact moved. */
  private publish(): void {
    const next = this.projection()
    if (this.last !== undefined && sameCardState(this.last, next)) return
    this.last = next
    this.store.set(next)
  }
}

/** The first staged field that is not a value the save accepts, when one stands. */
function firstInvalidField(draft: DolphinDBServerDraft): DolphinDBInvalidField | undefined {
  if (draft.host.trim() === '') return 'host'
  if (parsePort(draft.port) === undefined) return 'port'
  if (draft.username.trim() === '') return 'username'
  return undefined
}

/** Shallow comparison over every rendered fact; rows compare field by field. */
function sameCardState(left: DolphinDBCardState, right: DolphinDBCardState): boolean {
  if (left.available !== right.available || left.writable !== right.writable
    || left.adding !== right.adding || left.failed !== right.failed
    || left.addInvalidField !== right.addInvalidField
    || left.addPasswordRef !== right.addPasswordRef
    || left.servers.length !== right.servers.length) return false
  if (left.addDraft.name !== right.addDraft.name || left.addDraft.host !== right.addDraft.host
    || left.addDraft.port !== right.addDraft.port || left.addDraft.username !== right.addDraft.username
    || left.addDraft.password !== right.addDraft.password) return false
  for (let index = 0; index < left.servers.length; index += 1) {
    const a = left.servers[index] as DolphinDBServerRow
    const b = right.servers[index] as DolphinDBServerRow
    if (a.name !== b.name || a.host !== b.host || a.port !== b.port || a.username !== b.username
      || a.active !== b.active || a.editing !== b.editing || a.invalidField !== b.invalidField
      || a.draftDirty !== b.draftDirty || a.saving !== b.saving
      || a.passwordConfigured !== b.passwordConfigured
      || a.passwordWritable !== b.passwordWritable || a.passwordBusy !== b.passwordBusy) return false
    if (a.draft === undefined || b.draft === undefined) {
      if (a.draft !== b.draft) return false
    } else if (a.draft.host !== b.draft.host || a.draft.port !== b.draft.port
      || a.draft.username !== b.draft.username || a.draft.password !== b.draft.password) {
      return false
    }
  }
  return true
}
