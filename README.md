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

## Development

The repo type-checks and builds against a sibling `deepseek-harness` checkout (see `tsconfig.json`):

```sh
pnpm install
pnpm run typecheck   # against ../deepseek-harness
pnpm run build       # tsc -b + tsdown → lib/
```

`dsh plugin add github:…` installs source, so pnpm runs `prepare` (a self-contained `tsdown` transpile with no harness checkout and no type check). First install needs build authorization in the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  "@tradercjz/dsh-dolphindb": true
```

## Skills provenance

The `assets/skills/` trees are vendored from the official [`dolphindb/DolphinX_Skill`](https://github.com/dolphindb/DolphinX_Skill) repository. One source `SKILL.md` (`dolphindb-daily-factor`) had an unquoted `description` that breaks YAML parsing; the vendored copy quotes it.

## License

MIT
