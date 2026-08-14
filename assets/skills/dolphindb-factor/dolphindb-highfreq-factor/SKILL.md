---
name: dolphindb-highfreq-factor
description: MUST use when the user asks to generate DolphinDB code that computes a factor from intraday / tick / high-frequency data (高频因子 / 日内因子 / 降频到日) and aggregates down to daily frequency. Do NOT use for factors that operate directly on daily-frequency data — those use dolphindb-daily-factor.
---

# DolphinDB High-Frequency Factor Generator

## The Rule

Never present factor code to the user before the DolphinX platform returns a successful execution result.

## When to Use This Skill (vs `dolphindb-daily-factor`)

| Scenario | Which skill |
|----------|------------|
| Factor starts from **intraday/high-frequency data** and down-frequencies to daily | **dolphindb-highfreq-factor** ← this skill |
| Factor operates on **daily-frequency data** (daily bars) | dolphindb-daily-factor |

The differentiator is the **granularity of the source data**, not the output frequency. Both produce daily-frequency output, but the high-frequency skill adds a down-frequency aggregation step.

If the user says "write a factor" without specifying the data source, ask whether the data is daily or intraday before choosing a skill.

## 4-Step Flow

1. **probe** — Inspect the user's cluster to confirm which data tables exist and their fields, and whether the factor database exists. See `references/probing.md`.

2. **verify** — For every operator / function you are not 100% sure maps to a DolphinDB built-in, check `references/pitfalls.md` first, then consult the DolphinDB documentation or run a minimal probe on the DolphinX platform. Division uses `\`, not `/`.

3. **template** — Read `references/template.dos`. Fill in `<FactorName>`, fields used, and the factor body. Choose the **normal** path or the **adjust** path depending on whether post-down-frequency processing is needed. Keep all sections intact.

4. **execute** — Write the code to a `.dos` file. Run it on the DolphinX platform. Check the job status. If execution fails, isolate the error, fix, re-run.

If the factor expression is ambiguous (e.g. the user's formula doesn't specify the data source or weighting scheme), ask the user **one** consolidated question before writing code.

## Two Computation Patterns

### Normal Factor (single down-frequency)
Intraday computation → aggregate to daily → store.

```
Factor function receives intraday table → computes per-stock per-day aggregates → returns result table
res = mr(ds, conf[`func]).unionAll()
```

Example: `examples/normal_factor.dos`

### Adjust Factor (down-frequency + post-processing)
Intraday computation → down-frequency to daily → further processing on the daily result (local computation, non-distributed).

```
Factor function returns daily result → adjust function processes daily result
diffTB = mr(ds, conf[`func]).unionAll()
res = conf[`funcsec](diffTB)    // local computation, not distributed
```

Example: `examples/adjust_factor.dos`

## Factor Storage

- Factor results are stored in `dfs://factor_day` / `factor_day` table (TSDB engine)
- Before storing, scan the cluster to see if the factor database exists. If not, create it.
- See `references/factor_table.md` for the create-table code.

## Data Sources

The user's cluster may have different high-frequency data tables. **Always probe before assuming.** Common possibilities:

| Data type | Possible DB path | Possible table name |
|-----------|-----------------|-------------------|
| Level2 snapshot | `dfs://Level2` | `snapshot` |
| Level2 entrust | `dfs://Level2` | `entrust` |
| Level2 trade | `dfs://Level2` | `trade` |
| Minute K-line | `dfs://stockMinKSH` | `stockMinKSH` |

Reference schemas for field names are available in `references/schema.md`. Always verify actual fields against the user's cluster — the schema files are for **field name reference only**, not for creating tables or assuming availability.

The user may also specify custom database/table names (e.g. `"dfs://my_level2"`, `"my_snapshot"`). Always use the names provided by the user; the table above is only a default reference.

If the user's specified source does not exist on the cluster, follow the fallback procedure in `references/probing.md#fallback`. Do NOT guess, do NOT halt — probe all candidates, surface findings, and continue with the best available match.

## References (read on demand)

- `references/probing.md` — inspect cluster schema for high-frequency data and factor tables; includes fallback procedure when expected data sources are missing
- `references/schema.md` — reference field names from Level2 snapshot/entrust/trade and minute K-line tables
- `references/pitfalls.md` — DolphinDB syntax gotchas + red flags specific to high-frequency computation
- `references/template.dos` — the comprehensive template to fill in (normal + adjust paths)

## Examples (read for shape, not for content)

- `examples/normal_factor.dos` — normal high-frequency factor: single down-frequency step
- `examples/adjust_factor.dos` — adjust factor: down-frequency + local post-processing

## Related Skills

- Documentation questions about DolphinDB in general → `dolphindb-rag` skill
- Daily-frequency factor generation → `dolphindb-daily-factor` skill
