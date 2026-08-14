---
name: dolphindb-daily-factor
description: "MUST use when the user asks to generate DolphinDB code for a factor that operates directly on daily bar data (日频数据 / 日线数据 / 日K数据). Trigger keywords: 日频因子, 日度因子, 日线因子, 日频数据. Builds panel data via pivot, defines a factor function on panel matrices, executes on the DolphinX platform, and previews the result. Do NOT use for factors computed from intraday/tick data that require down-frequency aggregation (Level2/分钟K线/日内高频) — those use dolphindb-highfreq-factor."
---

# DolphinDB Daily-Frequency Factor Generator

## The Rule

Never present factor code to the user before it has been executed on the DolphinX platform and returned a successful result.

## When to Use This Skill (vs `dolphindb-highfreq-factor`)

| Scenario | Which skill |
|----------|------------|
| Factor operates on **daily-frequency data** (daily bars) | **dolphindb-daily-factor** ← this skill |
| Factor starts from **intraday/high-frequency data** and down-frequencies to daily | dolphindb-highfreq-factor |

The differentiator is the **granularity of the source data**, not the output frequency. Both produce daily-frequency output, but the high-frequency skill adds a down-frequency aggregation step.

If the user says "write a factor" without specifying the data source, ask whether the data is daily or intraday before choosing a skill.

## 3-Step Flow

1. **verify** — for every operator / function you are not 100% sure maps to a DolphinDB built-in, verify it before using:
   - Check `references/pitfalls.md` and `references/schema.md` first
   - Ask the user for the doc page if you have any doubt
   - Or write a minimal probe script (one or two lines on a tiny vector) and run it on the DolphinX platform to confirm the behavior
   - **Division uses `\`, not `/`.** This one you do not need to verify — just write `\`.
2. **template** — read `references/template.dos`, fill in `<FactorName>`, fields used, factor body. Keep the 4 sections intact.
3. **execute** — submit the completed script to DolphinDB on the DolphinX platform. If it errors, build a smaller reproducer to isolate the failing operator, fix, re-submit. Only show the code to the user after a successful run.

If the factor expression is ambiguous (e.g. `rank` = cross-sectional vs time-series), ask the user **one** consolidated question before writing code.

The user may specify custom database/table names for the data source. The default tables `stock_bak_daily` and `index_daily` in `dfs://tushare_daily_db` are for reference only — always use whatever path the user provides.

## References (read on demand)

- `references/probing.md` — inspect cluster schema (`existsDatabase` / `getTables` / `schema`)
- `references/pitfalls.md` — DolphinDB syntax gotchas + red flags
- `references/schema.md` — verified columns of `stock_bak_daily` and `index_daily`
- `references/template.dos` — the 4-section template to fill in

## Examples (read for shape, not for content)

- `examples/wq_alpha1.dos` — full input → code → preview output for the Alpha #1 formula

## Related Skills

- General DolphinDB Q&A discipline → `dolphindb-rag` skill (in this same `no_mcp/` folder). It enforces "no fabrication from memory" when no retrieval tool is available.
