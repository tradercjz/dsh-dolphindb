/**
 * The `settings.plugin.item` slot type as this package consumes it — one
 * plugin's card inside the configurable-plugins tab, keyed by the settings
 * namespace the card edits. The slot is DECLARED at runtime by the settings
 * plugins package (its ConfigurablePluginsTab owns the children declaration);
 * this merge only re-states the contract so this package compiles without a
 * cross-plugin value import. A card registers under the key of the namespace
 * its Host plugin serves, and the tab pairs the two without either side
 * learning what the namespace means.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One plugin's card inside the plugin configuration section (see module JSDoc). */
    'settings.plugin.item': { kind: 'keyed'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}
