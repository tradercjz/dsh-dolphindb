# extractTextSchema

Generates the table structure (column names + data types) that DolphinDB
would auto-detect for a given text file. Use this BEFORE importing to
verify and correct type detection.

### Syntax

```sql
extractTextSchema(filename, [delimiter], [skipRows=0])
```

### Returns

A table with two columns:
- **name**: column name (STRING)
- **type**: data type (STRING)

**⚠️ CRITICAL**: `extractTextSchema` returns a METADATA table (describing the schema), NOT an empty table that can be used directly as a schema table for `createPartitionedTable`. To use it with `createPartitionedTable`, convert it to an empty table first:

```sql
schema = extractTextSchema("/data/trades.csv")
// Convert metadata table to empty table for createPartitionedTable
schemaTable = table(1:0, schema.name, schema.type)
// Now schemaTable can be used with createPartitionedTable
pt = db.createPartitionedTable(schemaTable, "trades", `date)
```

NEVER pass `extractTextSchema` result directly to `createPartitionedTable` — it will cause errors.

### Usage Pattern

```sql
// Step 1: Preview auto-detected schema
schema = extractTextSchema("/data/trades.csv")

// Step 2: Correct any misdetected types
update schema set type = `SYMBOL where name = "ticker"
update schema set type = "DATETIME" where name = "time"
schema[`format] = ["yyyyMMddHHmmss",,,]

// Step 3: Import with corrected schema
t = loadText("/data/trades.csv", schema=schema)
```

### Auto-Detection Rules

- Date-like strings with separators (-, /, .) are parsed as DATE type.
- Time-like strings with colon (:) are parsed as time types.
- "yyMMdd" patterns satisfying date range conditions are parsed as DATE.
- "yyyyMMdd" patterns satisfying date range conditions are parsed as DATE.
- Random sampling is used — results may not always be accurate.
- Only supports CSV/TXT text format files.
