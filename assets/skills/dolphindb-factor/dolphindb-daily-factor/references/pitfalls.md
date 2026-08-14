# DolphinDB Pitfalls + Red Flags (DolphinX, no-MCP)

## 1. Division — the one rule you must memorize

| Want | Use |
|------|-----|
| Float division | `\` |
| Integer division | `/` |

```
returns = close \ prev_close - 1    // ✅
returns = close / prev_close - 1    // ❌ integer truncation
```

Every place the formula has a ratio, normalization, or `x / y` — write `\`.

## 2. Things to verify before writing, never assume

For all of the following, the safe move is to verify against the user's docs / a probe script — never trust memory:

- Moving / windowed functions: window argument shape, boundary behavior (NULL vs partial), inclusive/exclusive of current row
- Cross-sectional vs time-series ops on a panel matrix: which built-in operates row-wise vs column-wise, which preserves shape
- Rank / percentile semantics: tie handling, NULL handling, ascending vs descending, `percent` option
- Conditional expressions: ternary `? :` is not always idiomatic — `iif(cond, a, b)` is safe
- Power / sign / abs: confirm function names exist (don't assume `pow`, `sign`, `abs` from another language)
- Null propagation: factor inputs often have leading NULLs from window functions; check whether downstream functions skip or propagate
- Type coercion: integer columns silently triggering integer division (see rule 1)

If you're 50/50 on a function name, write a one-line probe and run it on the DolphinX platform. A 5-second probe beats an execution failure on the full factor.

## 3. Panel-data conventions (this skill)

- `pivot by tradetime, securityid` ⇒ rows = dates, columns = stocks
- Factor functions take **panel matrices only**, never query tables internally
- Output of a factor function has the **same shape** as its inputs
- Preview slices the first 100 rows: `factor_result[0:n,]` with `n = min(100, size(dates))`

## 4. WHERE must include the partition column

`stock_bak_daily` is partitioned by `trade_date`. The `where d.trade_date between startDate : endDate` clause in section 1 of the template is **not optional** — without it the query is a full scan.

## 5. Red flags — you're doing it wrong

- Writing `/` for division in the factor body → STOP, use `\`
- Using a non-trivial operator without verifying it (probe script or user doc) → STOP, verify
- Showing code before the DolphinX platform returned a successful execution result → STOP
- Execution failed and you're guessing the fix without isolating the failing operator → STOP, build a minimal reproducer
- Factor function reads from a table instead of taking panel matrices → STOP, restructure
- Ambiguous expression and you picked an interpretation silently → STOP, ask one consolidated question
- Answering "does this database/table/field exist?" from memory → STOP, run `existsDatabase` / `getTables` / `schema` on the DolphinX platform (see `probing.md`)
