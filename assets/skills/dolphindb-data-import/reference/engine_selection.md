# Storage Engine Selection

## Engine Comparison

| Feature | OLAP | TSDB | PKEY | IOTDB |
|---------|------|------|------|-------|
| Write performance | Highest (append) | Medium (sort required) | Medium (LSM-Tree) | Medium (based on TSDB) |
| Query pattern | Full scan / aggregation | Point query by sortKey | Point query by primaryKey | Latest-value query (ms-level), point query |
| Deduplication | No | Yes (ALL/LAST/FIRST) | Yes (primaryKey uniqueness) | Yes (ALL/LAST only; FIRST NOT supported) |
| Data update | Partition rewrite | LAST mode append | Merge-on-Write | LAST mode append; update with firstSortKey WHERE |
| Variable-type column | No | No | No | Yes (IOTANY) |
| Latest-value cache | No | No | No | Yes (latestKeyCache) |
| Static table mapping | No | No | No | Yes (compressHashSortKey) |
| sortColumns | Not supported | Required (≤4 columns) | Not applicable | Required; last must be time column |
| primaryKey | Not supported | Not supported | Required (must include partition columns) | Not applicable |
| Indexes | Not supported | Not supported | Bloom filter, text index | Not applicable |
| Partition requirement | None | None | None | Must be COMPO with time partition as LAST dimension (required for point tables) |
| Recommended partition size | 100MB–1GB | 400MB–1GB | 400MB–1GB | 400MB–1GB |

## Selection Guide

- **OLAP**: Choose for bulk analytics, batch scanning, append-only workloads.
- **TSDB**: Choose for time-series data with point query needs. Set `sortColumns` and `keepDuplicates`.
- **PKEY**: Choose for primary-key uniqueness, near-real-time CDC updates, and Ad Hoc queries.
- **IOTDB**: Choose for IoT scenarios with massive point management, variable-type values, and millisecond-level latest-value queries. Requires DolphinDB 3.00.2+.

## Creation Examples

```sql
// OLAP engine (default)
db = database("dfs://olap_db", VALUE, 2024.01M..2024.12M)

// TSDB engine
db = database("dfs://tsdb_db", VALUE, 2024.01M..2024.12M, engine="TSDB")
pt = db.createPartitionedTable(schema, "ticks", `date,
    sortColumns=`sym`timestamp, keepDuplicates=LAST)

// PKEY engine
db = database("dfs://pkey_db", HASH, [INT, 8], engine="PKEY")
pt = db.createPartitionedTable(schema, "records", `id,
    primaryKey=["id"], indexes={"content":"textIndex(parser=mixed,full=true)"})

// IOTDB engine (IoT point management)
// Must use COMPO partition with time as LAST dimension (required for point tables)
// See `templates/iotdb_creation.md` for complete creation template
```

## IOTDB Engine Restrictions

- Only point-management tables allowed in IOTDB database (no dimension tables)
- IOTANY column: max 1 per table; type fixed per point after first write
- sortColumns must not contain DECIMAL type
- Does NOT support: softDelete, level 4 compaction, vector database
- Does NOT support upsert! with ignoreNull=true or IOTANY vector input
- FIRST deduplication NOT supported (only ALL and LAST)
- latestKeyCache snapshot read NOT supported

## Common Errors

1. IOTDB point table must use COMPO partition with time as LAST dimension; single-layer partition causes creation failure.
2. PKEY table must specify primaryKey containing all partition columns; omitting causes creation failure.
3. TSDB sortColumns cannot exceed 4 columns; the last column must be a time-type column.
4. IOTDB database only allows point management tables; dimension tables are not supported.
5. IOTDB does not support FIRST deduplication; only ALL (default) and LAST are allowed.

## Related Documentation

- IOTDB engine details: [iotdb_engine.md](iotdb_engine.md)
- Database creation template: [database_creation.md](../templates/database_creation.md)
- IOTDB creation template: [../templates/iotdb_creation.md](../templates/iotdb_creation.md)
- Confirmation templates: [confirmation_templates.md](confirmation_templates.md)
