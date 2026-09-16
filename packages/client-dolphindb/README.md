# @tradercjz/dsh-client-dolphindb

The DolphinDB settings card for the [dsh](https://github.com/deepseek-ai/deepseek-harness) web GUI. It contributes one card to **Settings → Plugins → Plugin configuration**, bound to the `dolphindb` settings namespace the Host plugin registers. The card:

- lists the registered servers with name, `host:port`, username, the active mark, and a password-configured badge;
- switches the active server (a radio writes the `active` field directly);
- edits each server's host/port/username through staged drafts written as path ops (`['servers', name, field]`) on save, with the password staged in the same form — one save writes the section fields and, when a password was typed, the credential together (blank keeps the stored password; Clear stays a separate deliberate action);
- registers a new server as one whole registry entry with an optional password written to the derived reference in the same submit (the first registered server also becomes active, atomically), and removes one (the active server refuses).

## Architecture

The package follows the harness's UI plugin package shape (see `packages/client/AGENTS.md` in deepseek-harness):

- `src/index.ts` — the node half: an empty `apply` so the plugin can appear in a cordis profile.
- `src/client/index.ts` — the browser half: registers the locale dictionaries, constructs the card controller over `ctx.settingsScope.bind({ namespace: 'dolphindb' })`, subscribes `credentials/reference-updated`, and registers the card into the `settings.plugin.item` slot under the namespace key.
- `src/client/dolphindb-card-controller.ts` — the staged forms: per-server drafts, the add form, credential describes, and every write (settings `mutate`/`set` and `credentials.set`/`unset`). The section snapshot is the single authority; write outcomes are read back from it.
- `src/client/DolphinDBCard.tsx`, `src/client/rows.tsx`, `src/client/DolphinDBCard.module.css` — pure presentation; all data and callbacks arrive through the slot props shares.
- `src/client/slot-contract.ts` — re-states the `settings.plugin.item` SlotMap contract (declared at runtime by the settings plugins package) without a cross-plugin value import.
- `tsdown.config.ts` — a package-local replica of the harness's unpublished `clientBundle` preset: `lib/index.js` (esm, node half) plus `lib/client.js` (cjs), the latter wrapped as `window.__ModuleLoader__.load({ id, factory })` with the shell baseline (`react`, `@deepseek-ai/cordis`, `dsh-client-store`, `dsh-client-ui-slots`, `dsh-client-ui-primitives`, `dsh-client-ui-dockkit`) external and everything else inlined.

## Build

```sh
pnpm install   # standalone: pnpm install --ignore-workspace while the repo workspace globs cover only the root
pnpm run build # tsc -b (types into lib/types) && tsdown (lib/index.js + lib/client.js)
```

## Integration notes

- The Host side registers the namespace with `ctx.settings.installSection(ctx, 'dolphindb', Config, config, hooks)`; the web half then binds with no further wiring.
- A server added from the card names its password reference `DOLPHINDB_PASSWORD_<NAME>` (uppercased, non-identifier characters folded to `_`), matching the credentials domain grammar; the add form shows the reference it will use. Two names that fold to the same suffix share one credential.
- Passwords are written through `ctx.remote.credentials` in the same submit as the form that staged them (add or edit); clearing one stays a separate button. Removing a server does not clear its stored password; clear it first if the credential should go too.
- No `./invariant` is published: this package owns no runtime relationship independent observation could diverge over.
