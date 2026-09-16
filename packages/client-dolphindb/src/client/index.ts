/**
 * DolphinDB settings card, browser half — one card in the plugin
 * configuration section, bound to the `dolphindb` settings namespace the Host
 * plugin registers. The card lists the server registry, switches the active
 * server, edits each server's connection fields, and sets or clears each
 * server's password through the credentials domain; the tab pairs the card
 * with the served namespace by key, so neither side learns what the namespace
 * means.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.settingsScope Context merge. Cross-plugin collaboration
// goes through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { DolphinDBCard } from './DolphinDBCard.tsx'
import { DOLPHINDB_NS, DolphinDBCardController, type DolphinDBSettings } from './dolphindb-card-controller.ts'
import { en, zh } from './locales.ts'

export type { DolphinDBCardProps } from './DolphinDBCard.tsx'
export type {
  DolphinDBAddDraft,
  DolphinDBCardFace,
  DolphinDBCardState,
  DolphinDBInvalidField,
  DolphinDBServerDraft,
  DolphinDBServerProfile,
  DolphinDBServerRow,
  DolphinDBSettings,
} from './dolphindb-card-controller.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.dolphindb'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'settingsScope']

/**
 * Mount the DolphinDB card into the plugin configuration section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dolphindb: card dictionaries')

  const card = new DolphinDBCardController(
    ctx.settingsScope.bind<DolphinDBSettings>({ namespace: DOLPHINDB_NS }),
    ctx,
  )

  // The password a card reports is not part of any settings section, so its
  // scope publishes nothing when one is written. This is the only signal that
  // a password written on another surface reached the Host.
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref) => { card.refreshCredential(ref) }),
    'dolphindb: credential invalidations',
  )

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: DOLPHINDB_NS,
    locale: NS,
    inject: () => card.inject(),
  }, DolphinDBCard))
}
