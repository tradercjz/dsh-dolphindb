# loadText and ploadText

## loadText

Loads a text file into a DolphinDB in-memory table using a single thread.

### Syntax

```sql
loadText(filename, [delimiter], [schema], [skipRows=0], [arrayDelimiter], [containHeader], [arrayMarker])
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| filename | STRING | File path. Supports CSV and TXT text files. Default delimiter is comma. |
| delimiter | STRING/CHAR | Column separator. Default: comma (","). For tab-separated TXT: `delimiter=char(9)`. DolphinDB does not support `	` as an escape sequence; use `char(9)` for Tab. Can be one or more characters. |
| schema | TABLE | Specifies column data types. Must contain `name` and `type` columns. Optional `format` and `col` columns. |
| skipRows | INT | Skip first N rows (0-1024). Default: 0. |
| arrayDelimiter | STRING | Separator for array vector columns. Default: comma. |
| containHeader | BOOL | Whether file contains header row. Default: auto-detect. |
| arrayMarker | STRING/CHAR pair | Array vector boundary markers. Default: double quote ("). |

### schema Table Structure

| Column | Required | Description |
|--------|----------|-------------|
| name | Yes | Column name |
| type | Yes | Data type string (e.g., "SYMBOL", "DOUBLE") |
| format | No | Date/time format string (e.g., "yyyyMMddHHmmss") |
| col | No | Column index to load (for partial column loading). Values must be in ascending order. Only columns with specified indices are loaded. |

### Important Behaviors

- Auto-detects column types via random sampling — may be inaccurate.
- Always use `extractTextSchema` to preview detected types first.
- Date-like strings (e.g., "23.04.10") are auto-parsed as DATE type.
- Column names starting with digits: use `containHeader=true` to prefix with "c".
- File must be UTF-8 encoded.
- Does NOT support BLOB, COMPLEX, POINT, DURATION types.

### Examples

```sql
// Basic import
t = loadText("/data/stock.csv")

// With schema correction
schema = extractTextSchema("/data/stock.csv")
update schema set type = `SYMBOL where name = "ticker"
t = loadText("/data/stock.csv", schema=schema)

// With custom date format
schema = extractTextSchema("/data/trades.csv")
update schema set type = "DATETIME" where name = "time"
schema[`format] = ["yyyyMMddHHmmss",,,]
t = loadText("/data/trades.csv", schema=schema)

// Load only selected columns (via schema col column)
// Step 1: Preview full schema
schema = extractTextSchema("/data/stock.csv")
// Step 2: Select desired columns and assign their original indices
schema = select * from schema where name in `sym`date`close`volume
schema[`col] = [0,2,5,8]  // must be ascending, these are the original column positions
// Step 3: Import with partial column schema
t = loadText("/data/stock.csv", schema=schema)

// Skip first N rows (e.g., skip header comments)
t = loadText("/data/stock.csv", skipRows=3, schema=schema)

// Combine: skip rows + partial columns
t = loadText("/data/stock.csv", skipRows=2, schema=schema)

// Load array vector columns
schema = extractTextSchema("/data/quotes.csv")
update schema set type = "DOUBLE[]" where name in `bid`ask
t = loadText("/data/quotes.csv", schema=schema, arrayDelimiter=",")
```

## ploadText

Parallel version of loadText. Returns a segmented in-memory table for files > 16 MB.

### Syntax

Same parameters as `loadText`.

### Key Differences from loadText

- Uses multiple CPU cores for parallel loading.
- Returns segmented in-memory table for files > 16 MB.
- Data is evenly distributed across segments (8-16 MB each).
- Significantly faster for large files.

```sql
// Compare performance
timer t1 = loadText("/data/large.csv")    // slower
timer t2 = ploadText("/data/large.csv")   // faster

// Tab-separated TXT file
t = ploadText("/data/demo_trades.txt", delimiter=char(9))
```
