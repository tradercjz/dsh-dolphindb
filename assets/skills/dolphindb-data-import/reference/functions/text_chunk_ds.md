# textChunkDS

Splits a large text file into multiple data sources for distributed import
via the `mr` function. Uses less memory than loading the entire file.

### Syntax

```sql
textChunkDS(filename, chunkSize, [delimiter], [schema], [skipRows=0], [arrayDelimiter], [containHeader], [arrayMarker])
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| filename | STRING | File path. Supports CSV and TXT text files. |
| chunkSize | INT | Chunk size in MB (1-2048). |
| Other params | - | Same as loadText. |

### Returns

A tuple of DATASOURCE objects.

### Usage Pattern with mr

```sql
// Step 1: Create database and partitioned table
db = database("dfs://bigdata", VALUE, `IBM`MSFT`GM`C`FB`GOOG)
pt = db.createPartitionedTable(schema, `pt, `sym)

// Step 2: Split file into chunks
ds = textChunkDS("/data/huge_trades.txt", 500)

// Step 3: Import via mr (parallel MUST be false to avoid partition conflict)
mr(ds, append!{pt}, ,, false)
```

### Critical Note

Each chunk may contain data for the same partition. DolphinDB does NOT
allow concurrent writes to the same partition. Therefore, the `parallel`
parameter of `mr` MUST be set to `false`.

### When to Use

- File size exceeds available memory.
- `loadTextEx` causes OOM errors.
- Need fine-grained control over import batching.
