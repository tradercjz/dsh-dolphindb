# loadTextEx

Imports a text file directly into a DolphinDB database table. The function
loads data in batches to avoid OOM for large files.

### Syntax

```sql
loadTextEx(dbHandle, tableName, [partitionColumns], filename, [delimiter], [schema], [skipRows=0], [transform], [sortColumns], [arrayDelimiter], [containHeader], [arrayMarker])
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| dbHandle | DB handle | Database handle from `database()` function. |
| tableName | STRING | Target table name. Auto-created if not exists. |
| partitionColumns | STRING/VECTOR | Partition column(s). For COMPO: `date`sym`. For SEQ: empty. |
| filename | STRING | Source file path. Supports CSV and TXT text files. |
| delimiter | STRING/CHAR | Column separator. Default: comma. For tab-separated TXT: `delimiter=char(9)`. DolphinDB does not support `	` as an escape sequence; use `char(9)` for Tab. |
| schema | TABLE | Column type specification (same as loadText). |
| skipRows | INT | Skip first N rows. Default: 0. |
| transform | FUNCTION | Preprocessing function applied before writing. Input: table, output: table. |
| sortColumns | STRING/VECTOR | Sort columns for TSDB engine tables. |
| arrayDelimiter | STRING | Array vector separator. Default: comma. |
| containHeader | BOOL | Whether file has header row. |
| arrayMarker | STRING/CHAR pair | Array vector boundary markers. |

### Key Advantages over loadText + append!

- **Direct to disk**: avoids loading entire file into memory.
- **Batch processing**: loads in batches, can handle files larger than memory.
- **Faster**: approximately 2x faster than loadText + append! for large files.
- **Transform support**: preprocess data in one step.

### Examples

```sql
// Basic: import CSV directly to distributed table
db = database("dfs://stock", VALUE, 2024.01.01..2024.12.31)
loadTextEx(db, "trades", `date, "/data/trades.csv")

// With sortColumns for TSDB engine
db = database("dfs://stock_tsdb", VALUE, 2024.01.01..2024.12.31, engine="TSDB")
loadTextEx(db, "trades", `date, "/data/trades.csv", sortColumns=`sym`date)

// With transform: fill NULL values before writing
loadTextEx(db, "trades", `date, "/data/trades.csv",
           transform = nullFill!{, 0.0}, sortColumns=`sym`date)

// With schema: correct column types
schema = extractTextSchema("/data/trades.csv")
update schema set type = `SYMBOL where name = "ticker"
loadTextEx(db, "trades", `date, "/data/trades.csv", schema=schema)

// Batch import multiple files (serial to avoid partition conflict)
def loadCsv(dbPath, tableName, partCol, fileDir) {
    db = database(dbPath)
    for (fname in exec filename from files(fileDir)) {
        loadTextEx(db, tableName, partCol, fileDir + "/" + fname)
    }
}
submitJob("batchImport", "batch CSV import", loadCsv,
          "dfs://stock", "trades", `date, "/data/daily/")
```

## Critical Rules

1. **transform requires pre-created table**: When using `transform` parameter with `loadTextEx`, the partitioned table MUST be created BEFORE calling `loadTextEx` using `db.createPartitionedTable(schemaTable, tableName, partitionColumns, [sortColumns])`. `loadTextEx` with `transform` does NOT auto-create the table. Without `transform`, `loadTextEx` auto-creates the table.

2. **transform function mutable rules**:
   - Using `update t set col = ...` syntax: NO `mutable` keyword needed (recommended, simpler)
   - Using `replaceColumn!(t, ...)` or `nullFill!(t, ...)`: parameter MUST be declared as `mutable t`
   - Example 1 (update syntax): `def cleanTransform(t) { update t set volume = nullFill(volume, 0); return t }`
   - Example 2 (mutable syntax): `def convertMarketData(mutable t) { replaceColumn!(t, `ts, timestamp(exec ts from t)); return t }`

3. **DB/Table existence 4-branch handling**: When using `loadTextEx` + `transform` (or any import function that requires a pre-created table), MUST handle all 4 combinations of database/table existence:
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
   loadTextEx(db, tableName, partitionColumns, filePath, schema=schema, transform=transformFunc)
   ```

4. **TSDB engine requires sortColumns**: When using `engine="TSDB"`, `sortColumns` parameter is MANDATORY in `createPartitionedTable` and `loadTextEx`. If `sortColumns` is not needed, use `engine="OLAP"` instead.

5. **sortColumns format**: `sortColumns` accepts column name vector, NOT comma-separated string.
   - Single column: `sortColumns=`date`` or `sortColumns="date"` (string scalar)
   - Multiple columns: `sortColumns=`date`sym`` (backtick vector, recommended)
   - WRONG: `sortColumns="date,sym"` (interpreted as single column name "date,sym")

6. **Non-interactive mode**: When the user's initial prompt provides ALL necessary information (file path, target form, database path, table name, engine, partition scheme, schema, type conversions, etc.), SKIP all `ask_user` confirmation steps and execute directly. The DolphinX testing platform PROHIBITS `dropDatabase` and `dropTable` operations — always use `existsDatabase` + `existsTable` conditional creation logic.

## Common Errors

1. Partition conflict: parallel writes to the same partition will fail. Use `atomic='CHUNK'` or serial import.
2. sortColumns is required for TSDB engine; omitting it causes creation failure.
3. Schema type mismatch: LONG timestamps cannot be directly specified as TIMESTAMP in schema; import as LONG first, then convert with `timestamp()`.
4. Database path already exists: use `existsDatabase()` to check before creating.
5. Partition column values must match the partition scheme; out-of-range values cause import failure.

## Related Documentation

- Import plan template: [csv_import_plan.md](csv_import_plan.md)
- Database creation template: [database_creation.md](database_creation.md)
- Engine selection guide: [engine_selection.md](../engine_selection.md)
- Text import functions: [load_text.md](load_text.md)
