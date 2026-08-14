# IoT Data Modeling

## Single-Value Model (Point-Centric)

Each point is one row; all metric values stored in the same column.
Suitable when different points have different sampling frequencies.

```sql
// Table: id (point ID), datetime (time), value (metric value)
tableSchema = table(1:0, `id`datetime`value, [INT, DATETIME, FLOAT])
db1 = database("", VALUE, dateRange)
db2 = database("", RANGE, idRange)
db = database(dbName, COMPO, [db1, db2])
dfsTable = db.createPartitionedTable(tableSchema, tableName, `datetime`id)
```

With IOTDB engine and IOTANY column, see `templates/iotdb_creation.md`
for the complete creation template with all mandatory rules.

## Multi-Value Model (Device-Centric)

Each device's all metrics at the same timestamp form one row.
Suitable when different metrics need coordinated processing.

```sql
// Table: id (device ID), datetime (time), tag1~tag50 (50 metrics)
m = "tag" + string(1..50)
schema = table(1:0, `id`datetime join m, [INT, DATETIME] join take(FLOAT, 50))
db1 = database("", VALUE, dateRange)
db2 = database("", RANGE, idRange)
db = database(dbName, COMPO, [db1, db2])
db.createPartitionedTable(schema, tableName, `datetime`id)
```

## Model Selection Guide

| Aspect | Single-Value | Multi-Value |
|--------|-------------|-------------|
| Schema flexibility | High (different types per point) | Low (fixed columns) |
| IOTANY support | Yes | Not needed |
| Sampling frequency | Different per point | Same for all metrics |
| Cross-metric queries | Requires pivot | Direct column access |
| Storage efficiency | Better for sparse data | Better for dense data |
| Best with IOTDB | Yes (IOTANY + latestKeyCache) | Use TSDB instead |
