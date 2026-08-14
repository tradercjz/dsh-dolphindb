# IOTDB Engine — IoT Point Management

Available since DolphinDB 3.00.2. Based on TSDB engine, specifically designed
for massive IoT point data management.

## Core Concepts

**Point (点位)**: A specific data collection point on a physical object being
monitored or managed. Points can be sensors, actuators, controllers, etc.
Data objects include static attributes (ID, name) and dynamic attributes
(temperature, pressure, humidity, status).

**Point data characteristics**:
- Massive quantity: millions to billions of points in power grid, connected vehicles, manufacturing
- High sampling frequency: up to 100KHz in extreme scenarios
- Complex data types: BOOL, INT, FLOAT, DOUBLE, SYMBOL, STRING, etc.
- Diverse transmission: same device points may be collected together or individually

## IOTANY Column

A variable-type column that stores different types of attribute values in a
single column of a single-value model. Max 1 IOTANY column per table.

Supported types in IOTANY:

| Category | Types |
|----------|-------|
| Integral | CHAR, SHORT, INT, LONG |
| Logical | BOOL |
| Floating | FLOAT, DOUBLE |
| Literal | SYMBOL, STRING |

DolphinDB stores IOTANY column data by separating different types at the
TSDB Level File level.

**Write rules**:
- First write to a point determines its IOTANY type
- Subsequent writes with a different type for the same point will cause an error
- Use `update` statement with firstSortKey-only WHERE clause to change a point's IOTANY type
- `upsert!` does NOT support IOTANY vector input

## latestKeyCache (Latest-Value Cache)

Enables real-time latest-value caching for millisecond-level queries.
Creates a per-partition cache table that is updated in real-time on writes.

**Enable**: set `latestKeyCache=true` in `create table` or `createPartitionedTable`.

**Mandatory when**: table contains an IOTANY column.

**Cache behavior**:
- Updated in real-time with each write
- Flushed together with Cache Engine
- Persisted in `timeseries.cache` file under each partition's tableDir
- Warmup on restart: automatically loads cache for the most recent time partition
- Size controlled by `IOTDBLatestKeyCacheSize` config (default: 5% of maxMemSize)

**Latest-value query optimization levels**:

| Optimization | Condition |
|-------------|-----------|
| LatestKeyCache (fastest) | No WHERE; or WHERE only on firstSortKey; or WHERE on lastSortKey only |
| LatestKeyQuery | WHERE includes all firstSortKey columns + optionally time column |
| None | Other WHERE conditions |

Check optimization used:
```sql
select [HINT_EXPLAIN] * from pt
where deviceId in [200, 201]
context by deviceId, location csort timestamp limit -1
```

## Static Table

Maps sortColumns (except the last time column) to internal IDs for storage
efficiency. Similar to SymbolBase, operates per partition.

- Enable with `compressHashSortKey=true` (default for IOTDB engine)
- View with `getLocalIOTDBStaticTable(dbUrl, tableName)`
- Cache size controlled by `IOTDBStaticTableCacheSize` config (default: 5% of maxMemSize)
- Clear cache with `clearAllIOTDBStaticTableCache()`

## IOTDB Creation Rules (Strict)

1. Database engine must be `IOTDB`
2. When creating a point management table, the database must use COMPO partition with time partition as the LAST dimension (required by IOTDB engine; single-layer partition will cause point table creation to fail)
3. sortColumns must include all point-identifying columns + time column (last)
4. If table has IOTANY column, `latestKeyCache=true` is mandatory
5. When `latestKeyCache=true`, sortColumns must have at least 2 columns
6. Only point-management tables in IOTDB database (no dimension tables)
7. Deduplication: ALL (default) or LAST; FIRST NOT supported
8. sortColumns must not contain DECIMAL type

## IOTDB Complete Creation Template (MUST follow this exact pattern)

```sql
// IOTDB engine: MUST use COMPO partition with time as LAST dimension
// Step 1: Create sub-databases for COMPO partition
hashPart = database("", HASH, [INT, 20])  // or [SYMBOL, 10] etc.
timePart = database("", VALUE, 2024.01.01..2024.12.31)

// Step 2: Create database with IOTDB engine
db = database("dfs://iot_db", COMPO, [hashPart, timePart], engine="IOTDB")

// Step 3: Create table with IOTANY column using SQL statement
// NOTE: IOTANY type can ONLY be specified in SQL CREATE statement, NOT in table() function
// NOTE: SQL create table statement is executed directly in DolphinDB script (NOT via db.run())
// NOTE: Identifiers MUST use backticks (`), NOT double quotes (")
// NOTE: `partitioned by` is followed by comma-separated column names (NOT backtick vector)
// NOTE: `sortColumns` uses backtick vector
create table `dfs://iot_db`.`sensors` (
    deviceId INT,
    location SYMBOL,
    timestamp TIMESTAMP,
    value IOTANY
)
partitioned by deviceId, timestamp
sortColumns=`deviceId`location`timestamp
latestKeyCache=true
```

Key IOTDB rules:
- IOTDB engine MUST use COMPO partition with time column as the LAST partition dimension
- IOTANY type can ONLY be created via SQL `create table` statement (executed directly in DolphinDB script), NOT via `table()` function or `createPartitionedTable`
- Identifiers MUST use backticks (\`), NOT double quotes (")
- `partitioned by` is followed by comma-separated column names (NOT backtick vector)
- `sortColumns` uses backtick vector
- `latestKeyCache=true` is recommended for latest value queries
- sortColumns should include: id columns + tag columns + time column (time as LAST)
- COMPO partition sub-databases must be created separately using `database("", ...)` first

## Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| IOTDBLatestKeyCacheSize | Max latest-value cache size (GB) | 5% of maxMemSize |
| IOTDBStaticTableDir | Static table directory path | Home/IOTDBStaticTable |
| IOTDBStaticTableCacheSize | Max static table cache size (GB) | 5% of maxMemSize |

## Cache Management Functions

```sql
// Clear all latest-value caches
clearAllIOTDBLatestKeyCache()

// Clear all static table caches
clearAllIOTDBStaticTableCache()

// View static table info
getLocalIOTDBStaticTable("dfs://iot_db", "sensors")
```
