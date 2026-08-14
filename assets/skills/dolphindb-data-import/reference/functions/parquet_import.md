# Parquet Plugin Import Guide

Apache Parquet is a columnar storage format optimized for analytical queries.
DolphinDB provides the Parquet plugin for reading and writing Parquet files.

## Plugin Functions

**IMPORTANT**: Parquet plugin functions use the `parquet::` namespace prefix with "Parquet" in the function name.
Correct: `parquet::loadParquet`, `parquet::loadParquetEx`, `parquet::extractParquetSchema`.
Wrong: `parquet::load`, `parquet::loadEx`, `parquet::extractSchema` (these do NOT exist).
Wrong: `loadParquet`, `loadParquetEx`, `extractParquetSchema` (missing `parquet::` prefix).

| Function | Description |
|----------|-------------|
| `parquet::extractParquetSchema(fileName)` | Extract schema from Parquet file |
| `parquet::loadParquet(fileName, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum])` | Load Parquet file to memory table |
| `parquet::loadParquetEx(dbHandle, tableName, partitionColumns, fileName, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum], [transform])` | Load Parquet file to distributed table. partitionColumns is REQUIRED (not optional). No sortColumns. |
| `parquet::parquetDS(fileName, [schema])` | Create data source list for parallel processing |

## Step-by-Step Import

### Step 1: Load Plugin

```sql
try { loadPlugin("parquet") } catch(ex) { if (strpos(string(ex[1]), "already in use") == -1) { installPlugin("parquet"); loadPlugin("parquet") } }
```

### Step 2: Preview Schema

```sql
schema = parquet::extractParquetSchema("/data/trades.parquet")
// Override types if needed
update schema set type = `LONG where name = "volume"
```

### Step 3: Import to Memory Table

```sql
// Basic import
t = parquet::loadParquet("/data/trades.parquet")

// With schema override
t = parquet::loadParquet("/data/trades.parquet", schema)

// Load specific columns only (columnsToLoad — zero-based index)
// Example: load only columns 0 (date), 2 (price), 4 (volume)
t = parquet::loadParquet("/data/trades.parquet", , [0, 2, 4])

// Load specific row groups (for large files)
// startRowGroup: starting row group index (0-based)
// rowGroupNum: number of row groups to read
t = parquet::loadParquet("/data/trades.parquet", , , 0, 10)  // row groups 0-9
t = parquet::loadParquet("/data/trades.parquet", , , 5, 3)   // row groups 5-7

// Combine: load specific columns from specific row groups
t = parquet::loadParquet("/data/trades.parquet", , [0, 2, 4], 0, 10)
```

### Parquet Partial Loading Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| columnsToLoad | INT[] | Zero-based column indices to load. Only specified columns are read, reducing memory usage. |
| startRowGroup | INT | Starting row group index (0-based). Default: 0 (read from beginning). |
| rowGroupNum | INT | Number of row groups to read. Default: read all row groups. |

**When to use partial loading:**
- **columnsToLoad**: When you only need a subset of columns (e.g., only date and close price from a wide table with 100+ columns).
- **startRowGroup + rowGroupNum**: When processing a large Parquet file in batches, or when you only need data from specific row groups.
- **Combination**: When you need specific columns from specific row groups — most memory-efficient.

### Step 4: Import to Distributed Table

```sql
db = database("dfs://parquet_db", VALUE, 2024.01.01..2024.12.31)

// Basic import
parquet::loadParquetEx(db, "trades", `date, "/data/trades.parquet")

// With schema override
schema = parquet::extractParquetSchema("/data/trades.parquet")
parquet::loadParquetEx(db, "trades", `date, "/data/trades.parquet",
                schema)

// With transform for data cleaning
// ⚠️ When transform uses replaceColumn! or nullFill! (mutable functions),
// the parameter MUST be declared as `mutable t`
def cleanData(mutable t) {
    replaceColumn!(t, `ts, timestamp(exec ts from t))
    nullFill!(t, 0.0)
    return t
}
// ⚠️ When using transform, the partitioned table MUST be pre-created via
// createPartitionedTable BEFORE calling loadParquetEx
parquet::loadParquetEx(db, "trades", `date, "/data/trades.parquet",
                , , , , , cleanData)
```

### Step 5: Large File / Parallel Import

For very large Parquet files, use row group-based parallel import:

```sql
// Get total row groups
schema = parquet::extractParquetSchema("/data/huge.parquet")

// Import row groups in batches
def importParquetBatch(dbPath, tableName, partCol, filePath, startRG, numRG) {
    db = database(dbPath)
    t = parquet::loadParquet(filePath, , , startRG, numRG)
    loadTable(dbPath, tableName).append!(t)
}

// Submit parallel jobs (ensure different partitions to avoid conflict)
submitJob("pq_import_0", "", importParquetBatch,
          "dfs://pqdb", "trades", `date, "/data/huge.parquet", 0, 10)
submitJob("pq_import_1", "", importParquetBatch,
          "dfs://pqdb", "trades", `date, "/data/huge.parquet", 10, 10)
```

## Parquet Type Mapping

| Parquet Type | DolphinDB Type |
|-------------|---------------|
| BOOLEAN | BOOL |
| INT32 | INT |
| INT64 | LONG |
| FLOAT | FLOAT |
| DOUBLE | DOUBLE |
| BINARY (UTF8) | STRING |
| INT_8 | CHAR |
| INT_16 | SHORT |
| DATE | DATE |
| TIMESTAMP | TIMESTAMP / NANOTIMESTAMP |
| DECIMAL | DECIMAL32/64/128 |

## Critical Rules

1. **Parameter count limit**: `parquet::loadParquetEx` accepts 4~9 arguments ONLY. Parameter order: `(dbHandle, tableName, partitionColumns, fileName, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum], [transform])`. `transform` is the 9th (last) parameter. Do NOT pass more than 9 arguments.

2. **No sortColumns parameter**: `parquet::loadParquetEx` does NOT support `sortColumns`. If sortColumns is needed (TSDB engine), use `parquet::loadParquet` + `replaceColumn!` + `pt.append!(data)` instead.

3. **Partition column type CANNOT be transformed**: `loadParquetEx` uses the Parquet file's schema to create the partitioned table, so the partition column type is FIXED to the Parquet type. The `transform` function only transforms data AFTER it's loaded, but the partition scheme is determined at table creation time. If the Parquet has INT `date` but database requires DATE partition, `loadParquetEx` will fail. Solution: use `parquet::loadParquet` + `replaceColumn!` + `createPartitionedTable` (with correct DATE type) + `pt.append!`.

4. **transform requires pre-created table**: When using `transform` parameter, the partitioned table MUST be created BEFORE calling `loadParquetEx` using `db.createPartitionedTable(schemaTable, tableName, partitionColumns, [sortColumns])`. Without `transform`, `loadParquetEx` auto-creates the table.

5. **transform function mutable rules**:
   - Using `update t set col = ...` syntax: NO `mutable` keyword needed
   - Using `replaceColumn!(t, ...)` or `nullFill!(t, ...)`: parameter MUST be declared as `mutable t`

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot open file" | File not found or permission denied | Check file path and permissions |
| "Unsupported type" | Parquet type not mappable | Override with `parquet::extractParquetSchema` + update schema |
| "Out of memory" | File too large | Use row group-based batch import |
| "Plugin not loaded" | Parquet plugin not installed | Run `installPlugin("parquet"); loadPlugin("parquet")` |
| "Partition conflict" | Concurrent writes to same partition | Use serial import or `atomic='CHUNK'` |
