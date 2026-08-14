# 10 Most Overlooked Data Import Details

Based on official DolphinDB documentation.

## 1. Column Names Starting with Numbers

Without `containHeader=true`, columns starting with digits get renamed to
col0, col1, etc. **Solution**: set `containHeader=true` to prefix with "c".

## 2. Auto-Detected Types May Be Wrong

`loadText` uses random sampling. **Solution**: always use `extractTextSchema`
first, correct types, then import with `schema` parameter.

## 3. Date-Like Strings Auto-Parsed as DATE

Strings like "111011" (yyMMdd format) may be parsed as DATE instead of
SYMBOL. **Solution**: specify type in schema explicitly.

## 4. Use loadTextEx Instead of loadText + append!

`loadTextEx` is ~2x faster and avoids OOM for large files. Direct-to-disk
import is always preferred for database writes.

## 5. Use transform Parameter for Preprocessing

Instead of loading to memory, preprocessing, then writing, use
`loadTextEx` with `transform` parameter for one-step import.

## 6. Long Integer Timestamps Cannot Be Imported as TIMESTAMP

Specifying LONG timestamps as TIMESTAMP type in schema produces NULL values.
**Solution**: import as LONG, then convert with `timestamp()` function.

## 7. Timezone Handling for Long Timestamps

`timestamp()` converts from UTC (zero timezone). Use `localtime()` or
`convertTZ()` to convert to local timezone.

## 8. ODBC Connection String Format

Use standard connection string format (e.g., `Driver={PostgreSQL};...`)
instead of DSN format to avoid authentication failures.

## 9. Disk I/O Contention During Decompress + Import

Do not decompress files on the same disk as the DolphinDB data directory
while importing. This can halve import speed.

## 10. Partition Conflict During Parallel Import

With `atomic='TRANS'`, parallel writes to the same partition fail.
**Solution**: import serially, or use `atomic='CHUNK'` (with caveats).

## 11. transform Function Mutable Parameter (⚠️ CRITICAL)

When using `transform` parameter with `loadTextEx`/`loadParquetEx`/`loadHDF5Ex`:
- Using `update t set col = ...` syntax: NO `mutable` keyword needed
- Using `replaceColumn!(t, ...)` or `nullFill!(t, ...)`: parameter MUST be declared as `mutable t`
- WRONG: `def convert(t) { replaceColumn!(t, `col, ...) }` — will fail with "Constant variable [t] can't be used as argument for mutable function replaceColumn!"
- Correct: `def convert(mutable t) { replaceColumn!(t, `col, ...) }`

## 12. transform Requires Pre-created Table

When using `transform` parameter, the partitioned table MUST be created BEFORE calling the import function using `db.createPartitionedTable()`. Without `transform`, `loadTextEx` auto-creates the table; WITH `transform`, it does NOT.

## 13. DB/Table Existence 4-Branch Handling

Before creating a distributed table, MUST handle all 4 combinations:
- DB doesn't exist + Table doesn't exist → create new DB and table
- DB exists + Table doesn't exist → reuse DB, create new table
- DB exists + Table exists → reuse existing table
- DB doesn't exist + Table exists → impossible (skip)

Without this logic, repeated runs will fail with "transform requires pre-created table" or "database already exists" errors.

## 14. TSDB Engine Requires sortColumns

When using `engine="TSDB"`, `sortColumns` is MANDATORY. If not needed, use `engine="OLAP"`. **OLAP engine does NOT support array vector types** (DOUBLE[], INT[]) — for array vectors, MUST use TSDB with `sortColumns`.

## 15. sortColumns Format

`sortColumns` accepts column name vector, NOT comma-separated string.
- Correct: `sortColumns=`date`sym`` (backtick vector)
- WRONG: `sortColumns="date,sym"` (interpreted as single column name "date,sym")
- WRONG: `sortColumns=["date","sym"]` (string array, should use backticks)

## 16. loadHDF5Ex/loadParquetEx Partition Column Type Cannot Be Transformed

These functions use the source file's schema to create the partitioned table, so the partition column type is FIXED to the source type. The `transform` function only transforms data AFTER it's loaded. If source has INT `date` but database requires DATE partition, MUST use `loadHDF5`/`loadParquet` + `replaceColumn!` + `createPartitionedTable` (with correct type) + `pt.append!`.

## 17. IOTDB Create Table Syntax

IOTANY column can ONLY be created via SQL `create table` statement (executed directly in DolphinDB script), NOT via `table()` function or `createPartitionedTable`. Identifiers MUST use backticks (\`), NOT double quotes ("). `partitioned by` is followed by comma-separated column names (NOT backtick vector). `sortColumns` uses backtick vector. Do NOT use `db.run()` — `run()` is for executing script files, not SQL strings.

## 18. HDF5 Plugin API Pitfalls

- `hdf5::ls` returns [objName, objType] columns; `hdf5::lsTable` returns [tableName] column — DO NOT mix
- `getLoadedPlugins()` returns TABLE with column `plugin` (not `name` or `pluginName`)
- `datasetName` parameter must be STRING SCALAR, not vector — use `[0]` to take first element

## 19. DolphinDB Has NO .limit() Method

Tables in DolphinDB do NOT have a `.limit()` method. Use `select top N * from tableName` or `tableName[:N]` instead.

## 20. DolphinDB Reserved Words

DO NOT use these as variable names: `name`, `type`, `tuple`, `dict`, `table`, `select`, `exec`, `from`, `where`, `by`, `update`, `insert`, `delete`. Use `colName` instead of `name`, `dataTuple` instead of `tuple`.

## 21. extractTextSchema Returns Metadata Table

`extractTextSchema` returns a metadata table (describing schema), NOT an empty table for `createPartitionedTable`. Convert it first: `schemaTable = table(1:0, schema.name, schema.type)`.

## 22. Non-interactive Mode and dropDatabase/dropTable Prohibition

The DolphinX testing platform PROHIBITS `dropDatabase` and `dropTable` operations. When the user's prompt provides ALL necessary information, SKIP all `ask_user` confirmation steps and execute directly. Always use `existsDatabase` + `existsTable` conditional creation logic, or use a unique database path to avoid conflicts.
