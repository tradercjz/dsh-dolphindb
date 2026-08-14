---
name: dolphindb-data-import
description: "DolphinDB data import guide for IoT and general scenarios. Covers CSV/TXT, JSON, binary, plugin-based (HDF5, Parquet, MySQL, ODBC), and IoT real-time ingestion (MQTT, OPC UA). Includes IOTDB engine, date/time conversion, array vector import, null handling, and binary record import. Does NOT cover database administration, permission management, stream compute engine configuration, or data export."
version: "1.1.0"
category: "dolphindb"
argument-hint: "[source type] [target database] [file path or connection] [IoT or general]"
disable-model-invocation: false
user-invocable: true
---

## DolphinDB Data Import Guide

Use this skill when the user asks about importing, loading, ingesting, or
migrating data into DolphinDB, including CSV/text files, JSON, binary files,
external databases, Parquet/HDF5 files, or IoT real-time data streams.

### Import Method Decision Tree

1. **CSV / text file → memory table**: use `loadText` (single-thread) or `ploadText` (parallel, faster for files > 16 MB).
2. **CSV / text file → distributed table**: use `loadTextEx` (recommended, direct-to-disk, avoids OOM for large files).
3. **Very large CSV file (> memory)**: use `textChunkDS` + `mr` to chunk and import.
4. **JSON string**: use `fromStdJson` (standard JSON) or `parseJsonTable` (JSON to table).
5. **Binary file with string columns**: use `loadRecord(filename, schema)`. Schema must be provided by user.
6. **Binary file without string columns**: use `readRecord!(handle, holder)`. Preferred for pure numeric files — simpler and safer.
7. **Parquet file → memory table**: use `parquet::loadParquet(filePath, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum])`. Supports partial column loading via `columnsToLoad` and row group selection via `startRowGroup`/`rowGroupNum`.
8. **Parquet file → distributed table**: use `parquet::loadParquetEx(dbHandle, tableName, partitionColumns, fileName, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum], [transform])`. Note: no `sortColumns` parameter; if sortColumns is needed, use `parquet::loadParquet` + `replaceColumn!` + `append!`.
9. **HDF5 file → memory table**: use `hdf5::loadHDF5(fileName, datasetName, [schema], [startRow], [rowNum])`. Supports row range selection via `startRow` and `rowNum`.
10. **HDF5 file → distributed table**: use `hdf5::loadHDF5Ex(dbHandle, tableName, [partitionColumns], fileName, datasetName, [schema], [startRow], [rowNum], [transform])`. Note: no `sortColumns` parameter; if sortColumns is needed, use `hdf5::loadHDF5` + `replaceColumn!` + `pt.append!(data)`.
11. **External database (MySQL, ODBC, etc.)**: use the corresponding plugin.
12. **IoT real-time data (MQTT)**: use MQTT plugin to subscribe to broker topics and write to stream tables.
13. **IoT real-time data (OPC UA)**: use OPC UA plugin to subscribe to server nodes and write to stream tables.
14. **IoT point management**: use IOTDB engine with IOTANY column and latestKeyCache for millisecond-level latest-value queries.

### Quick Reference: Core Import Functions

| Function | Target | Key Feature |
|----------|--------|-------------|
| `loadText` | Memory table | Single-thread; schema, skipRows, delimiter, partial columns via schema.col |
| `ploadText` | Memory table | Parallel; faster for > 16 MB |
| `loadTextEx` | Database table | Direct-to-disk; transform, sortColumns, skipRows |
| `textChunkDS` | Chunks for mr | Splits large file; use with `mr` |
| `extractTextSchema` | Schema preview | Auto-detect column types and delimiter |
| `loadRecord` | Memory table | Binary import with string support; schema required |
| `readRecord!` | Memory table | Binary import, no string support; holder required |
| `parquet::loadParquet` | Memory table | columnsToLoad, startRowGroup, rowGroupNum |
| `parquet::loadParquetEx` | Database table | Direct-to-disk; columnsToLoad, startRowGroup, rowGroupNum, transform (no sortColumns) |
| `hdf5::loadHDF5` | Memory table | Schema override; startRow, rowNum |
| `hdf5::loadHDF5Ex` | Database table | Direct-to-disk; startRow, rowNum, transform (no sortColumns) |

### Critical Rules

- **loadText/loadTextEx do NOT support rowNum parameter** (⚠️ CRITICAL — #1 cause of wasted React rounds): `loadText` and `loadTextEx` do NOT have a `rowNum` parameter. To preview data, use `select top N * from loadText(...)` or load first then `select top N`. NEVER attempt to pass `rowNum` to these functions — it will cause an error and waste a React round.
- **Delimiter auto-detection**: When `extractTextSchema` returns all columns merged into a single STRING column, it means the delimiter was not correctly detected. Automatically try these delimiters in order: (1) Tab: `char(9)` (most common for TXT files), (2) Semicolon: `;`, (3) Pipe: `|`. Re-run `extractTextSchema(filename, delimiter=char(9))` etc. until columns are properly separated.
- **skipRows semantics**: `skipRows=N` skips the first N lines of the file, INCLUDING the header row. When using `skipRows > 0`, you MUST provide a schema parameter (from `extractTextSchema`) because the header row will be skipped. If the user wants to skip N data rows but keep the header, do NOT use `skipRows` — instead, load all data with `loadText`, then use `select * from t where rowNo(t) >= N` or filter after import. `skipRows` does NOT count the header row separately — it counts from line 1 of the file.
- **Array vector import**: When a CSV column contains delimited values (e.g., "1.0,2.0,3.0"), it should be imported as an array vector. Steps: (1) `extractTextSchema` → (2) modify schema type to `DOUBLE[]` (or `INT[]` etc.) → (3) use `loadText(path, schema=schema, arrayDelimiter=",")`. The `arrayDelimiter` parameter tells DolphinDB how to split the values within each cell.
- **temporalParse with insufficient digit count**: When converting INT time values (e.g., 93000000) to TIME/TIMESTAMP using `temporalParse`, the string representation must match the format pattern length exactly. If the INT value has fewer digits than the format pattern requires, use `lpad(string(col), N, "0")` to pad with leading zeros. `lpad` is safe: it only pads strings shorter than N, and leaves strings already at length N or longer unchanged. Example: INT `93000000` (8 digits) → `lpad(string(93000000), 9, "0")` → `"093000000"` → `temporalParse("093000000", "HHmmssSSS")` → 09:30:00.000. INT `100000000` (9 digits) → `lpad(string(100000000), 9, "0")` → `"100000000"` (unchanged) → `temporalParse("100000000", "HHmmssSSS")` → 10:00:00.000. Always check digit count before applying temporalParse.
- **File path MUST be provided first**: If the user's message does NOT contain a file path (no string matching patterns like `/path/`, `.csv`, `.txt`, `.parquet`, `.h5`, `.bin`), you MUST use `ask_user` to ask for the file path BEFORE doing anything else. Do NOT attempt to execute any DolphinDB scripts until you have a file path. This is the FIRST step of the workflow and cannot be skipped.
- **Always preview schema first**: use `extractTextSchema(filename)` to check auto-detected types before importing. If types are wrong, modify the schema and pass it to the import function.
- **Date literals in DolphinDB**: use `2024.01.01` format, NOT `'2024-01-01'`.
- **Long integer timestamps**: import as LONG first, then convert with `timestamp()` function. Do NOT specify LONG timestamps as TIMESTAMP type directly in schema — it will produce NULL values.
- **Timezone handling**: use `localtime()` or `convertTZ()` to convert UTC timestamps to local time after import.
- **Header with numbers**: if column names start with digits, set `containHeader=true` to preserve names (system prefixes "c").
- **Partition conflict**: avoid parallel writes to the same partition. Use serial import or set `atomic='CHUNK'`.
- **Partition size**: recommended 100 MB to 1 GB per partition (uncompressed).
- **Null value handling**: use `nullFill`/`nullFill!` (fill with specific value), `ffill` (forward fill), `bfill`/`bfill!` (backward fill), `interpolate` (linear/pad/nearest/krogh interpolation), or `lfill!` (linear fill between endpoints). In `loadTextEx`, use `transform` parameter for one-step null filling during import.
- **FLOAT and DOUBLE cannot be used as partition columns**; convert STRING to SYMBOL for partitioning.
- **Script blocks are not function libraries**: copy script blocks from examples and replace placeholder variables (file paths, database names, table names); do not run entire example files, do not define or call custom functions.
- **Interactive decision-making**: when creating a distributed table, use ask_user to confirm storage engine and partition scheme before proceeding. Provide options with a recommended default. Do NOT ask about things you can determine yourself (e.g., file format from extension, schema from extractTextSchema, import method from file size).
- **Partial column loading**: For text files, use schema's `col` column to specify column indices (must be ascending). For Parquet, use `columnsToLoad` parameter (integer vector of zero-based column indices). For HDF5, load all columns then select.
- **Row skipping**: For text files, use `skipRows` (0-1024). For binary files, use `skipBytes` in `loadRecord` or `offset`/`length` in `readRecord!`. For Parquet, use `startRowGroup` and `rowGroupNum` to read specific row groups. For HDF5, use `startRow` and `rowNum` parameters in `loadHDF5`/`loadHDF5Ex`.
- **Binary file schema is mandatory**: DolphinDB cannot auto-detect binary file structure. ALWAYS obtain schema from user before using `loadRecord` or `readRecord!`. If user provides the writeRecord script, derive schema from it.
- **Data import workflow**: Follow the 10-step workflow (file path → format → metadata → user confirm → import method → preprocessing → final form → execute → verify → summary). Skip steps only when information is already provided or can be reliably inferred.
- **Schema confirmation is MANDATORY (Step 4)**: NEVER skip schema confirmation, even when all types appear correct and no conversion is needed. The user may want to adjust types, and their confirmation takes priority.
- **Memory table variable name confirmation**: When importing to a memory table, you MUST ask the user to confirm the variable name (e.g., `t` in `t = loadText(...)`). Suggest a default name based on the file name (e.g., `trades` for `trades.csv`). Before assigning, check if the variable name already exists using `try { objByName("varName", false) } catch(ex) { ... }`. If the name exists: (i) Ask the user whether to overwrite (use `undef(\`varName)` to delete the old variable, then reassign) or rename (provide a new name and validate uniqueness again). (ii) NEVER overwrite a variable without user confirmation. **⚠️ API note**: `existsShareVariable` only checks shared variables — for local variables, use the `try { objByName(...) } catch(ex)` pattern. To delete a local variable, use `undef(\`varName)`.
- **Existing database/table handling (⚠️ CRITICAL)**: Before creating a distributed table, check if the database and table already exist. Use `existsDatabase("dfs://path")` to check database, then `existsTable("dfs://path", "tableName")` to check table. **⚠️ API pitfall**: `existsTable` and `listTables` take a **path string** (e.g., `"dfs://sensor_db"`), NOT a `database()` object. `db.listTables()` will cause "db isn't an instance of a class" error — always use `listTables("dfs://path")` instead. If the database exists: (i) If `existsTable` returns false (table name differs from any existing table), import directly into the existing database without dropping it. (ii) If `existsTable` returns true (table name matches an existing table), determine the import mode by analyzing the prompt content: **Append import mode** (prompt explicitly mentions "append"/"追加", OR the table existed before this test flow — e.g., user pre-created the table for historical data accumulation): verify schema consistency between source data and existing table, adjust source data structure to match existing table schema, then append data. If schema mismatch or import fails, create a new table (preferably in the same database) and import there. **New table import mode** (prompt does NOT mention append, OR the table was created by a previous executor attempt in the same test flow): use `truncate(dbPath, tableName)` to clear existing data before import to avoid duplication from repeated executor attempts. In interactive mode, ask the user whether to append or overwrite. NEVER drop an existing database or table without explicit user confirmation.
- **Non-interactive mode (⚠️ CRITICAL — for automated testing/batch processing)**: When the user's initial prompt provides ALL necessary information (file path, target form, database path, table name, engine, partition scheme, schema, type conversions, etc.), SKIP all `ask_user` confirmation steps and execute directly. If the target database already exists and the table name conflicts, **use a new database path** (e.g., append a suffix) instead of dropping the old database — this avoids irreversible operations. **⚠️ Testing platform restriction**: The DolphinX testing platform PROHIBITS `dropDatabase` and `dropTable` operations. NEVER use these functions in testing scenarios — always use `existsDatabase` + `existsTable` conditional creation logic, or use a unique database path to avoid conflicts. **⚠️ Import mode handling when table exists**: When the table already exists, determine the import mode by analyzing the prompt: (i) If the prompt explicitly mentions "append"/"追加" → **append import mode**: verify schema consistency between source data and existing table (column count, partition column inclusion, column type compatibility), adjust source data structure to match existing table schema, then append data. If schema mismatch or import fails, create a new table (preferably in the same database with a new name) and import there. (ii) If the prompt does NOT mention append → **new table import mode**: use `truncate(dbPath, tableName)` to clear existing data before import to avoid duplication from repeated executor attempts within the same test flow. `truncate` preserves the table structure and only clears data — it is NOT a drop operation and is safe to use on the testing platform. If `truncate` fails, append to existing data and report a warning.
- **DB/Table existence 4-branch handling (⚠️ CRITICAL)**: When using `loadTextEx` + `transform` (or any import function that requires a pre-created table), MUST handle all 4 combinations of database/table existence:
  ```sql
  dbExists = existsDatabase(dbPath)
  tableExists = iif(dbExists, existsTable(dbPath, tableName), false)
  if (!dbExists) {
      // Branch 1: DB doesn't exist — create new DB and table
      db = database(dbPath, VALUE, ..., engine="OLAP")
      db.createPartitionedTable(schemaTable, tableName, partitionColumns)
  } else if (dbExists && !tableExists) {
      // Branch 2: DB exists but table doesn't — create table in existing DB
      db = database(dbPath)
      db.createPartitionedTable(schemaTable, tableName, partitionColumns)
  } else {
      // Branch 3 & 4: DB and table both exist
      db = database(dbPath)
      // Determine import mode by analyzing prompt:
      // - Append import (table existed before this test flow): verify schema, then append
      // - New table import (table from previous executor attempt): truncate to avoid duplication
      // Non-interactive mode defaults:
      // - If prompt mentions "append"/"追加": append mode (verify schema, then append)
      // - Otherwise: truncate mode (clear data, then import fresh)
      try { truncate(dbPath, tableName) } catch(ex) { /* truncate failed, append to existing data */ }
  }
  loadTextEx(db, tableName, partitionColumns, filePath, schema=schema, transform=transformFunc)
  ```
  Without this 4-branch logic, repeated runs will fail with "transform requires pre-created table" or "database already exists" errors. **⚠️ Data duplication prevention**: In non-interactive mode, if the table already exists and the prompt does NOT explicitly request append import, use `truncate(dbPath, tableName)` to clear existing data before import. This prevents data duplication caused by repeated executor attempts within the same test flow. `truncate` preserves the table structure and only clears data — it is NOT a drop operation and is safe on the testing platform. If `truncate` fails (e.g., permission error), append to existing data and report a warning.
- **transform function mutable rules (⚠️ CRITICAL)**: The `transform` function parameter is a constant reference by default.
  - Using `update t set col = ...` syntax: NO `mutable` keyword needed (recommended, simpler)
  - Using `replaceColumn!(t, ...)` or other mutable functions: parameter MUST be declared as `mutable t`
  - Example 1 (update syntax): `def cleanTransform(t) { update t set volume = nullFill(volume, 0); return t }`
  - Example 2 (mutable syntax): `def convertMarketData(mutable t) { replaceColumn!(t, `ts, timestamp(exec ts from t)); return t }`
  - WRONG: `def convert(t) { replaceColumn!(t, `col, ...) }` — will fail with "Constant variable [t] can't be used as argument for mutable function replaceColumn!"
- **transform requires pre-created table (⚠️ CRITICAL)**: When using `transform` parameter with `loadTextEx`/`loadParquetEx`/`loadHDF5Ex`, the partitioned table MUST be created BEFORE calling the import function using `db.createPartitionedTable(schemaTable, tableName, partitionColumns, [sortColumns])`. `loadTextEx` with `transform` does NOT auto-create the table. Without `transform`, `loadTextEx` auto-creates the table.
- **TSDB engine requires sortColumns (⚠️ CRITICAL)**: When using `engine="TSDB"`, `sortColumns` parameter is MANDATORY in `createPartitionedTable` and `loadTextEx`. If `sortColumns` is not needed, use `engine="OLAP"` instead. **OLAP engine does NOT support array vector types** (DOUBLE[], INT[]) — for array vectors, MUST use TSDB with `sortColumns`.
- **Engine-aware import verification (⚠️ CRITICAL — row count equality check fails for PKEY / TSDB+LAST/FIRST)**: After import, NEVER verify data correctness by simply comparing `afterCount - beforeCount == expectedImportCount` for ALL engines — this equality check is ONLY valid for non-overwrite scenarios (OLAP engine, or TSDB with `keepDuplicates=ALL`). For PKEY engine or TSDB with `keepDuplicates=LAST`/`keepDuplicates=FIRST`, the engine OVERWRITES existing rows with the same primary key (PKEY Merge-on-Write) or DEDUPLICATES rows with the same `sortColumns` value (TSDB+LAST/FIRST keeps only the last/first occurrence), so `afterCount - beforeCount` may be LESS than `expectedImportCount` even though the import succeeded. **For these overwrite/deduplication scenarios, MUST use the three-step key-existence check (Strategy B)** detailed in Step 9 of the workflow: (B1) `afterCount >= beforeCount`; (B2) `afterCount - beforeCount <= expectedImportCount`; (B3) extract unique key combinations via `select distinct keyCols from sourceData`, extract the same key combinations from the target table, use `ej(uniqueKeys, targetKeys, `keyCols)` to find matched keys, and verify `count(matchedKeys) == count(uniqueKeys)`. **⚠️ NEVER rely on `tableInsert`/`append!`/`loadTextEx` return values for verification**: For PKEY engines and key-value tables, `tableInsert` return value only counts NEW rows inserted (NOT rows updated due to key conflicts); `append!` and `loadTextEx` do not return inserted count at all. Always use SQL `select count(*)` and key-existence checks instead.
- **Key columns for engine-aware verification**: Determine the key columns for Strategy B based on the storage engine used at table creation time. (i) **PKEY engine**: use the columns declared in the `primaryKey` parameter of `createPartitionedTable`. (ii) **TSDB engine with keepDuplicates=LAST/FIRST**: use the columns declared in the `sortColumns` parameter. If `sortColumns` contains only ONE column that coincides with the partition column, append the partition column to form a composite key. (iii) For OLAP engine or TSDB with keepDuplicates=ALL, Strategy A (row count difference equality) is sufficient — no key-existence check needed.
- **sortColumns format (⚠️ CRITICAL)**: `sortColumns` accepts column name vector, NOT comma-separated string.
  - Single column: `sortColumns=`date`` or `sortColumns="date"` (string scalar)
  - Multiple columns: `sortColumns=`date`sym`` (backtick vector, recommended)
  - Variable reference: `sortColumns=colName` (variable value is string or symbol)
  - WRONG: `sortColumns="date,sym"` (interpreted as single column name "date,sym")
  - WRONG: `sortColumns=["date","sym"]` (string array, should use backticks)
- **loadHDF5Ex partition column type CANNOT be transformed (⚠️ CRITICAL)**: `loadHDF5Ex` uses the HDF5 file's schema to create the partitioned table, so the partition column type is FIXED to the HDF5 type (e.g., INT). The `transform` function only transforms data AFTER it's loaded, but the partition scheme is determined at table creation time.
  - If HDF5 has INT `tradingDay` but database requires DATE partition: `loadHDF5Ex` will ALWAYS fail with "partitioning column type doesn't match"
  - Solution: MUST use `hdf5::loadHDF5` + `replaceColumn!` + `createPartitionedTable` (with correct DATE type) + `pt.append!`
  - Same rule applies to `parquet::loadParquetEx`
- **IOTDB create table syntax (⚠️ CRITICAL — #1 cause of IOTDB import failure)**: IOTANY column can ONLY be created via SQL `create table` statement, NOT via `table()` function or `createPartitionedTable`.
  - Full syntax (SQL statement executed directly in DolphinDB script):
    ```sql
    create table `dfs://iot_db`.`sensors` (
        deviceId INT,
        location SYMBOL,
        timestamp TIMESTAMP,
        value IOTANY
    )
    partitioned by deviceId, timestamp
    sortColumns=`deviceId`location`timestamp
    latestKeyCache=true
    ```
  - Identifiers MUST use backticks (\`), NOT double quotes (")
  - `partitioned by` is followed by comma-separated column names (NOT backtick vector)
  - `sortColumns` uses backtick vector
  - `latestKeyCache=true` is a key-value pair connected with `=`
  - Common error: `schema must be provided to create table` indicates syntax parsing failure — check backticks and keywords
- **HDF5 plugin: ls vs lsTable (⚠️ CRITICAL)**: `hdf5::ls` and `hdf5::lsTable` return DIFFERENT column structures:
  - `hdf5::ls(path)` returns table with columns [objName, objType] — for exploring file structure
  - `hdf5::lsTable(path)` returns table with column [tableName] — for listing datasets
  - DO NOT mix column names: `ls` has no `name` or `tableName` column; `lsTable` has no `objName` or `objType` column
  - Recommended: use `hdf5::lsTable(path)` to get dataset names, then use `tableName[0]` as scalar
- **getLoadedPlugins() column names (⚠️ CRITICAL)**: `getLoadedPlugins()` returns a TABLE with EXACTLY these columns: [plugin, version, user, time].
  - Correct: `exec plugin from getLoadedPlugins() where plugin = "HDF5"`
  - WRONG: `exec name from getLoadedPlugins()` (no `name` column)
  - WRONG: `exec pluginName from getLoadedPlugins()` (no `pluginName` column)
  - WRONG: `getLoadedPlugins().has_key("HDF5")` (returns table not dict)
- **HDF5 plugin: datasetName must be string scalar (⚠️ CRITICAL)**: `hdf5::extractHDF5Schema(path, datasetName)` and `hdf5::loadHDF5(path, datasetName)` require `datasetName` to be a STRING SCALAR, not a vector.
  - WRONG: `dsName = exec tableName from datasets limit 1` (returns vector)
  - Correct: `dsName = exec tableName from datasets limit 1; dsName = dsName[0]` (take first element as scalar)
  - Correct: `dsName = datasets.tableName[0]` (directly take first element)
- **dict() construction rules (⚠️ CRITICAL)**:
  - Syntax: `dict(keyVector, valueVector)` or `dict(\`key1\`key2, [val1, val2])`
  - key and value count MUST be equal
  - WRONG: `dict(["a","b"], [v1])` (count mismatch)
  - WRONG: `dict(["a","b"], [exec count(*) from pt, exec sum(x) from pt])` (embedding exec SQL causes parser confusion)
  - Correct: `rowCount = exec count(*) from pt; dict(["rows"], [rowCount])` (store in variable first)
  - WRONG: `dict(["a","b"] as \`a\`b, ...)` (as syntax not applicable to dict)
- **DolphinDB reserved words (⚠️ CRITICAL)**: DO NOT use these as variable names:
  - `name`, `type`, `tuple`, `dict`, `table`, `select`, `exec`, `from`, `where`, `by`, `update`, `insert`, `delete`
  - Use `colName` instead of `name`, `dataTuple` instead of `tuple`
  - In schema tables, `name` and `type` are column names, not variable names
- **DolphinDB has NO .limit() method (⚠️ CRITICAL)**: Tables in DolphinDB do NOT have a `.limit()` method. To get top N rows:
  - Correct: `select top 10 * from tableName`
  - Correct: `tableName[:10]` (take first 10 rows)
  - WRONG: `tableName.limit(10)` (no such method)
  - WRONG: `tableName.head(10)` (no such method)
- **DolphinDB function name pitfalls**: DolphinDB built-in functions are LOWERCASE and case-sensitive. Common mistakes:
  - `strLen` → should be `strlen`
  - `IsValid` → should be `isvalid` (but isvalid doesn't exist, use other methods)
  - `Count` → should be `count`
  - `Exists` → should be `existsDatabase`/`existsTable`/`existsShareVariable`
  - `valid()` function does NOT exist — use `t.size() > 0` or `count(t) > 0` to check vector emptiness
- **loadParquetEx parameter count (⚠️ CRITICAL)**: `parquet::loadParquetEx` accepts 4~9 arguments ONLY. Parameter order: `(dbHandle, tableName, partitionColumns, fileName, [schema], [columnsToLoad], [startRowGroup], [rowGroupNum], [transform])`. `transform` is the 9th (last) parameter. Do NOT pass more than 9 arguments.
- **schema() function usage**: `schema(table)` returns a schema object (NOT a table).
  - Correct: `schema(pt)` returns directly
  - Correct: `schema(pt).colDefs` gets column definition table
  - WRONG: `select name, type from schema(pt)` (schema() cannot be used in FROM clause)
- **extractTextSchema returns metadata table, NOT schema table (⚠️ CRITICAL)**: `extractTextSchema` returns a table with columns [name, type, ...] describing the schema. To use it with `createPartitionedTable`, convert it to an empty table first: `schemaTable = table(1:0, schema.name, schema.type)`. NEVER pass `extractTextSchema` result directly to `createPartitionedTable`.
- **Derived partition column**: When the source data has no suitable partition column but has a timestamp column, derive a DATE column from the timestamp for partitioning.
  - Example: `addColumn(t, `trade_date, DATE); t[`trade_date] = date(exec timestamp from t)`
  - Then use `trade_date` as the partition column
- **File deletion in DolphinDB**:
  - `rmdir(path)`: deletes EMPTY directory only, NOT files
  - `deleteFile(path)`: deletes a file (correct function for file deletion)
  - For temporary files, use `try { deleteFile(path) } catch(ex) {}` pattern
- **Plugin function parse-time recognition**: Plugin functions with `::` prefix (e.g., `parquet::extractParquetSchema`, `hdf5::lsTable`) are recognized at PARSE time. If the plugin is not loaded before parsing, the function call will fail with "Cannot recognize function".
  - Solution 1: Use `use pluginName` after `loadPlugin` to import namespace, then call bare function names
  - Solution 2: Ensure `loadPlugin` is called BEFORE the script block containing `::` functions
  - Solution 3: For compile probe, wrap plugin calls in try/catch or use `use` approach
- **JSON serialization limitations**: `toStdJson()` and `internalToStdJson` do NOT support all data forms:
  - Supported: STRING, INT, DOUBLE, BOOL, DATE, TIMESTAMP and other scalars and vectors
  - NOT supported: PAIR, MATRIX, DICT, SET and other complex data forms
  - Solution: convert complex types to simple vectors before serialization, or use `string()` conversion

### Confirmation Strategy

Data import involves irreversible operations. Follow these confirmation rules:

**Mandatory Confirmation (must stop and ask user before proceeding):**
- If the user has not provided a file path: ask via ask_user to provide one. If the user's message does NOT contain a file path (no string matching patterns like `/path/`, `.csv`, `.txt`, `.parquet`, `.h5`, `.bin`), you MUST use `ask_user` to ask for the file path BEFORE doing anything else. Do NOT attempt to execute any DolphinDB scripts until you have a file path. This is the FIRST step of the workflow and cannot be skipped. If the user does not provide a file path, end the workflow gracefully.
- If the user has not specified the target form (memory table vs distributed table): ask via ask_user. Default is memory table.
- **Memory table variable name confirmation**: When importing to a memory table, you MUST ask the user to confirm the variable name (e.g., `t` in `t = loadText(...)`). Suggest a default name based on the file name (e.g., `trades` for `trades.csv`). Before assigning, check if the variable name already exists using:
  ```sql
  try { objByName("varName", false); varExists = true } catch(ex) { varExists = false }
  ```
  If the name exists, ask the user whether to overwrite (use `undef(\`varName)` then reassign) or rename. NEVER overwrite a variable without user confirmation.
- Before creating a distributed table: output engine selection, partition scheme, schema mapping, and confirmation question; wait for user confirmation before executing CREATE DATABASE/TABLE. NEVER assume a database path — always ask the user to confirm.
- **Existing database/table handling (⚠️ CRITICAL)**: Before creating a distributed table, check both database and table existence. Use the following code pattern:
  ```sql
  dbExists = existsDatabase("dfs://path")
  tableExists = iif(dbExists, existsTable("dfs://path", "tableName"), false)
  ```
  **⚠️ API pitfall**: `existsTable("dfs://path", "tableName")` and `listTables("dfs://path")` take a **path string**, NOT a `database()` object. `db.listTables()` will cause "db isn't an instance of a class" error. If the database exists: (i) If `existsTable` returns false (table name differs from any existing table), import directly into the existing database without dropping it. (ii) If `existsTable` returns true (table name matches an existing table), ask the user whether to overwrite (drop and recreate) or append. NEVER drop an existing database or table without explicit user confirmation.
- Before binary file import: output inferred schema and data preview; wait for user confirmation that the schema is correct before executing loadRecord or readRecord!.
- **Schema confirmation is MANDATORY (Step 4)**: After parsing metadata, present the COMPLETE schema (with auto-detected time-type suggestions) to the user via ask_user and wait for confirmation. NEVER skip this step, even when all types appear correct and no conversion is needed — the user may want to adjust types, and their confirmation takes priority.

**Conditional Confirmation (stop and ask when unclear):**
- Storage engine is not specified and multiple reasonable choices exist.
- Partition scheme has multiple reasonable options — present specific choices based on data columns and selected engine (e.g., VALUE(time_col), HASH(category_col, N), COMPO(VALUE + HASH)). For IOTDB, only COMPO with time as LAST dimension.
- Column type is ambiguous: STRING columns containing delimited values that may be array vectors (e.g., "1.0,2.0,3.0"), or LONG/INT columns containing values that look like dates (8-digit integers) or timestamps (10-13 digit integers). Use ask_user to confirm the intended type and any conversion format.
- Date/time format cannot be inferred from data sample.
- Null handling strategy may affect business semantics.

**Can Continue But Must Explain:**
- File format inferred from extension — state the inference basis.
- Schema correction following skill rules (e.g., LONG timestamp → timestamp()) — state what was corrected.
- Import method auto-selected by file size — state the selection basis.

### Quick Path

- When user instruction already specifies engine, partition scheme, or target table, skip corresponding confirmation points and proceed directly.
- When user requests quick import, use defaults (OLAP engine + VALUE partition) and skip non-mandatory confirmations; state which confirmations were skipped.
- When user provides the writeRecord script that created a binary file, derive schema from that script directly; no need to ask about schema.

### Workflow

Follow these steps in order. For each step, if the information is already provided by the user or can be reliably inferred, proceed without asking. If confirmation is needed, use ask_user.

1. **Confirm file path**: Verify the data file path provided by the user. If the user's message does NOT contain a file path (no string matching patterns like `/path/`, `.csv`, `.txt`, `.parquet`, `.h5`, `.bin`), you MUST use `ask_user` to ask for the file path BEFORE doing anything else. Do NOT attempt to execute any DolphinDB scripts until you have a file path. This is the FIRST step of the workflow and cannot be skipped. If the user does not provide a file path, end the workflow gracefully.
2. **Identify file format**: Auto-detect format from file extension (.csv, .txt, .bin, .parquet, .h5/.hdf5) or file header. If ambiguous, ask the user.
3. **Parse metadata**: For text files, use `extractTextSchema(filename, [delimiter])` to preview column names, types, and delimiter. For Parquet, use `parquet::extractParquetSchema`. For HDF5, use `hdf5::extractHDF5Schema` (after loading plugin and exploring with `hdf5::lsTable`). For binary files, there is no auto-detection function — the schema MUST be provided by the user (see Binary File Schema below).
4. **Auto-detect time-type columns and present schema for user confirmation**: Apply the Time-Type Auto-Detection rules below to identify columns that may need type conversion. Present the COMPLETE schema (including auto-detected type suggestions) to the user via ask_user. The user MUST confirm the schema before proceeding. This step is MANDATORY — never skip it, even when all types appear correct and no conversion is needed. The user may want to adjust types, and their confirmation takes priority.
5. **Confirm target form**: If the user has not specified the target form, ask: memory table or distributed table? Default is memory table if not specified. If memory table:
   - Ask user to confirm the variable name (e.g., `t` in `t = loadText(...)`). Suggest a default name based on the file name (e.g., `trades` for `trades.csv`).
   - Before assigning, check if the variable name already exists using:
     ```sql
     try { objByName("varName", false); varExists = true } catch(ex) { varExists = false }
     ```
     If the name exists, ask the user whether to overwrite (use `undef(\`varName)` then reassign) or rename. NEVER overwrite a variable without user confirmation.
   If distributed table:
   - Ask user to confirm database path and table name (suggest defaults based on file name). NEVER assume a database path without user confirmation.
   - Before creating, check both database and table existence using:
     ```sql
     dbExists = existsDatabase("dfs://path")
     tableExists = iif(dbExists, existsTable("dfs://path", "tableName"), false)
     ```
     **⚠️ API pitfall**: `existsTable` and `listTables` take a **path string** (e.g., `"dfs://sensor_db"`), NOT a `database()` object. `db.listTables()` will cause "db isn't an instance of a class" error — always use `listTables("dfs://path")` instead.
     If the database exists: (i) If `existsTable` returns false (table name differs from any existing table), import directly into the existing database without dropping it. (ii) If `existsTable` returns true (table name matches an existing table), ask the user whether to overwrite (drop and recreate) or append via ask_user. NEVER drop an existing database or table without explicit user confirmation.
   - Ask user to confirm storage engine (OLAP/TSDB/PKEY/IOTDB) with recommended default.
   - Ask user to confirm partition scheme with specific options based on data columns.
6. **Confirm import method**: Based on file format and target, select the appropriate import function:
   - Text → memory table: `loadText` or `ploadText`
   - Text → distributed table: `loadTextEx`
   - Text → very large file: `textChunkDS` + `mr`
   - Binary with string columns: `loadRecord`
   - Binary without string columns: `readRecord!` (preferred)
   - Parquet → memory table: `parquet::loadParquet`
   - Parquet → distributed table (no sortColumns needed): `parquet::loadParquetEx`
   - Parquet → distributed table (sortColumns needed): `parquet::loadParquet` + `replaceColumn!` + `pt.append!(data)`
   - HDF5 → memory table: `hdf5::loadHDF5`
   - HDF5 → distributed table (no sortColumns needed): `hdf5::loadHDF5Ex`
   - HDF5 → distributed table (sortColumns needed): `hdf5::loadHDF5` + `replaceColumn!` + `pt.append!(data)`
7. **Data preprocessing**: Apply any user-specified or default preprocessing before or during import:
   - Specify date/time format for date columns (via schema `format` column or `replaceColumn!` after import)
   - Select specific columns to import (via schema `col` column for text files, `columnsToLoad` for Parquet)
   - Skip rows (via `skipRows` for text files, `skipBytes` for binary files)
   - Handle null values (via `transform` parameter with `nullFill!`, `ffill!`, etc.)
   - For Parquet: specify `startRowGroup` and `rowGroupNum` to read specific row groups; specify `columnsToLoad` to load specific columns
   - For HDF5: use `startRow` and `rowNum` parameters in `hdf5::loadHDF5`/`hdf5::loadHDF5Ex` for efficient row range selection
8. **Execute import**: Run the import script. If errors occur, diagnose and fix (e.g., schema mismatch, partition conflict, plugin not loaded).
9. **Verify result**: Execute `select count(*) from tableName` (NOT `tableName.count()`) and `select top 10 * from tableName`. For distributed tables, `tableName.count()` may return 0 or incorrect results — always use SQL `select count(*)`.

   **⚠️ Verification mode depends on import mode (determined by prompt content and table existence check — see "Existing database/table handling" and "Non-interactive mode" rules)**:

   **Non-append import mode (DEFAULT — new table OR truncate-then-import)**: After import, simply verify `exec count(*) from loadTable(dbPath, tableName) == expectedImportCount` and check `select top 10 * from loadTable(dbPath, tableName)` for data correctness. Since the table was either newly created or cleared with `truncate(dbPath, tableName)` before import, there are NO pre-existing rows to conflict with — the final row count should exactly equal the source data row count for ALL storage engines (OLAP, TSDB, PKEY, IOTDB). No beforeCount/afterCount tracking or key-existence check is needed in this mode.

   **Append import mode (⚠️ engine-aware verification REQUIRED — ONLY when prompt explicitly mentions "append"/"追加")**: When data is appended to an existing table that already contains rows, the simple row-count equality check may FAIL for overwrite/deduplication engines. In append mode, MUST use the engine-aware verification mechanism based on the storage engine, because `tableInsert`/`append!`/`loadTextEx` return values are unreliable for PKEY/key-value tables (PKEY engine only counts NEW rows, not updates from key conflicts; `append!` and `loadTextEx` do not return inserted count at all):

   **Strategy A — Row count difference check (non-overwrite engines)**: Use when the storage engine is `OLAP`, or `TSDB` with `keepDuplicates=ALL` (default). Every appended row is added without deduplication, so the row count difference accurately reflects imported rows:
   ```sql
   beforeCount = exec count(*) from loadTable(dbPath, tableName)
   // ... execute append import ...
   afterCount = exec count(*) from loadTable(dbPath, tableName)
   expectedImportCount = /* row count of source data */
   // Verify exact equality:
   if (afterCount - beforeCount == expectedImportCount) { /* success */ }
   ```

   **Strategy B — Key existence check (overwrite/deduplication engines)**: Use when the storage engine is `PKEY`, or `TSDB` with `keepDuplicates=LAST` or `keepDuplicates=FIRST`. In append mode, the engine may OVERWRITE existing rows with the same primary key (PKEY) or KEEP only the last/first occurrence (TSDB+LAST/FIRST), so `afterCount - beforeCount` may be LESS than `expectedImportCount` — the row count difference equality check (Strategy A) WILL FAIL. Use **three-step verification** instead:
   ```sql
   // Step 1: record beforeCount BEFORE append import
   beforeCount = exec count(*) from loadTable(dbPath, tableName)
   // ... execute append import ...
   // Step 2: record afterCount AFTER append import
   afterCount = exec count(*) from loadTable(dbPath, tableName)
   // Step 3: extract unique key combinations from source data
   //   - PKEY engine: use the columns declared in `primaryKey`
   //   - TSDB engine with keepDuplicates=LAST/FIRST: use `sortColumns` columns
   //   - If sortColumns == partition column only, append the partition column to form a composite key
   uniqueKeys = select distinct keyCol1, keyCol2 from sourceData
   // Step 4: extract the same key combinations from the target table
   targetKeys = select distinct keyCol1, keyCol2 from loadTable(dbPath, tableName)
   // Step 5: use ej (inner join) to find keys present in BOTH uniqueKeys and targetKeys
   matchedKeys = ej(uniqueKeys, targetKeys, `keyCol1`keyCol2)
   ```
   Verify three conditions (all must hold):
   - **B1 (lower bound)**: `afterCount >= beforeCount` — rows must not decrease after append import.
   - **B2 (upper bound)**: `afterCount - beforeCount <= expectedImportCount` — appended rows must not exceed source row count.
   - **B3 (key existence)**: `exec count(*) from matchedKeys == exec count(*) from uniqueKeys` — every unique key in the source data MUST exist in the target table.

   **Determining key columns (Strategy B only)**:
   - PKEY engine: use the `primaryKey` parameter columns specified in `createPartitionedTable`.
   - TSDB engine with keepDuplicates=LAST/FIRST: use the `sortColumns` parameter columns. If `sortColumns` contains only one column that coincides with the partition column, include the partition column to form a composite key.

   **⚠️ Why Strategy A fails for PKEY/TSDB+LAST/FIRST in append mode**: PKEY engine uses Merge-on-Write — when a new row has the same primary key as an existing row, the new row OVERWRITES the existing row (UPDATE), not an INSERT. The engine increments the row count only by the number of NEW primary keys, which may be less than `expectedImportCount`. Similarly, TSDB+LAST/FIRST deduplicates rows with the same `sortColumns` value, keeping only the last/first occurrence — repeated keys reduce the final row count. Therefore, `afterCount - beforeCount` no longer equals `expectedImportCount`, and the equality check in Strategy A is invalid. Use Strategy B (key existence check) instead.

   **⚠️ NEVER rely on `tableInsert`/`append!`/`loadTextEx` return values for verification in append mode**: For PKEY engines and key-value tables, `tableInsert` return value only counts NEW rows inserted (NOT rows updated due to key conflicts); `append!` and `loadTextEx` do not return inserted count at all. Always use SQL `select count(*)` and key-existence checks instead.
10. **Output summary**: Report data source, row count, target table, storage engine, partition scheme, any type conversions applied, and warnings.

### Time-Type Auto-Detection Rules

When parsing metadata, automatically identify columns that may be time-related and suggest type conversions. Present these suggestions to the user for confirmation in Step 4.

**Detection by column name pattern** (case-insensitive):
- Column name contains `date`, `day`, `trade_day`, `trading_day` → likely DATE or INT yyyyMMdd
- Column name contains `time`, `timestamp`, `ts` → likely TIME, TIMESTAMP, or LONG timestamp
- Column name contains `datetime` → likely DATETIME or TIMESTAMP

**Detection by data type and value pattern**:
- INT column with 8-digit values (e.g., 20240101) → likely yyyyMMdd date. Suggest: DATE via `temporalParse(string(col), "yyyyMMdd")`
- INT column with 6-digit values (e.g., 930000) → likely HHmmss time. Suggest: TIME via `temporalParse(string(col), "HHmmss")`
- INT column with 9-digit values (e.g., 93000000) → likely HHmmssSSS time. Suggest: TIME via `temporalParse(string(col), "HHmmssSSS")`
- LONG column with 10-digit values → likely second-level Unix timestamp. Suggest: TIMESTAMP via `timestamp(col)`
- LONG column with 13-digit values → likely millisecond-level Unix timestamp. Suggest: TIMESTAMP via `timestamp(col)`
- LONG column with 16-digit values → likely microsecond-level timestamp. Suggest: NANOTIMESTAMP via `nanotimestamp(col)`
- STRING column matching date patterns → use `temporalParse` with appropriate format

**User intent takes priority**: If the user explicitly specifies a type conversion (e.g., "ts列转换为TIMESTAMP"), always follow the user's specification. If the user's specification causes errors, provide a clear error message and suggest the correct approach.

**Invalid date flexible conversion** (⚠️ CRITICAL — never silently drop data): When `temporalParse(string(col), "yyyyMMdd")` returns NULL for some values, it means those values are invalid dates (e.g., January 32nd = 20240132). Instead of simply filtering out NULL rows (which causes data loss), try to interpret the invalid dates intelligently:
- If the pattern suggests the dates are sequential (e.g., 20240131, 20240132, 20240133), treat the excess day numbers as continuing into the next month: 20240132 → 2024.02.01, 20240133 → 2024.02.02, etc.
- Use this formula: `date(2024.01.01) + (tradingDay - 20240101)` where `20240101` is the base date and `tradingDay` is the INT value. This converts sequential day numbers to actual dates.
- Always present the conversion approach to the user for confirmation before proceeding.
- NEVER silently drop data rows due to invalid date conversion.

**Presentation format for Step 4**:
Present the schema as a table with columns: Column Name | Original Type | Suggested Type | Conversion Method
Mark auto-detected suggestions with [auto]. Let user confirm or modify.

### Distributed Table Creation Checklist

When creating a distributed table, follow this checklist to avoid common errors:
1. Use `createPartitionedTable` (NOT `createTable`) for partitioned tables.
2. Schema table must match the final column types (after conversion), not the raw file types.
3. Partition column types must match the actual data types in the table (e.g., if tradingDay is converted to DATE, partition column must be DATE, not INT).
4. For TSDB engine, `sortColumns` is required. Use `pt.append!(data)` (NOT `data.append!(pt)`) when appending data.
5. For `parquet::loadParquetEx` and `hdf5::loadHDF5Ex`: these do NOT support `sortColumns`. Use `loadParquet`/`loadHDF5` + `replaceColumn!` + `pt.append!(data)` instead.
6. Before importing, validate that date conversion will not produce NULLs in partition columns (e.g., invalid dates like 20240132 will cause `temporalParse` to return NULL, which cannot be used as partition key).
7. **Partition range validation (⚠️ CRITICAL)**: Before creating a database with RANGE or VALUE partitioning on a date/time column, you MUST query `min(partitionColumn)` and `max(partitionColumn)` from the actual data to determine the correct partition boundaries. NEVER assume the data range — always verify with actual data. After import, ALWAYS verify data correctness using the **engine-aware verification mechanism** described in Step 9 (Strategy A row-count difference equality for OLAP / TSDB+ALL; Strategy B key-existence check for PKEY / TSDB+LAST/FIRST). If verification fails, investigate immediately (likely causes: partition range too narrow causing silent data drop, PKEY/TSDB deduplication reducing row count, or import errors). When the user specifies a partition scheme (e.g., VALUE(date)), you MUST use that scheme. If the data range exceeds the partition boundaries, expand the boundaries rather than switching to a different partition scheme.
8. **Existing database/table check (⚠️ CRITICAL)**: Before creating, always check both database and table existence:
   ```sql
   dbExists = existsDatabase("dfs://path")
   tableExists = iif(dbExists, existsTable("dfs://path", "tableName"), false)
   ```
   - If `dbExists=false`: create new database and table.
   - If `dbExists=true` and `tableExists=false`: reuse existing database, create new table in it.
   - If `dbExists=true` and `tableExists=true`: ask user whether to overwrite (drop and recreate) or append. NEVER drop without user confirmation.
   **⚠️ API pitfall**: `existsTable("dfs://path", "tableName")` takes path string, NOT `database()` object. `db.listTables()` causes "db isn't an instance of a class" error — use `listTables("dfs://path")` instead.

### Binary File Schema

DolphinDB does NOT provide a function to auto-detect the structure of binary files. The schema (column names, data types, and string column lengths) MUST be obtained from one of the following sources:

1. **User provides the writeRecord script** that created the file — derive schema from the source table definition. This is the most reliable method. **When schema is derived from the writeRecord script, proceed directly to import. Do NOT attempt to verify file size or record count — this wastes react rounds and is unnecessary when schema is already known.**
2. **User provides the schema directly** — column names, data types, and string column lengths.
3. **User provides partial information** — e.g., column names only, or data types only. Use ask_user to fill in the gaps.

**Why auto-inference is not feasible**: A binary file is a raw byte sequence. The same file size can correspond to many different column type combinations (e.g., 8 bytes could be 1 LONG, or 2 INTs, or 1 DOUBLE). Without external metadata, it is impossible to reliably determine the schema. Even if the record count is known, the column count and types remain ambiguous. Therefore, ALWAYS ask the user for the schema before using `loadRecord` or `readRecord!`.

**Getting file size in DolphinDB** (only when truly needed): DolphinDB does NOT have `getFileSize()` or `fileSize()` functions. Use one of these two methods:
- `file(path).seek(0, TAIL)` — returns file size in bytes (recommended for single file).
- `select fileSize from files(directory) where filename = "name"` — returns file size from directory listing.
Do NOT attempt non-existent functions like `getFileSize()`, `fileSize()`, or `file(path).size()`.

### React Round Conservation

The agent has a limited number of react rounds (tool calls). To avoid running out of rounds:
- **Do NOT verify information that is already known.** If the user provides the writeRecord script, derive schema directly and proceed — do NOT check file size or record count.
- **Do NOT retry failed DolphinDB scripts with minor variations.** If a function call fails (e.g., `db.listTables()` returns "db isn't an instance of a class"), STOP immediately and check the correct function signature in this skill's reference files. NEVER retry the same failing approach more than once — switch to the correct API (e.g., use `listTables("dfs://path")` instead of `db.listTables()`).
- **Batch independent operations.** If you need to check multiple things, combine them into a single DolphinDB script when possible.
- **Prioritize the critical path.** Focus on schema confirmation → import → verification. Skip optional verification steps if react rounds are limited.

### Stop Conditions

- Source file does not exist or cannot be accessed.
- File format cannot be identified and user has not specified.
- Binary file schema cannot be determined and user has not provided.
- Database or table already exists and cannot be overwritten.
- Distributed table creation plan has not been confirmed by user.
- Storage engine is unclear and multiple reasonable choices exist.
- Date/time format cannot be inferred and affects data correctness.
- User's confirmation contradicts the previous plan.

### Storage Engine Selection

| Engine | Best For | Key Feature |
|--------|----------|-------------|
| OLAP | Bulk analysis, full-table scan | Append-only, highest write throughput |
| TSDB | Time-series point queries | sortColumns index, deduplication (keepDuplicates) |
| PKEY | Primary-key uniqueness, near-real-time updates | primaryKey constraint, bloom filter index |
| IOTDB | IoT massive point management | IOTANY variable-type column, latestKeyCache (ms-level latest-value query), static table mapping |

### IOTDB Engine Quick Reference (IoT Scenarios)

IOTDB is a storage engine based on TSDB, specifically designed for massive IoT
point data management (available since DolphinDB 3.00.2).

Key concepts (Point, IOTANY, latestKeyCache, Static table) → `reference/iotdb_engine.md`

**IOTDB creation rules** (strict):
- Database engine must be `IOTDB`: `database(..., engine='IOTDB')`
- When creating a point management table, the database must use COMPO partition with time partition as the LAST dimension (required by IOTDB engine; single-layer partition will cause point table creation to fail)
- sortColumns must include all point-identifying columns (ID + tags) + time column as the LAST sort column
- If table contains IOTANY column, `latestKeyCache=true` is mandatory
- When `latestKeyCache=true`, sortColumns must have at least 2 columns
- Only point-management tables are allowed in an IOTDB database (no dimension tables)
- Deduplication: ALL (default) or LAST; FIRST is NOT supported
- IOTANY column type is fixed per point after first write; use `update` with firstSortKey-only WHERE to change

For complete creation examples, see `reference/iotdb_engine.md`
and `templates/iotdb_creation.md`.

**IOTDB Complete Creation Template** (MUST follow this exact pattern):

```sql
// IOTDB engine: MUST use COMPO partition with time as LAST dimension
// Step 1: Create sub-databases for COMPO partition
hashPart = database("", HASH, [INT, 20])  // or [SYMBOL, 10] etc.
timePart = database("", VALUE, 2024.01.01..2024.12.31)

// Step 2: Create database with IOTDB engine
db = database("dfs://iot_db", COMPO, [hashPart, timePart], engine="IOTDB")

// Step 3: Create table with IOTANY column using SQL statement
// NOTE: IOTANY type can ONLY be specified in SQL CREATE statement, NOT in table() function
// NOTE: SQL create table statement is executed directly in DolphinDB script (NOT via db.run())
create table `dfs://iot_db`.`sensors` (
    deviceId INT,
    location SYMBOL,
    timestamp TIMESTAMP,
    value IOTANY
)
partitioned by deviceId, timestamp
sortColumns=`deviceId`location`timestamp
latestKeyCache=true
```

Key IOTDB rules:
- IOTDB engine MUST use COMPO partition with time column as the LAST partition dimension
- IOTANY type can ONLY be created via SQL `create table` statement, NOT via `table()` function or `createPartitionedTable`
- `latestKeyCache=true` is recommended for latest value queries
- sortColumns should include: id columns + tag columns + time column (time as LAST)
- COMPO partition sub-databases must be created separately using `database("", ...)` first

**Latest-value query optimization**:
- `latestKeyCache=true` → uses cache table (fastest, ms-level)
- Storage engine optimization → uses index zonemap filtering
- Check with `select [HINT_EXPLAIN] ... context by ... limit -1`

### Common Import Patterns

```sql
// CSV/TXT → memory table (with schema correction)
schema = extractTextSchema("/data/trades.csv")    // ▶ 替换为你的文件路径
update schema set type = `SYMBOL where name = "ticker"
t = loadText("/data/trades.csv", schema=schema)

// CSV/TXT → distributed table (recommended)
db = database("dfs://stock", VALUE, 2024.01.01..2024.12.31)    // ▶ 替换为你的数据库路径和分区
loadTextEx(db, "trades", `date, "/data/trades.csv", sortColumns=`sym`date)

// CSV/TXT with transform (preprocess before writing)
loadTextEx(db, "trades", `date, "/data/trades.csv",
           transform = nullFill!{, 0.0}, sortColumns=`sym`date)

// Large file chunked import
ds = textChunkDS("/data/huge.csv", 500)    // ▶ 替换为你的文件路径
mr(ds, append!{pt}, ,, false)

// Long timestamp conversion
t = loadText("/data/ticks.csv")    // ▶ 替换为你的文件路径
replaceColumn!(t, `ts, timestamp(exec ts from t))

// Tab-separated TXT file
t = loadText("/data/demo.txt", delimiter=char(9))    // ▶ 替换为你的文件路径
```

All text import functions support both `.csv` and `.txt`. Default delimiter: comma. Tab-separated TXT: `delimiter=char(9)`. DolphinDB does not support `	` as an escape sequence; use `char(9)` to represent the Tab character.

For date/time cleaning, array vectors, null filling → `reference/functions/data_cleaning.md`.
For IOTDB creation → `reference/iotdb_engine.md` and `templates/iotdb_creation.md`.
For MQTT/OPC UA → `reference/iot_ingestion.md` and `templates/mqtt_ingestion.md`.

### IoT Data Ingestion Architecture

```
Devices/Sensors → MQTT/OPC UA → DolphinDB Plugin → Stream Table → Stream Engine → Distributed Table
```

For details → `reference/iot_ingestion.md` and `templates/mqtt_ingestion.md`.

### Bundled Files

| Path | Purpose |
|------|---------|
| `reference/functions/*.md` | Import function references (loadText, loadTextEx, textChunkDS, extractTextSchema, JSON, binary, data_cleaning, HDF5, Parquet) |
| `reference/confirmation_templates.md` | Confirmation output templates |
| `reference/import_plugins.md` | Database and file format plugins |
| `reference/iotdb_engine.md` | IOTDB engine detailed guide |
| `reference/iot_ingestion.md` | IoT real-time data ingestion |
| `reference/iot_data_model.md` | IoT data modeling |
| `reference/partition_design.md` | Partition strategy design |
| `reference/engine_selection.md` | Storage engine comparison |
| `reference/pitfalls.md` | Common import pitfalls |
| `reference/long_timestamp.md` | Long timestamp handling |
| `templates/*.md` | Step-by-step templates (CSV import, database creation, IOTDB creation, MQTT ingestion, batch import) |
| `examples/*.dos` | DolphinDB script examples — read and adapt the content, replace placeholder variables with actual values |
| `checklists/import_review.md` | Import result verification checklist |

**How to use bundled files**: Read the relevant reference or template file within this skill package, then adapt the DolphinDB scripts to your actual scenario. For `.dos` examples, read the example content and replace placeholder variables (file paths, database names, table names) with your actual values before executing as DolphinDB scripts.
