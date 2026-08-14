# dsh-dolphindb

DolphinDB integration for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) as an installable profile bundle. One package ships the WebSocket executor, the model-facing query/write tools, and the 23 bundled DolphinDB skills.

## What you get

| Component | Surface |
|---|---|
| `dolphindb_query` | Read-only DolphinDB scripts/SQL (result tables, vectors, matrices, scalars; optional chart) |
| `dolphindb_execute` | Write/mutation scripts, gated behind the approval seam with a code preview |
| 23 DolphinDB skills | Bundled `SKILL.md` trees (syntax, SQL, vectorization, functional programming, data import, factors, ops, Orca DStream, plotting, backtest, FICC pricing, Tushare/CSMAR, …) exposed through the `skill` tool |

## Install

```sh
dsh plugin --profile <name> add github:tradercjz/dsh-dolphindb
```

or add `@tradercjz/dsh-dolphindb` to a profile's `dsh.profile.bundles` list after `@deepseek-ai/dsh-base`.

The executor's only required field is `passwordRef` (default `DOLPHINDB_PASSWORD`); host/port/username default to `127.0.0.1:8848` / `admin`. Override for a remote server in the profile's own `cordis.patch.yml`:

```yaml
- id: dolphindb
  config:
    host: 183.134.101.139
    port: 8892
    username: admin
    passwordRef: DOLPHINDB_PASSWORD
```

Set the password in the process environment or the repo `.env`; never commit it.

### Verify the layer

```sh
dsh --profile <name> --dump-config
```

The output shows a `# == @tradercjz/dsh-dolphindb` layer mounting three rows — `dolphindb` (executor), `tool-dolphindb` (tools), `dolphin-skills` (skills). Starting the profile registers `dolphindb_query` / `dolphindb_execute` and exposes the 23 `dolphindb-*` skills through the `skill` tool.

## Development

The repo type-checks and builds against a sibling `deepseek-harness` checkout (see `tsconfig.json`):

```sh
pnpm install
pnpm run typecheck   # against ../deepseek-harness
pnpm run build       # tsc -b + tsdown → lib/
```

`dsh plugin add github:…` installs source, so pnpm runs `prepare` (a self-contained `tsdown` transpile with no harness checkout and no type check). The first install fails until the profile's `pnpm-workspace.yaml` authorizes the build scripts (the `dsh` error prints the exact commit-pinned key — prefer that over the loose form below):

```yaml
allowBuilds:
  "@tradercjz/dsh-dolphindb@https://codeload.github.com/tradercjz/dsh-dolphindb/tar.gz/<commit-sha>": true
  # Native file-watcher pulled transitively by the `dolphindb` client
  # (dolphindb → xshell → sass → @parcel/watcher); set `false` to skip the
  # native build and keep the JS fallback.
  "@parcel/watcher": true
```

## Skills provenance

The `assets/skills/` trees are vendored from the official [`dolphindb/DolphinX_Skill`](https://github.com/dolphindb/DolphinX_Skill) repository. One source `SKILL.md` (`dolphindb-daily-factor`) had an unquoted `description` that breaks YAML parsing; the vendored copy quotes it.

## License

MIT
