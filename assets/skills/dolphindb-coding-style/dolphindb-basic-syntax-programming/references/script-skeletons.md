# Script Skeletons

Use these skeletons only when a task needs a complete runnable script template. Keep the final script self-contained unless the user explicitly provides external files, DFS paths, modules, or server-side resources.

## Simple Compute Script

```dos
// Inputs
qty = 10 20 30
price = 1.5 2.0 2.5

// Functions
def calcNotional(qty, price) {
    return qty * price
}

// Compute
notional = calcNotional(qty, price)

// Output
result = table(qty as qty, price as price, notional as notional)
result
```

Use this for scalar/vector/matrix logic. Return a concrete object at the end.

## Data Structure Mutation Script

```dos
// Dict with vector values
d = dict(STRING, ANY)
d[`IBM] = 1 2 3

v = d[`IBM]
v[1] = 20
d[`IBM] = v

// Table mutation
t = table(1 2 3 as id, `IBM`MSFT`GOOG$SYMBOL as sym, 10 20 30 as qty)
t.update!(`qty, <qty + 1>, <id <= 2>)
addColumn(t, `flag, BOOL)
t.update!(`flag, <qty > 20>)

result = dict(STRING, ANY)
result[`dictValue] = d[`IBM]
result[`tableSchema] = schema(t).colDefs
result[`tableRows] = rows(t)
result
```

Use `d[key] = value` for dictionary writes. If a dictionary value is a vector or table, mutate a local copy and assign it back.

## Memory Partitioned Table Script

```dos
// Memory VALUE database
db = database(directory="", partitionType=VALUE, partitionScheme=`A`B`C)

schemaTable = table(
    1:0,
    `id`sym`qty`ts,
    [INT, SYMBOL, INT, TIMESTAMP]
)

pt = createPartitionedTable(db, schemaTable, `pt, `sym)

data = table(
    1 2 3 as id,
    `A`B`C$SYMBOL as sym,
    10 20 30 as qty,
    take(now(), 3) as ts
)

inserted = tableInsert(pt, data)

result = dict(STRING, ANY)
result[`inserted] = inserted
result[`rows] = rows(pt)
result[`schema] = schema(pt).colDefs
result
```

Do not use ``loadTable(db, `pt)`` for in-memory database examples; keep the `pt` handle returned by `createPartitionedTable`.

## DFS Catalog Probe Script

```dos
dbs = getClusterDFSDatabases(false)
tables = getClusterDFSTables(false)

result = dict(STRING, ANY)
result[`dbCount] = size(dbs)
result[`tableCount] = size(tables)
result[`databases] = dbs
result[`tables] = tables

// Optional concrete probe
dbUrl = "dfs://example"
if(existsDatabase(dbUrl)) {
    result[`targetTables] = getDFSTablesByDatabase(dbUrl)
    result[`targetList] = listTables(dbUrl)
}

result
```

Use this before generating table reads or DDL against existing server state.

## DFS Table Read Script

```dos
dbUrl = "dfs://example"
tableName = `pt

if(!existsDatabase(dbUrl)) {
    throw "Database does not exist: " + dbUrl
}

if(!existsTable(dbUrl, tableName)) {
    throw "Table does not exist: " + dbUrl + "/" + string(tableName)
}

pt = loadTable(dbUrl, tableName)
colDefs = schema(pt).colDefs
sample = select top 10 * from pt

result = dict(STRING, ANY)
result[`schema] = colDefs
result[`sample] = sample
result
```

Remember that `top` needs an integer constant, not a variable or expression.

## LoadText Script

```dos
filePath = "/path/to/input.csv"

schema = table(
    `id`sym`qty`ts as name,
    `INT`SYMBOL`INT`TIMESTAMP as type
)

t = loadText(
    filename=filePath,
    delimiter=",",
    schema=schema,
    containHeader=true
)

result = dict(STRING, ANY)
result[`rows] = rows(t)
result[`schema] = schema(t).colDefs
result[`sample] = select top 5 * from t
result
```

Only use real file paths supplied by the user or discovered from the server environment.

## Validation Script

```dos
actual = sum(1 2 3)
expected = 6

assert "sum-basic", actual == expected

result = table(
    `sum-basic as caseName,
    actual as actual,
    expected as expected,
    actual == expected as passed
)

result
```

Use `assert` for required invariants. When returning a result table, include enough fields to see what was checked.

If a DolphinDB executor or syntax probe is available, run it before reporting the script as verified.

## Error Handling Script

```dos
result = dict(STRING, ANY)

try {
    x = 1 / 0
    result[`ok] = true
    result[`value] = x
} catch(ex) {
    result[`ok] = false
    result[`error] = string(ex)
    result[`errorType] = typestr(ex)
}

result
```

Use one `try` block around the operation being demonstrated. Do not hide unrelated setup errors unless the task asks for resilient batch processing.
