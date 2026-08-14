# Sample Data Schema — `dfs://tushare_daily_db`

This skill always pulls from the two tables below. The columns listed here were verified live against the cluster on 2026-06-24.

If the user references a field not listed here, do not guess. Probe the cluster: see `probing.md`.

---

## `stock_bak_daily` — daily bars per stock (verified)

Partition column: `trade_date`. WHERE clauses must include it.

| Column         | Type      | Meaning                          |
|----------------|-----------|----------------------------------|
| `code`         | SYMBOL    | Stock code                       |
| `trade_date`   | DATE      | Trading date (partition)         |
| `name`         | STRING    | Stock name                       |
| `pct_change`   | DOUBLE    | Pct change vs prev close         |
| `close`        | DOUBLE    | Close price                      |
| `change`       | DOUBLE    | Absolute change                  |
| `open`         | DOUBLE    | Open price                       |
| `high`         | DOUBLE    | High price                       |
| `low`          | DOUBLE    | Low price                        |
| `pre_close`    | DOUBLE    | Previous close                   |
| `vol_ratio`    | DOUBLE    | Volume ratio                     |
| `turnover`     | DOUBLE    | Turnover rate                    |
| `swing`        | DOUBLE    | Intraday swing                   |
| `vol`          | DOUBLE    | Volume                           |
| `amount`       | DOUBLE    | Trade amount                     |
| `selling`      | DOUBLE    | Sell-side volume / amount        |
| `buying`       | DOUBLE    | Buy-side volume / amount         |
| `float_share`  | DOUBLE    | Float share count                |
| `total_share`  | DOUBLE    | Total share count                |
| `pe`           | DOUBLE    | P/E ratio                        |
| `industry`     | STRING    | Industry tag                     |
| `area`         | STRING    | Region                           |
| `float_mv`     | DOUBLE    | Float market cap                 |
| `total_mv`     | DOUBLE    | Total market cap                 |
| `avg_price`    | DOUBLE    | VWAP / average price             |
| `strength`     | DOUBLE    | Strength indicator               |
| `activity`     | DOUBLE    | Activity indicator               |
| `avg_turnover` | DOUBLE    | Avg turnover                     |
| `attack`       | DOUBLE    | Attack indicator                 |
| `interval_3`   | DOUBLE    | 3-day interval indicator         |
| `interval_6`   | DOUBLE    | 6-day interval indicator         |
| `update_time`  | TIMESTAMP | Update timestamp                 |

---

## `index_daily` — daily bars per index (verified)

| Column        | Type      | Meaning                       |
|---------------|-----------|-------------------------------|
| `code`        | SYMBOL    | Index code (e.g. `000001.SH`) |
| `trade_date`  | DATE      | Trading date                  |
| `close`       | DOUBLE    | Close                         |
| `open`        | DOUBLE    | Open                          |
| `high`        | DOUBLE    | High                          |
| `low`         | DOUBLE    | Low                           |
| `pre_close`   | DOUBLE    | Previous close                |
| `change`      | DOUBLE    | Absolute change               |
| `pct_chg`     | DOUBLE    | Pct change                    |
| `vol`         | DOUBLE    | Volume                        |
| `amount`      | DOUBLE    | Amount                        |
| `update_time` | TIMESTAMP | Update timestamp              |

> **Note**: `index_daily` uses `pct_chg` (no underscore-d), while `stock_bak_daily` uses `pct_change`. Don't mix them up.

Default index code for the join: `"000001.SH"` (上证综指).

---

## Aliases used inside the template

The template's section 1 SELECT renames raw columns to canonical names so the factor body doesn't need to remember vendor-specific names:

| Source table & column         | Canonical alias |
|-------------------------------|-----------------|
| `stock_bak_daily.code`        | `securityid`    |
| `stock_bak_daily.trade_date`  | `tradetime`     |
| `stock_bak_daily.pre_close`   | `last`          |
| `stock_bak_daily.avg_price`   | `vwap`          |
| `stock_bak_daily.industry`    | `sector`        |
| `stock_bak_daily.total_mv`    | `cap`           |
| `index_daily.open`            | `index_open`    |
| `index_daily.close`           | `index_close`   |

Other columns (`open`, `close`, `high`, `low`, `vol`, ...) keep their raw names. If the user wants additional columns from the table above, add them to the SELECT in section 1.

---

## Common derived series (computed in the factor function, not loaded)

These are NOT columns — derive them from the loaded fields inside the factor:

| Series        | Definition (panel, vectorized)         |
|---------------|----------------------------------------|
| `returns`     | `ratios(close) - 1` (per-stock series) |
| `log_returns` | `log(ratios(close))`                   |

Confirm any non-trivial DolphinDB function name before using it — check user-provided docs, `references/pitfalls.md`, or run a minimal probe on the DolphinX platform.
