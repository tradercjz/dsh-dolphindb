# Database and Table Creation Template

## Non-Interactive Mode (⚠️ CRITICAL for testing platform)

When the user's initial prompt provides ALL necessary information (database path, table name, engine, partition scheme, etc.), SKIP all `ask_user` confirmation steps and execute directly.

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
    // Create new database and table
    db = database(dbPath, VALUE, ..., engine="OLAP")
    db.createPartitionedTable(schemaTable, tableName, partitionColumns)
} else if (dbExists && !tableExists) {
    // Reuse existing database, create new table
    db = database(dbPath)
    db.createPartitionedTable(schemaTable, tableName, partitionColumns)
} else {
    // Reuse existing database and table
    db = database(dbPath)
}
```

**⚠️ API pitfall**: `existsTable` and `listTables` take a **path string** (e.g., `"dfs://sensor_db"`), NOT a `database()` object. `db.listTables()` will cause "db isn't an instance of a class" error — always use `listTables("dfs://path")` instead.

## OLAP Engine (Default)

> **Confirmation required**: Before executing CREATE DATABASE, use ask_user to confirm the storage engine selection with the user. Present the engine options and recommended default.

```sql
db = database("dfs://mydb", VALUE, 2024.01M..2024.12M)
schema = table(1:0, `date`sym`price`vol, [DATE, SYMBOL, DOUBLE, LONG])
pt = db.createPartitionedTable(schema, "trades", `date)
```

## TSDB Engine

```sql
db = database("dfs://mydb", VALUE, 2024.01M..2024.12M, engine="TSDB")
schema = table(1:0, `date`sym`price`vol, [DATE, SYMBOL, DOUBLE, LONG])
pt = db.createPartitionedTable(schema, "trades", `date,
    sortColumns=`sym`date, keepDuplicates=LAST)
```

## PKEY Engine

```sql
db = database("dfs://mydb", HASH, [INT, 8], engine="PKEY")
schema = table(1:0, `id`name`value, [INT, STRING, DOUBLE])
pt = db.createPartitionedTable(schema, "records", `id,
    primaryKey=["id"])
```

## Composite Partition

```sql
dbDate = database("", VALUE, 2024.01.01..2024.12.31)
dbSym = database("", HASH, [SYMBOL, 10])
db = database("dfs://compo", COMPO, [dbDate, dbSym])
schema = table(1:0, `date`sym`price`vol, [DATE, SYMBOL, DOUBLE, LONG])
pt = db.createPartitionedTable(schema, "trades", `date`sym)
```

## IOTDB Engine (IoT Point Management)

For IOTDB database and point table creation, see `templates/iotdb_creation.md`
for the complete step-by-step template with all mandatory rules.

## Dimension Table (Unpartitioned)

```sql
db = database("dfs://mydb", VALUE, 2024.01M..2024.12M)
dimSchema = table(1:0, `sym`name`sector, [SYMBOL, STRING, STRING])
dim = db.createDimensionTable(dimSchema, "sym_info")
```
