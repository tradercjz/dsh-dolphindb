# CSV/TXT Import Plan Template

Follow these steps for a reliable CSV or TXT import:

**Note**: All text import functions support both `.csv` and `.txt` files.
Default delimiter is comma (","). For tab-separated `.txt` files, specify
`delimiter=char(9)` in the function call. DolphinDB does not support `	`
as an escape sequence; use `char(9)` to represent the Tab character.

## Step 1: Preview Schema

```sql
schema = extractTextSchema("/path/to/file.csv")   // or "/path/to/file.txt"
print(schema)
```

## Step 2: Verify and Correct Types

Check each column:
- Are numeric IDs incorrectly detected as INT? → Change to SYMBOL.
- Are date strings correctly detected? → Specify format if needed.
- Are LONG timestamps left as LONG? → Keep as LONG, convert later.

```sql
update schema set type = `SYMBOL where name = "ticker"
update schema set type = "DATETIME" where name = "trade_time"
schema[`format] = ["yyyyMMddHHmmss",,,]
```

## Step 3: Choose Import Method

- File < memory, target = memory table → `loadText` or `ploadText`
- Target = distributed table → `loadTextEx`
- File > memory → `textChunkDS` + `mr`

## Step 4: Create Database (if needed)

```sql
db = database("dfs://mydb", VALUE, 2024.01.01..2025.12.31, engine="TSDB")
```

## Step 5: Import

```sql
loadTextEx(db, "mytable", `date, "/path/to/file.csv",   // or "/path/to/file.txt"
           schema=schema, sortColumns=`sym`date)

// For tab-separated TXT files:
loadTextEx(db, "mytable", `date, "/path/to/file.txt",
           delimiter=char(9), schema=schema, sortColumns=`sym`date)
```

## Step 6: Verify

```sql
pt = loadTable("dfs://mydb", "mytable")
select count(*) from pt
select top 10 * from pt
```

## Confirmation Checkpoints

When importing CSV/TXT to a distributed table, follow these checkpoints:

1. **After schema preview**: if auto-detected types need correction, explain corrections to user before proceeding.
2. **Before creating distributed table**: use ask_user to confirm storage engine and partition scheme. Present options:
   - OLAP — Bulk analysis (default, recommended for general use)
   - TSDB — Time-series point queries
   - PKEY — Primary key uniqueness
   - IOTDB — IoT point management
3. **Before executing loadTextEx**: output the complete import plan (database path, table name, partition columns, sortColumns) and ask user to confirm.

When importing to a memory table, no confirmation is needed — proceed directly.

## Non-Interactive Mode (⚠️ CRITICAL for testing platform)

When the user's initial prompt provides ALL necessary information (file path, target form, database path, table name, engine, partition scheme, schema, type conversions, etc.), SKIP all `ask_user` confirmation steps and execute directly.

**DolphinX testing platform restrictions**:
- PROHIBITS `dropDatabase` and `dropTable` operations — NEVER use these functions
- Does NOT support interactive input — each case can only have one input and one output
- Always use `existsDatabase` + `existsTable` conditional creation logic to avoid conflicts

## DB/Table Existence 4-Branch Handling

Before creating a distributed table, MUST handle all 4 combinations of database/table existence:

```sql
dbExists = existsDatabase(dbPath)
tableExists = iif(dbExists, existsTable(dbPath, tableName), false)
if (!dbExists) {
    db = database(dbPath, VALUE, ..., engine="OLAP")
    db.createPartitionedTable(schemaTable, tableName, partitionColumns)
} else if (dbExists && !tableExists) {
    db = database(dbPath)
    db.createPartitionedTable(schemaTable, tableName, partitionColumns)
} else {
    db = database(dbPath)  // reuse existing table
}
```

**⚠️ API pitfall**: `existsTable` and `listTables` take a **path string** (e.g., `"dfs://sensor_db"`), NOT a `database()` object. `db.listTables()` will cause "db isn't an instance of a class" error — always use `listTables("dfs://path")` instead.
