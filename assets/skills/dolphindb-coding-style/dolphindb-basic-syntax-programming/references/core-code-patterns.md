# Core Code Patterns

Read this file before producing executable DolphinScript. It focuses on common output shapes, table operations, schema checks, and safety boundaries.

## Default Script Shape

For generated scripts, use this order:

1. Inputs and assumptions.
2. Object or table construction.
3. Function definitions.
4. Computation or query.
5. Verification or final result.

Return a concrete object at the end: scalar, vector, table, dictionary, or a small verification table.

```dos
// Inputs
qty = 10 20 30
price = 1.5 2.0 2.5

// Compute
notional = qty * price

// Output
result = table(qty as qty, price as price, notional as notional)
result
```

## Output Objects

Use a table when the result is row-shaped. Use a dictionary when returning multiple result kinds.

```dos
result = dict(STRING, ANY)
result[`schema] = schema(t).colDefs
result[`rows] = rows(t)
result[`sample] = select top 5 * from t
result
```

For verification, return the actual and expected values:

```dos
actual = sum(1 2 3)
expected = 6
assert "sum-basic", actual == expected

table(`sum-basic as caseName, actual as actual, expected as expected, actual == expected as passed)
```

## `select` And `exec`

`select` always returns a table.

```dos
select * from t
select id, qty from t
select qty * price as notional from t
select 1 as flag, sym from t
select NULL as voidCol from t
```

Use `exec` when code needs a scalar or vector.

```dos
countValue = exec count(*) from t
qtyVector = exec qty from t
twoCols = exec qty, sym from t
```

Rules:

- `select column from t` returns a one-column table.
- `select count(*) from t` returns a one-row, one-column table.
- `exec count(*) from t` returns a scalar.
- `exec qty from t` returns a vector.
- `exec qty, sym from t` returns a table.
- `select NULL as col from t` creates a VOID column; avoid computing on it.

Use SQL skill for joins, grouping design, context windows, pivoting, SQL trace, or distributed query optimization.

## Filters And `top`

```dos
select * from t where qty > 10
select * from t where sym in `A`C
select * from t where qty > 10, sym != `C
select * from t where qty > 10 && sym != `C

select top 10 * from t
select top 1:3 * from t
```

Rules:

- Comma-separated `where` conditions are conjunctive.
- `top` scalar count or range must use integer constants.
- Do not use variables or expressions in `top`.
- `top 1:3` uses zero-based positions and excludes the end index.

## Metacode `<...>`

Use metacode for APIs that expect unevaluated column expressions.

```dos
t.update!(`qty, <qty + 1>, <id <= 2>)
t.update!(`notional, <qty * price>)
```

Rules:

- Use `<column expression>`, not a string such as `"qty + 1"`.
- Do not precompute column expressions unless the API expects concrete values.
- If the API signature is unknown, check documentation before inventing metacode usage.

## Table Mutation Patterns

Memory-table update:

```dos
t.update!(`qty, <qty + 1>, <sym == `A>)
```

SQL update:

```dos
update t set qty = qty + 1 where sym = `A
```

Guidance:

- Use `update!` for contained memory-table updates in generated scripts.
- Use SQL `update` when the task asks for SQL-style updates or DFS updates.
- SQL `update` can create a new column in memory tables.
- SQL `update` cannot change an existing column type; use `replaceColumn!` for memory table column type replacement.
- Do not emit broad `update t set ...` against a user table unless the task explicitly asks for it.

Delete only when explicitly requested:

```dos
delete from t where id = 1
```

`delete from t` with no `where` removes all rows. Do not use it as example cleanup.

## Schema And Insert Checks

Before inserting into a typed table, check column order and types:

```dos
schema(t).colDefs
```

Use `tableInsert` when inserted row count matters:

```dos
inserted = tableInsert(t, 4, `D, 40, true)
```

For partitioned tables, prefer inserting a table object:

```dos
data = table(1 2 as id, `A`B$SYMBOL as sym)
tableInsert(pt, data)
```

`append!` appends tables by column position, not by column name. Align column order first.

## Read-Only Catalog Probe

For questions such as "current databases", prefer read-only DFS probes:

```dos
dbs = getClusterDFSDatabases(false)

result = dict(STRING, ANY)
result[`count] = size(dbs)
result[`databases] = dbs
result
```

For a concrete database:

```dos
dbUrl = "dfs://example"
if(existsDatabase(dbUrl)) {
    tables = getDFSTablesByDatabase(dbUrl)
}
```

Do not generate `dropDatabase`, `dropTable`, broad `delete`, or broad `update` unless the user explicitly asks for it and names the target.

Use [database-and-table-basics.md](database-and-table-basics.md) for database creation, table creation, `loadTable`, `loadText`, `loadTextEx`, and DFS/memory database boundaries.

## Verification

When an executor, compile probe, or syntax probe is available, verify generated scripts before reporting completion. If verification cannot run, say so explicitly and avoid implying that the script has been executed.

Verification-friendly outputs:

- Return `schema(t).colDefs` after creating or loading a table.
- Return `rows(t)` after insertion or import.
- Return a small `result` table or dictionary with `actual`, `expected`, and `passed` fields for computed checks.

## Import Basics

Use explicit schema when loading text and column types matter:

```dos
schema = table(
    `id`sym`qty as name,
    `INT`SYMBOL`INT as type
)

t = loadText(
    filename=filePath,
    delimiter=",",
    schema=schema,
    containHeader=true
)
```

Rules:

- Server-side load functions read server-visible paths.
- `loadText` inference is sample-based; prefer explicit schema for SYMBOL and temporal columns.
- Use [temporal-and-formatting.md](temporal-and-formatting.md) for schema `format`.
- Use [database-and-table-basics.md](database-and-table-basics.md) for `loadTextEx` and partitioned loading.

## Error Handling

Use `try/catch` around the operation being demonstrated, not around unrelated setup:

```dos
result = dict(STRING, ANY)

try {
    result[`value] = 1 / 0
    result[`ok] = true
} catch(ex) {
    result[`ok] = false
    result[`error] = string(ex)
    result[`errorType] = typestr(ex)
}

result
```
