# Binary File Import

DolphinDB provides two functions for importing row-based binary files with fixed-length records.

## CRITICAL: Schema Must Match Actual File Structure

**The schema parameter for `loadRecord` MUST exactly match the actual binary file's column structure.**
Using an incorrect schema will cause binary data to be misinterpreted, producing garbled output
with control characters that break downstream processing.

**Before using loadRecord, you MUST determine the file's actual structure:**
1. Ask the user about the column names, data types, and byte layout of the binary file.
2. If the user provides the DolphinDB script that created the file (e.g., `writeRecord`), derive the schema from that script's table definition.
3. For files with only numeric columns (no strings), prefer `readRecord!` which does not require a schema tuple — only column names and types in a pre-created table.
4. **NEVER blindly copy the example schema below** — it is for a specific sample file and will NOT work for other binary files.

## Can DolphinDB Auto-Detect Binary File Structure?

**No.** DolphinDB does not provide any function to inspect or auto-detect the internal structure of binary files. This is a fundamental limitation:

- Binary files are raw byte sequences with no embedded metadata about column names, types, or boundaries.
- The same file size can correspond to many different column type combinations (e.g., 8 bytes could be 1 LONG, 2 INTs, or 1 DOUBLE).
- Even if the total record count is known (e.g., from file size / record size), the number of columns and their types remain ambiguous.
- String columns have variable-length encodings that make size-based inference even more unreliable.

**Therefore, you MUST obtain the schema from the user before using `loadRecord` or `readRecord!`.** The schema can come from:

1. The `writeRecord` script that created the file (most reliable — derive schema from the source table).
2. Direct user input of column names, data types, and string column lengths.
3. Partial user input + ask_user to fill in the gaps.

If the user cannot provide any schema information, the import cannot proceed safely.

## How to Derive Schema from writeRecord

If the binary file was created with `writeRecord`, the schema is determined by the source table's columns.
**When the user provides the writeRecord script, derive schema directly and proceed to import. Do NOT attempt to verify file size or record count — this wastes react rounds and is unnecessary when schema is already known.**

For example, if the file was created with:
```sql
t = table(take([20240101, 20240102], n) as date,
          take([104000000, 100000000], n) as time,
          take([50, 60], n) as last_price,
          take([1, 2], n) as volume)
f.writeRecord(t)
```
Then the correct loadRecord schema is:
```sql
schema = [("date", INT), ("time", INT), ("last_price", INT), ("volume", INT)]
```
Or use readRecord! with a matching table:
```sql
t = table(100:0, `date`time`last_price`volume, [INT, INT, INT, INT])
f.readRecord!(t)
```

## loadRecord

Loads a row-based binary file into memory. **Supports string type data**.

### Syntax

```sql
loadRecord(filename, schema, [skipBytes=0], [count])
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| filename | STRING | File path. |
| schema | TUPLE | Each element is a tuple of (columnName, dataType, [stringLength]). String columns must specify fixed length. **Must match actual file structure exactly.** |
| skipBytes | INT | Bytes to skip from file header. Default: 0. |
| count | INT | Number of records to load. Default: all records. |

### Returns

A table.

### Example

```sql
// Schema: (columnName, dataType) for non-string; (columnName, dataType, stringLength) for string
// NOTE: This schema is for a SPECIFIC sample file — do NOT copy it for other files!
schema = [("code", SYMBOL, 32), ("date", INT), ("time", INT),
          ("last", FLOAT), ("volume", INT), ("value", FLOAT)]
t = loadRecord("/data/sample.bin", schema)    // ▶ 替换为实际的文件路径
select code, date, time, last, volume from t
```

## readRecord!

Converts binary file to DolphinDB data objects. **Does NOT support string type data**.
**Preferred for pure numeric binary files** — simpler and safer than loadRecord when no string columns exist.

### Syntax

```sql
readRecord!(handle, holder, [offset=0], [length])
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| handle | FILE | File handle opened with `file()`. |
| holder | TABLE/TUPLE | Pre-created variable to store data (table or tuple of vectors). |
| offset | INT | Starting position in holder for data storage. Default: 0. |
| length | INT | Number of rows to read. Default: read to end. |

### Returns

Number of rows read (INT).

### Example

```sql
// Read into a pre-created table
f = file("/data/a.bin")    // ▶ 替换为实际的文件路径
t = table(1000:0, `PERMNO`PRC`VOL`SHROUT, [INT, DOUBLE, INT, DOUBLE])
f.readRecord!(t)

// Read into a tuple of vectors (first 500 rows)
f = file("/data/a.bin")    // ▶ 替换为实际的文件路径
t = loop(array, [INT, DOUBLE, INT, DOUBLE], 0, 500)
f.readRecord!(t, 0, 500)
```

## Key Differences: loadRecord vs readRecord!

| Aspect | loadRecord | readRecord! |
|--------|-----------|-------------|
| String support | **Yes** (specify length in schema) | **No** |
| Input | File path string | File handle (use `file()` first) |
| Data container | Auto-creates and returns table | Requires pre-created holder |
| Return value | Table | Number of rows read |
| Schema required | Yes (TUPLE with column definitions) | Yes (in pre-created table/tuple) |
| Use case | One-step import with string data | Incremental reading into existing table |
| Recommended when | File has string columns | File has only numeric columns |

## writeRecord

Converts DolphinDB objects (table or tuple) to binary file.

```sql
writeRecord(handle, object, [offset], [length])
```

## Post-Import Type Conversion

After binary import, date/time columns are often stored as INT. Use `replaceColumn!` to convert:

```sql
t = loadRecord("/data/market.bin", schema)
// Convert INT date (yyyyMMdd) to DATE
t.replaceColumn!(`date, temporalParse(string(t.date), "yyyyMMdd"))
// Convert INT time (HHmmssSSS) to TIME
t.replaceColumn!(`time, temporalParse(lpad(string(t.time), 9, "0"), "HHmmssSSS"))
// Convert INT market code to meaningful symbol
t.replaceColumn!(`symbol, t.symbol.format("000000"))
// Convert INT market flag to category
t.replaceColumn!(`market, iif(t.market==0, "SH", "SZ"))
```

## Common Errors

1. Schema mismatch: using an incorrect schema causes binary data to be misinterpreted, producing garbled output with control characters. ALWAYS derive schema from the actual file structure.
2. String length in schema: string columns MUST specify fixed byte length; omitting it causes decode errors.
3. readRecord! does not support string columns; use loadRecord for files with string data.
4. File not found: ensure the file path is accessible from the DolphinDB server, not just the client.
5. Byte order: DolphinDB uses little-endian; ensure the binary file was written on a little-endian system or adjust accordingly.
6. **Wasting react rounds on file size verification**: When the user provides the writeRecord script, the schema is already known. Do NOT attempt to verify file size or record count. If file size is truly needed, use `file(path).seek(0, TAIL)` — NOT `getFileSize()`, `fileSize()`, or `file(path).size()` (these functions do not exist in DolphinDB).

## Related Documentation

- Import plan template: [csv_import_plan.md](csv_import_plan.md)
- Database creation template: [database_creation.md](database_creation.md)
- Engine selection guide: [engine_selection.md](../engine_selection.md)
- Confirmation templates: [confirmation_templates.md](confirmation_templates.md)
