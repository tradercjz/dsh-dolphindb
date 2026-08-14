# HDF5 Plugin Import Guide

HDF5 is a binary data format widely used in scientific computing and analytics.
DolphinDB provides the HDF5 plugin for reading and writing HDF5 files.

## Plugin Functions

| Function | Description |
|----------|-------------|
| `hdf5::ls(filePath)` | List all groups and datasets in HDF5 file |
| `hdf5::lsTable(filePath)` | List all datasets in HDF5 file |
| `hdf5::HDF5DS(fileName, datasetName, [schema], [chunkSize])` | Create data source list for parallel processing |
| `hdf5::loadHDF5(fileName, datasetName, [schema], [startRow], [rowNum])` | Load HDF5 dataset to memory table |
| `hdf5::loadHDF5Ex(dbHandle, tableName, [partitionColumns], fileName, datasetName, [schema], [startRow], [rowNum], [transform])` | Load HDF5 dataset to distributed table. partitionColumns is optional (auto-determined for SEQ databases). No sortColumns. |
| `hdf5::extractHDF5Schema(filePath, datasetName)` | Extract schema from HDF5 dataset |

## Step-by-Step Import

### Step 1: Load Plugin

```sql
try { loadPlugin("hdf5") } catch(ex) { if (strpos(string(ex[1]), "already in use") == -1) { installPlugin("hdf5"); loadPlugin("hdf5") } }
```

### Step 2: Explore HDF5 File

```sql
// List all datasets
hdf5::lsTable("/data/candle_201801.h5")

// Get dataset metadata
hdf5::HDF5DS("/data/candle_201801.h5", "candle_201801")
```

### Step 3: Import to Memory Table

```sql
// Basic import
t = hdf5::loadHDF5("/data/candle_201801.h5", "candle_201801")

// With schema override (correct type detection)
schema = hdf5::extractHDF5Schema("/data/candle_201801.h5", "candle_201801")
update schema set type = `LONG where name = "volume"
t = hdf5::loadHDF5("/data/candle_201801.h5", "candle_201801", schema)
```

### Row Range Selection for HDF5

`hdf5::loadHDF5` supports `startRow` and `rowNum` parameters for reading a subset of rows.
`hdf5::loadHDF5Ex` also supports `startRow` and `rowNum` parameters.

**Method 1: Use startRow and rowNum (recommended)**
```sql
// Read rows 100-199 (startRow=100, rowNum=100)
t = hdf5::loadHDF5("/data/candle.h5", "candle_2024", , 100, 100)

// Read first 50 rows only
t = hdf5::loadHDF5("/data/candle.h5", "candle_2024", , 0, 50)

// loadHDF5Ex also supports startRow and rowNum
hdf5::loadHDF5Ex(db, "subset", `tradingDay,
                 "/data/candle.h5", "candle_2024", , 100, 100)
```

**Method 2: Load to memory, then filter with SQL**
```sql
// Load all data to memory table, then select specific rows
t = hdf5::loadHDF5("/data/candle.h5", "candle_2024", schema)
// Select rows 100-199
subset = select * from t limit 100, 100
```

**Recommendation**: Use `startRow`/`rowNum` parameters (Method 1) for efficient partial reads. Only use SQL filtering (Method 2) when you need complex row conditions beyond simple offset/limit.

### Step 4: Import to Distributed Table

**IMPORTANT**: `hdf5::loadHDF5Ex` does NOT support `sortColumns` parameter.
If the target table requires `sortColumns` (TSDB engine), use Method B below.

**Method A: loadHDF5Ex (without sortColumns)**
```sql
// For files that fit in memory, no sortColumns needed
db = database("dfs://hdf5db", VALUE, 2018.01.01..2018.01.31)
hdf5::loadHDF5Ex(db, "cycle", "tradingDay",
                 "/data/candle_201801.h5", "candle_201801")

// With schema and transform (type conversion during import)
schema = hdf5::extractHDF5Schema("/data/candle_201801.h5", "candle_201801")
def convertDate(mutable t) {
    replaceColumn!(t, `tradingDay, temporalParse(string(exec tradingDay from t), "yyyyMMdd"))
    return t
}
hdf5::loadHDF5Ex(db, "cycle", "tradingDay",
                 "/data/candle_201801.h5", "candle_201801", schema,
                 , , convertDate)
```

**Method B: loadHDF5 + replaceColumn! + append! (recommended when sortColumns is needed)**
```sql
// Step 1: Create distributed table with sortColumns
db = database("dfs://hdf5db", COMPO,
              [database("", VALUE, 2024.01.01..2024.12.31),
               database("", HASH, [SYMBOL, 10])], engine="TSDB")
schemaT = table(1:0, `symbol`tradingDay`open`high`low`close`volume,
                [SYMBOL, DATE, DOUBLE, DOUBLE, DOUBLE, DOUBLE, INT])
pt = db.createPartitionedTable(schemaT, "candle", `tradingDay`symbol,
                               sortColumns=`symbol`tradingDay)

// Step 2: Load HDF5 to memory table
t = hdf5::loadHDF5("/data/candle_201801.h5", "candle_201801")

// Step 3: Convert types with replaceColumn!
replaceColumn!(t, `tradingDay, temporalParse(string(exec tradingDay from t), "yyyyMMdd"))

// Step 4: Append to distributed table
pt.append!(t)
```

**CRITICAL WARNING for INT yyyyMMdd → DATE conversion**:
`date(INT_value)` does NOT correctly convert yyyyMMdd format integers to DATE.
It interprets the integer as days since 1970.01.01, producing completely wrong dates.
Always use `temporalParse(string(INT_value), "yyyyMMdd")` instead.

**CRITICAL WARNING for invalid dates in partition columns**:
`temporalParse` returns NULL for invalid dates (e.g., 20240132, 20240160 — January only has 31 days).
NULL values in partition columns cause import failure. Before importing, ALWAYS validate that
date conversion will not produce NULLs in partition columns. Use:
```sql
// Check for invalid dates before importing
select count(*) from t where temporalParse(string(exec tradingDay from t), "yyyyMMdd") == NULL
```
If invalid dates exist, either: (1) filter them out, (2) use a different partition column, or (3) handle them with a fallback strategy (e.g., map to nearest valid date).

### Step 5: Large File Import (Exceeds Memory)

For HDF5 files larger than available memory, use `loadHDF5Ex` which reads
data in batches and writes directly to disk:

```sql
db = database("dfs://hdf5db", VALUE, 2018.01.01..2018.01.31)
hdf5::loadHDF5Ex(db, "cycle", "tradingDay",
                 "/data/large_file.h5", "dataset1")
```

## Critical Rules

1. **loadHDF5Ex partition column type CANNOT be transformed**: `loadHDF5Ex` uses the HDF5 file's schema to create the partitioned table, so the partition column type is FIXED to the HDF5 type (e.g., INT). The `transform` function only transforms data AFTER it's loaded, but the partition scheme is determined at table creation time.
   - If HDF5 has INT `tradingDay` but database requires DATE partition: `loadHDF5Ex` will ALWAYS fail with "partitioning column type doesn't match"
   - Solution: MUST use `hdf5::loadHDF5` + `replaceColumn!` + `createPartitionedTable` (with correct DATE type) + `pt.append!`

2. **hdf5::ls vs hdf5::lsTable return DIFFERENT column structures**:
   - `hdf5::ls(path)` returns table with columns [objName, objType] — for exploring file structure
   - `hdf5::lsTable(path)` returns table with column [tableName] — for listing datasets
   - DO NOT mix column names: `ls` has no `name` or `tableName` column; `lsTable` has no `objName` or `objType` column
   - Recommended: use `hdf5::lsTable(path)` to get dataset names

3. **getLoadedPlugins() returns a TABLE with columns [plugin, version, user, time]**:
   - Correct: `exec plugin from getLoadedPlugins() where plugin = "HDF5"`
   - WRONG: `exec name from getLoadedPlugins()` (no `name` column)
   - WRONG: `getLoadedPlugins().has_key("HDF5")` (returns table not dict)

4. **datasetName must be string scalar**: `hdf5::extractHDF5Schema(path, datasetName)` and `hdf5::loadHDF5(path, datasetName)` require `datasetName` to be a STRING SCALAR, not a vector.
   - WRONG: `dsName = exec tableName from datasets limit 1` (returns vector)
   - Correct: `dsName = datasets.tableName[0]` (directly take first element as scalar)

5. **No sortColumns parameter**: `hdf5::loadHDF5Ex` does NOT support `sortColumns`. If sortColumns is needed (TSDB engine), use Method B below.

6. **transform requires pre-created table**: When using `transform` parameter, the partitioned table MUST be created BEFORE calling `loadHDF5Ex` using `db.createPartitionedTable(schemaTable, tableName, partitionColumns, [sortColumns])`.

7. **transform function mutable rules**:
   - Using `update t set col = ...` syntax: NO `mutable` keyword needed
   - Using `replaceColumn!(t, ...)`: parameter MUST be declared as `mutable t`

## Complex Type Handling

HDF5 supports compound (struct-like) types. The plugin maps them as follows:

| HDF5 Type | DolphinDB Type |
|-----------|---------------|
| int8/16/32/64 | CHAR/SHORT/INT/LONG |
| float32/64 | FLOAT/DOUBLE |
| string | STRING |
| compound (simple) | Multiple columns |
| compound (nested) | STRING (JSON representation) |
| variable-length | STRING or vector |

For compound types, use `extractHDF5Schema` to inspect the detected types
and override if needed.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot open file" | File not found or permission denied | Check file path and permissions |
| "Dataset not found" | Wrong dataset name | Use `hdf5::lsTable()` to list available datasets |
| "Type mismatch" | HDF5 type not mappable | Override with `extractHDF5Schema` + update schema |
| "Out of memory" | File too large for memory | Use `hdf5::loadHDF5Ex` for direct-to-disk import |
| "Plugin not loaded" | HDF5 plugin not installed | Run `installPlugin("hdf5"); loadPlugin("hdf5")` |
