# Import Result Verification Checklist

After importing data, verify the following:

## Schema Verification

- [ ] Column names match expected names
- [ ] Column types match expected types (check with `schema(table).colDefs`)
- [ ] No unexpected NULL values in non-nullable columns
- [ ] Date/time columns have correct format and range

## Data Integrity

- [ ] Row count matches source (check with `select count(*) from table`)
- [ ] Sample rows match source data (check with `select top 10 * from table`)
- [ ] No data truncation in string columns
- [ ] Numeric values are within expected range
- [ ] SYMBOL columns have expected distinct values

## Engine-Aware Import Verification — APPEND MODE ONLY (⚠️ CRITICAL)

The engine-aware verification mechanism (Strategy A / Strategy B) described below applies **ONLY in append import mode** (when the prompt explicitly mentions "append"/"追加" and data is appended to an existing table that already contains rows).

**In non-append import mode (DEFAULT — new table OR truncate-then-import)**: Use the simple verification:
- [ ] Verify `exec count(*) from loadTable(dbPath, tableName) == expectedImportCount` (since the table was newly created or cleared with `truncate`, the final row count should exactly equal the source data row count for ALL storage engines — OLAP, TSDB, PKEY, IOTDB).
- [ ] Check `select top 10 * from loadTable(dbPath, tableName)` for data correctness.

No beforeCount/afterCount tracking or key-existence check is needed in non-append mode.

---

**Append mode engine-aware verification** (ONLY when prompt explicitly mentions "append"/"追加"):

**Step 1 — Determine the verification strategy**:
- **Strategy A (row count difference equality)** — valid for: OLAP engine, or TSDB engine with `keepDuplicates=ALL` (default).
- **Strategy B (key existence check)** — required for: PKEY engine, or TSDB engine with `keepDuplicates=LAST` or `keepDuplicates=FIRST`.

**Step 2 — Strategy A checklist (non-overwrite engines in append mode)**:
- [ ] Record `beforeCount = exec count(*) from loadTable(dbPath, tableName)` BEFORE append import.
- [ ] Record `afterCount = exec count(*) from loadTable(dbPath, tableName)` AFTER append import.
- [ ] Verify `afterCount - beforeCount == expectedImportCount` (exact equality).

**Step 3 — Strategy B checklist (overwrite/deduplication engines in append mode)** — three sub-checks (all must hold):
- [ ] **B1 (lower bound)**: Verify `afterCount >= beforeCount` (rows must not decrease after append import).
- [ ] **B2 (upper bound)**: Verify `afterCount - beforeCount <= expectedImportCount` (appended rows must not exceed source row count).
- [ ] **B3 (key existence)**: Extract unique key combinations from source data (`select distinct keyCols from sourceData`), extract the same key combinations from the target table (`select distinct keyCols from loadTable(dbPath, tableName)`), use `ej(uniqueKeys, targetKeys, `keyCols)` to find matched keys, and verify `count(matchedKeys) == count(uniqueKeys)` (every source key MUST exist in the target table).

**Determining key columns (Strategy B only)**:
- For **PKEY engine**: use the columns declared in the `primaryKey` parameter of `createPartitionedTable`.
- For **TSDB engine with keepDuplicates=LAST/FIRST**: use the columns declared in the `sortColumns` parameter. If `sortColumns` contains only ONE column that coincides with the partition column, include the partition column to form a composite key.

**⚠️ NEVER rely on `tableInsert`/`append!`/`loadTextEx` return values for verification in append mode**:
- For PKEY engines and key-value tables, `tableInsert` return value only counts NEW rows inserted (NOT rows updated due to key conflicts).
- `append!` and `loadTextEx` do not return inserted count at all.
- Always use SQL `select count(*)` and key-existence checks instead.

## Performance Verification

- [ ] Partition pruning works (check with `explain` or query timing)
- [ ] Partition sizes are within 100MB-1GB range
- [ ] No excessively small or large partitions

## Common Issues

- LONG timestamps not converted → use `timestamp()` function
- Timezone offset → use `localtime()` or `convertTZ()`
- SYMBOL auto-cast to INT → specify schema explicitly
- NULL values in numeric columns → use `nullFill!` or `transform`
- Partition conflict → use serial import

## IOTDB-Specific Verification

- [ ] Database engine is IOTDB (check with `schema(table).engineType`)
- [ ] Partition is COMPO with time as last dimension
- [ ] sortColumns includes all point-identifying columns + time (last)
- [ ] IOTANY column type is correct per point (check with `getLocalIOTDBStaticTable`)
- [ ] latestKeyCache is enabled (check with `schema(table).latestKeyCache`)
- [ ] Latest-value query uses optimization (check with `HINT_EXPLAIN`)
- [ ] IOTANY type consistency: same point always writes same type
- [ ] MQTT/OPC UA subscription is active and data is flowing
