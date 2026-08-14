# Partition Design for Data Import

## Partition Types

| Type | Symbol | Scheme | Best For |
|------|--------|--------|----------|
| Range | RANGE | Boundary vector | Numeric ranges, date ranges |
| Hash | HASH | [Type, count] | Even distribution, unknown cardinality |
| Value | VALUE | Value vector | Known discrete values (dates, categories) |
| List | LIST | Value list | Custom grouping |
| Composite | COMPO | [db1, db2, ...] | Multi-dimensional (2-3 levels) |

## Design Principles

1. **Choose frequently filtered columns** as partition columns.
2. **FLOAT and DOUBLE cannot be partition columns**. Convert STRING to SYMBOL first.
3. **Partition size**: 100 MB to 1 GB (uncompressed) per partition.
4. **Formula**: max partition size ≤ S / (8 × W), where S = available memory, W = worker threads.
5. **Reserve future partitions** for time-based partitioning (e.g., extend date range).
6. **Use `cutPoints`** for even range partitioning on skewed data.
7. **Co-location**: tables in the same database share partition layout for efficient joins.

## Common Patterns

```sql
// Time-series: VALUE by date
db = database("dfs://daily", VALUE, 2024.01.01..2025.12.31)

// Time-series: VALUE by month
db = database("dfs://monthly", VALUE, 2024.01M..2025.12M)

// Composite: date + symbol
dbDate = database("", VALUE, 2024.01.01..2024.12.31)
dbSym = database("", HASH, [SYMBOL, 10])
db = database("dfs://stock", COMPO, [dbDate, dbSym])

// Even range partitioning
tmp = select count(*) as cnt from sample group by sym order by sym
buckets = cutPoints(tmp.sym, 128, tmp.cnt)
db = database("dfs://even", RANGE, buckets)
```

## Atomic Parameter

| Value | Behavior |
|-------|----------|
| TRANS (default) | Transaction-level atomicity. No concurrent writes to same partition. |
| CHUNK | Partition-level atomicity. Allows concurrent writes but may have partial failures. |

For serial import, use `atomic='TRANS'`. For concurrent import to different
partitions, also use `atomic='TRANS'`. Only use `atomic='CHUNK'` when you
must write to the same partition concurrently.
