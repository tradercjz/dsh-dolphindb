# Probing the Live Cluster for High-Frequency Data

When the user mentions a database / table / field for high-frequency factor computation, **always probe** the cluster to confirm what actually exists. Reference schemas in `schema.md` are for field name reference only — they may differ from the user's actual tables.

Work top-down: cluster → database → table → schema. Only run the layer you actually need.

## A. Check if a database exists

Fastest path when the user already gave you a path:

```
existsDatabase("dfs://Level2")       // True / False
existsDatabase("dfs://stockMinKSH")  // True / False
existsDatabase("dfs://factor_day")   // True / False
```

## B. List tables in a database

```
getTables(database("dfs://Level2"))
getTables(database("dfs://stockMinKSH"))
getTables(database("dfs://factor_day"))
```

## C. Inspect a table's schema

```
t = loadTable("dfs://Level2", "snapshot")
schema(t)            // full: colDefs, partitionType, chunkPath, ...
schema(t).colDefs    // just columns

t = loadTable("dfs://stockMinKSH", "stockMinKSH")
schema(t).colDefs
```

## D. Sample rows (sanity-check field semantics + time range)

```
// Level2 snapshot sample
select top 5 * from loadTable("dfs://Level2", "snapshot")
    where TradeDate = 2023.02.01

// Minute K-line sample
select top 5 * from loadTable("dfs://stockMinKSH", "stockMinKSH")
    where date(DateTime) = 2021.01.04

// Factor database sample
select top 5 * from loadTable("dfs://factor_day", "factor_day")
    where TradeDate = 2023.02.01
```

Always include the partition column in WHERE even when sampling. For Level2 tables, partition is `TradeDate`. For minute K-line, partition is `DateTime`. For factor_day, partition is `TradeDate`.

## E. Check time range of available data

```
// Level2 snapshot
select min(TradeDate), max(TradeDate) from loadTable("dfs://Level2", "snapshot")

// Minute K-line
select min(date(DateTime)), max(date(DateTime)) from loadTable("dfs://stockMinKSH", "stockMinKSH")
```

## Workflow

1. First probe what databases exist: `existsDatabase` on common paths
2. If the user mentions a specific data source, probe that table's schema: `schema(t).colDefs`
3. Compare probed fields against the reference schemas in `references/schema.md` to understand field meanings
4. If a field the user asked about does not exist, **surface it to the user** before writing code — don't silently substitute
5. Always check if `dfs://factor_day` exists and has the `factor_day` table

## Fallback: When the Expected Data Source Is Not Found

If the user-specified database or table does not exist on the cluster, do **not** guess or silently switch to a different source. Do **not** halt. Follow this procedure:

### Step 1: Probe all candidate data sources

Run `existsDatabase` on all common high-frequency databases:

```
existsDatabase("dfs://Level2")
existsDatabase("dfs://stockMinKSH")
```

For each database that exists, list its tables:

```
getTables(database("dfs://Level2"))
getTables(database("dfs://stockMinKSH"))
```

### Step 2: Surface findings to the user

If the user-specified source is not found, present a concise summary of what IS available. Example:

> "`dfs://stockMinKSH` not found on the cluster. Available high-frequency data sources:
> - `dfs://Level2` / `snapshot` — Level2 快照
> - `dfs://Level2` / `trade` — Level2 成交
> - `dfs://Level2` / `entrust` — Level2 委托
>
> Proceeding with `dfs://Level2` / `snapshot` under default assumption. Confirm or correct?"

Keep it under 6 lines. Give the user a clear default choice so they can simply confirm.

### Step 3: Choose the best available fallback (if no user response)

If the user does not respond, pick the closest match by intent:

| User's intent | Fallback preference |
|--------------|-------------------|
| Asked for Level2 data | `dfs://Level2` tables: snapshot > trade > entrust |
| Asked for minute/K-line data | `dfs://stockMinKSH` / `stockMinKSH` |
| Asked generically for "高频数据" | Most complete available source (typically Level2 snapshot if available, otherwise minute K-line) |
| Specified custom DB/table names | Use exactly those names — they are expected to exist on the user's cluster; if they don't, go to Step 5 |

### Step 4: Document the substitution

In the factor script's header comment, record:
- What the user asked for (original data source)
- What was found on the cluster (probe results)
- Which source is being used and why
- That it is a **default assumption** pending user confirmation

### Step 5: Nothing exists — ask the user

If none of the common high-frequency databases exist on the cluster:

> "No high-frequency data source found on the cluster (checked `dfs://Level2`, `dfs://stockMinKSH`). Please provide the correct database path and table name for your intraday data."

Do **not** proceed to write factor code without a confirmed data source. Do **not** fabricate database or table names.
