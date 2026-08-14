# Probing the Live Cluster Schema

When the user mentions a database / table / field you can't confirm from `schema.md`, run DolphinDB's built-in catalog functions on the DolphinX platform. The schema only lives on the cluster — there is no retrieval tool that can answer this.

Work top-down: cluster → database → table → schema. Only run the layer you actually need.

## A. Check if a database exists / list databases

Fastest path when the user already gave you a path:

```
existsDatabase("dfs://tushare_daily_db")     // True / False, no permissions needed
```

Cluster-wide enumeration:

```
getClusterDFSDatabases()     // cluster list
getAllDBs()                  // local node
pnodeRun(getAllDBs)          // all nodes, table form
```

⚠️ **Permission caveat**: non-admin users only see databases they own or have `DB_MANAGE` on. `getClusterDFSDatabases()` returning `[]` ≠ "cluster is empty". `pnodeRun(getAllDBs)` raises `A table has at least one column` when every node returns empty — treat as "no visible databases", not a script bug. Skip enumeration and use `existsDatabase` + `getTables` with the path the user gave you.

## B. List tables in a database

```
getTables(database("dfs://tushare_daily_db"))
```

## C. Inspect a table's schema

```
t = loadTable("dfs://tushare_daily_db", "stock_bak_daily")
schema(t)            // full: colDefs, partitionType, chunkPath, ...
schema(t).colDefs    // just columns
```

## D. Sample rows (sanity-check field semantics)

```
select top 5 * from loadTable("dfs://tushare_daily_db", "stock_bak_daily")
    where trade_date between 2024.01.01 : 2024.01.10
```

Always include the partition column in WHERE even when sampling — `stock_bak_daily` is partitioned by `trade_date`.

## Workflow

1. Pick the narrowest probe that answers the question.
2. Submit the script to the DolphinX platform for execution.
3. If a field the user asked about does not exist, surface it before writing code — don't silently substitute.
