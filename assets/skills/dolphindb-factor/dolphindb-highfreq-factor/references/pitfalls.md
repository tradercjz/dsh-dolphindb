# DolphinDB Pitfalls + Red Flags (High-Frequency Factors)

## 1. Division — the one rule you must memorize

| Want | Use |
|------|-----|
| Float division | `\` |
| Integer division | `/` |

Every place the formula has a ratio, normalization, or `x / y` — write `\`.

## 2. High-Frequency Specific Pitfalls

### 2.1 Data Filtering
- **Always filter by partition column in WHERE**. For Level2 tables, the partition is `TradeDate`. For minute K-line, the partition is `DateTime`.
- **Time range filtering**: Different data sources use different time columns:
  - Level2: `TradeTime` between startTime and endTime
  - Minute K-line: `time(DateTime)` between startTime and endTime

### 2.2 Data Extraction for sqlDS
- The `sqlDS` metacode must include all required fields in the SELECT clause
- The WHERE must include the partition column filter
- For minute K-line, remember to derive `date(DateTime)` as TradeDate and `time(DateTime)` as TradeTime **inside** the sqlDS SELECT
- SecurityID filtering: `SecurityID like "00%" or SecurityID like "30%" or SecurityID like "6%"` covers A-share stocks

### 2.3 Factor Function Design
- Factor function receives a **table** (not a panel matrix), one chunk of data per node
- The function should handle one or multiple days of data for a subset of stocks
- Output must be a table with columns: `SecurityID`, `TradeDate`, `Value`, `FactorName`, `UpdateTime`
- Group by `SecurityID, TradeDate` for daily aggregation

### 2.4 Distributed Computation Pattern
- `sqlDS(<...>)` generates metacode — do NOT use `()` on the metacode expression
- `mr(ds, conf[`func]).unionAll()` runs the function on each partition in parallel
- The function name in `conf[`func]` must be the function definition, not a string

### 2.5 Adjust Factor — Local Computation
- The adjust function (`conf[`funcsec]`) runs on the **already aggregated daily result**
- It does NOT use `mr` — it's plain local computation
- Typical use: cross-sectional normalization, time-series smoothing, scaling adjustments
- Be careful with `context by` vs `group by` for time-series operations

### 2.6 Factor Database
- Database: `dfs://factor_day`, partitioned by `RANGE(date(...))` + `VALUE`
- Table: `factor_day`, sorted by `SecurityID, TradeDate`
- `keepDuplicates=LAST` — supports repeated writes, keeps latest
- FactorName is an additional partition dimension

### 2.7 GROUP BY Alias Rule

When a column is renamed with `as` in the SELECT clause, the **original column name is no longer visible in GROUP BY**. The GROUP BY clause operates in the output scope — only the aliased name exists.

```sql
// ❌ WRONG: 'code' was aliased to 'SecurityID' in SELECT — 'code' is gone
select code as SecurityID, sum(Volume) as TotalVol
from dataTB
group by code, TradeDate

// ✅ CORRECT: use 'as' in GROUP BY with the same alias
select code as SecurityID, sum(Volume) as TotalVol
from dataTB
group by code as SecurityID, TradeDate

// ✅ ALSO CORRECT: don't alias in SELECT, alias only in GROUP BY
select code, sum(Volume) as TotalVol
from dataTB
group by code as SecurityID, TradeDate
```

**Why this matters for factors:** The input table may use different field names than what the factor output requires. For example, Level2 snapshot has `SecurityID` natively, but minute K-line derived from raw ticks may use `code` or `symbol`. The factor output must always be `SecurityID`. This means aliasing is common — and the GROUP BY clause must follow the alias rule.

## 3. Things to verify before writing, never assume

- Moving / windowed functions: window argument shape, boundary behavior
- `deltas()`: requires `csort` to ensure correct within-group ordering
- `mstd`, `mavg`, `msum`, etc.: boundary behavior (NULL until window fills)
- `skew`, `kurtosis`: confirm exact function names
- `context by` vs `group by`: context by preserves row order; group by collapses
- Null propagation: factor inputs often have NULLs; check whether downstream functions skip or propagate

## 4. Red flags — you're doing it wrong

- Writing `/` for float division → STOP, use `\`
- Factor function reads from a table path directly instead of receiving the table as argument → STOP
- Using a non-trivial operator without verifying it → STOP, verify via DolphinDB documentation or a minimal probe
- Showing code before the DolphinX platform returned a successful execution result → STOP
- Answering "does this database/table/field exist?" from memory → STOP, run `existsDatabase` / `getTables` / `schema`
- Forgetting `csort` before `deltas` in a `context by` block → STOP
- Using `select ... from dataTB group by SecurityID, TradeDate` without `context by` for time-ordered operations → STOP
- Creating a new database/table without first probing that it doesn't already exist → STOP
- The adjust function uses `mr` (distributed) instead of local computation → STOP
- Referencing an original column name in GROUP BY after that column has been aliased with `as` in SELECT → STOP, use `group by <expr> as <alias>`
