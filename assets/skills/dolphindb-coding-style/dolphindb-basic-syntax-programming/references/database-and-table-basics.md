# Database And Table Basics

Use this reference when code needs to inspect existing server-side databases or create basic DolphinDB databases and tables.

## Read-Only Catalog Probe

Prefer read-only probes before generating DDL or data writes.

```dos
dbs = getClusterDFSDatabases(false)
tables = getClusterDFSTables(false)

dbUrl = "dfs://example"
dbExists = existsDatabase(dbUrl)

if(dbExists) {
    tablePaths = getDFSTablesByDatabase(dbUrl)
    tableList = listTables(dbUrl)
}
```

Functions:

- `getClusterDFSDatabases(false)` returns DFS database paths visible to the current user.
- `getClusterDFSTables(false)` returns DFS table paths, usually in `dfs://db/table` form.
- `getDFSTablesByDatabase(dbUrl)` returns table paths under one DFS database.
- `existsDatabase(dbUrl)` returns a BOOL scalar.
- `existsTable(dbUrl, tableName)` checks one table. Pass `tableName` as a symbol or string, for example `` `pt `` or `"pt"`.
- `listTables(dbUrl)` returns a table with at least `tableName` and `physicalIndex`.
- `getTables(dbHandle)` can inspect tables for a database handle, but do not use it as evidence that an in-memory database has no partitioned tables; a verified memory-db experiment returned an empty vector after a partitioned table was created.

Schema probe:

```dos
if(existsDatabase(dbUrl) && existsTable(dbUrl, `pt)) {
    pt = loadTable(dbUrl, `pt)
    colDefs = schema(pt).colDefs
}
```

`loadTable` is for DFS or local disk databases. A verified in-memory database experiment compiled but failed at runtime with `table file does not exist: /pt.tbl`; for memory databases, keep the table object returned by creation or loading.

## Database Creation

Create a memory database:

```dos
db = database(directory="", partitionType=VALUE, partitionScheme=`A`B`C)
```

Create a DFS database:

```dos
dbPath = "dfs://example_value_db"
db = database(dbPath, VALUE, `A`B`C)
```

Open an existing DFS database:

```dos
dbPath = "dfs://example_value_db"
db = database(dbPath)
```

Rules:

- `directory=""` creates an in-memory database handle.
- `database("dfs://...", partitionType, partitionScheme)` creates a DFS database when the path does not already exist.
- Reopening an existing DFS database should only pass the directory. Do not try to replace its partition type or partition scheme.
- Common partition types include `SEQ`, `RANGE`, `HASH`, `VALUE`, `LIST`, and `COMPO`.
- Do not generate `dropDatabase` unless the user explicitly asks for destructive cleanup and names the target path.

## Partitioned Table Creation

`createPartitionedTable` creates an empty partitioned table from a schema table. It does not insert rows from the source table.

```dos
db = database(directory="", partitionType=VALUE, partitionScheme=`A`B`C)

schemaTable = table(
    1:0,
    `id`sym`qty`ts,
    [INT, SYMBOL, INT, TIMESTAMP]
)

pt = createPartitionedTable(
    dbHandle=db,
    table=schemaTable,
    tableName=`pt,
    partitionColumns=`sym
)

rows(pt)                         // 0
schema(db)
schema(pt).colDefs
```

Insert after creation:

```dos
data = table(
    1 2 3 as id,
    `A`B`C$SYMBOL as sym,
    10 20 30 as qty,
    take(now(), 3) as ts
)

tableInsert(pt, data)
```

For a single memory table row, `tableInsert(t, scalar1, scalar2, ...)` is acceptable. For partitioned tables, prefer inserting a table object.

## Dimension Tables And `createTable`

`createTable` is a database-handle method for creating an empty table from a schema table. In the verified runtime, ``db.createTable(schemaTable, `dim)`` failed for an in-memory database with `dbHandle must be a dfs database handle`.

Use it only when the target is a DFS database and the task really needs a DFS dimension table. If the task only needs local examples or tests, use a memory table:

```dos
dim = table(
    `A`B`C$SYMBOL as sym,
    100 200 300 as weight
)
```

## Loading Text

Use `loadText` for CSV-like files into memory:

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

- Prefer explicit `schema`. `loadText` type inference is sample-based and may infer unwanted types.
- Use `extractTextSchema(filePath)` when you need to inspect and edit the inferred schema.
- Use `format` in schema for non-standard temporal formats.
- When selecting columns with `schema.col`, keep indexes sorted; do not use `loadText` to reorder columns.

Use `loadTextEx` to load a file into a database:

```dos
db = database(directory="", partitionType=VALUE, partitionScheme=`A`B`C)
t = loadTextEx(
    dbHandle=db,
    tableName="",
    partitionColumns=`sym,
    filename=filePath,
    delimiter=",",
    schema=schema,
    containHeader=true
)
```

Rules:

- For memory databases, use empty `tableName` or omit it.
- For DFS databases, use a non-empty `tableName`.
- `partitionColumns` is a string scalar or vector.
- `transform` must be a unary function that accepts one table. When using `transform`, create the partitioned table before loading.

## Safe Generation Policy

- Probe with read-only functions first.
- Do not emit `dropDatabase`, `dropTable`, or broad delete/update statements by default.
- When code needs to create DFS objects, require a user-provided `dfs://...` path and table name.
- Show the assumed database path, table name, partition columns, and schema in the script.
- After creating or loading a table, return `schema(table).colDefs`, `rows(table)`, or a small verification table.
