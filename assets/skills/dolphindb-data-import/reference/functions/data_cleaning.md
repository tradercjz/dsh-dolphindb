# Data Cleaning: Date/Time Conversion, Null Filling, and Array Vector Import

## Date/Time Type Cleaning with replaceColumn!

`replaceColumn!` replaces a column in a table, changing both values and data type.
Unlike SQL `update`, it can modify column data types.

### Syntax

```sql
replaceColumn!(table, colName, newCol)
```

- For memory tables: replaces column values and type.
- For OLAP distributed tables: only modifies column data type (with type conversion rules).
- Supports replacing multiple columns: `replaceColumn!(t, colNameVector, newColTuple)`.
- **Note**: Does NOT support DECIMAL type columns. keyedTable does not allow replaceColumn! on key columns.

### Common Date/Time Conversion Patterns

**CRITICAL WARNING**: `date(INT_value)` does NOT convert yyyyMMdd format integers to DATE!
`date()` interprets integers as days since 1970.01.01 (e.g., `date(20240101)` returns
a date ~59,000 years in the future). To convert INT yyyyMMdd → DATE, you MUST use
`temporalParse(string(INT_value), "yyyyMMdd")`.

```sql
// LONG timestamp → TIMESTAMP
replaceColumn!(t, `ts, timestamp(exec ts from t))

// INT date (yyyyMMdd) → DATE  ⚠️ MUST use temporalParse, NOT date()!
replaceColumn!(t, `date, temporalParse(string(exec date from t), "yyyyMMdd"))

// STRING datetime → TIMESTAMP with format
replaceColumn!(t, `datetime, temporalParse(exec datetime from t, "yyyy-MM-dd HH:mm:ss"))

// INT time (HHmmssSSS) → TIME with format
// ⚠️ MUST use lpad to ensure correct digit count!
// Example: INT 93000000 (8 digits) needs 9 digits for HHmmssSSS
replaceColumn!(t, `time, temporalParse(lpad(string(exec time from t), 9, "0"), "HHmmssSSS"))

// Merge separate date + time columns → TIMESTAMP
replaceColumn!(t, `timestamp, concatDateTime(exec date from t, exec time from t))

// UTC → local timezone
replaceColumn!(t, `ts, localtime(exec ts from t))
replaceColumn!(t, `ts, convertTZ(exec ts from t, "UTC", "Asia/Shanghai"))
```

### Using replaceColumn! in loadTextEx transform

```sql
// ⚠️ When transform uses replaceColumn! (mutable function), the parameter
// MUST be declared as `mutable t`
def convertTimestamp(mutable t) {
    replaceColumn!(t, `ts, timestamp(exec ts from t))
    replaceColumn!(t, `date, temporalParse(string(exec date from t), "yyyyMMdd"))
    return t
}
// ⚠️ When using transform, the partitioned table MUST be pre-created via
// createPartitionedTable BEFORE calling loadTextEx
loadTextEx(db, "trades", `date, "/data/ticks.csv",
           transform=convertTimestamp, sortColumns=`sym`date)
```

## Null Value Filling

| Function | Direction | In-place | Supports | Description |
|----------|-----------|----------|----------|-------------|
| `nullFill(X, Y)` | Fill with Y | No | Scalar/vector/matrix/table | Fill NULLs with specific value or matching vector |
| `nullFill!(X, Y)` | Fill with Y | Yes | Vector/table | In-place version of nullFill |
| `ffill(obj, [limit])` | Forward | No | Vector/array vector/matrix/table | Fill with previous non-NULL value |
| `ffill!(obj, [limit])` | Forward | Yes | Vector/table | In-place forward fill |
| `bfill(obj, [limit])` | Backward | No | Vector/table | Fill with next non-NULL value |
| `bfill!(obj, [limit])` | Backward | Yes | Vector/table | In-place backward fill |
| `lfill!(obj)` | Linear | Yes | Vector/table | Linear fill between non-NULL endpoints (leaves leading/trailing NULLs) |
| `interpolate(X, [method], [limit], ...)` | Configurable | Optional | Numeric vector | Interpolation: linear/pad/nearest/krogh. **Vector function, not aggregate** — cannot be used in `context by`. For grouped interpolation in SQL, use `group by ... interval()` instead. |

### Examples

```sql
// nullFill: fill with specific value
nullFill(t, 0.0)              // new table, all NULLs → 0.0
nullFill!(t, -999999)         // in-place, all NULLs → -999999
update t set price = price.nullFill(avg(price)) context by sym  // group mean fill

// ffill: forward fill (previous non-NULL)
select date, sym, price.ffill() as price from t context by sym
x.ffill(2)   // fill at most 2 consecutive NULLs

// bfill: backward fill (next non-NULL)
update t set vol = bfill(vol) context by sym

// lfill!: linear fill between non-NULL endpoints
t.price.lfill!()   // [NULL,1.5,2.5,3.5,4.5] from [NULL,1.5,NULL,NULL,4.5]

// interpolate: flexible interpolation
interpolate(price, method='linear')                    // linear interpolation
interpolate(price, method='pad')                       // same as ffill
interpolate(price, method='nearest')                   // nearest valid value
interpolate(price, limit=2, limitDirection='both')     // max 2 consecutive, bidirectional
interpolate(price, method='linear', index=dateVector)  // custom index for interpolation

// loadTextEx transform with nullFill
loadTextEx(db, "sales", `date, "/data/sales.csv",
           transform = nullFill!{, 0.0}, sortColumns=`sym`date)
```

## Array Vector Import

Array vectors store variable-length arrays in a single column (e.g., bid/ask price levels).

### Import Steps

1. Use `extractTextSchema` to preview schema
2. Modify type to array type (e.g., `DOUBLE[]`, `INT[]`)
3. Set `arrayDelimiter` for internal separator (default: comma)
4. Optionally set `arrayMarker` for boundary markers (default: double quote)

```sql
// Step 1: Preview
schema = extractTextSchema("/data/quotes.csv")

// Step 2: Set array type
update schema set type = "DOUBLE[]" where name in `bid`ask

// Step 3: Import with arrayDelimiter
t = loadText("/data/quotes.csv", schema=schema, arrayDelimiter=",")

// Step 4: With custom boundary markers (e.g., square brackets)
t = loadText("/data/quotes.csv", schema=schema, arrayDelimiter=",", arrayMarker="[]")

// loadTextEx also supports arrayDelimiter and arrayMarker
loadTextEx(db, "quotes", `date, "/data/quotes.csv",
           schema=schema, arrayDelimiter=",", sortColumns=`sym`date)
```
