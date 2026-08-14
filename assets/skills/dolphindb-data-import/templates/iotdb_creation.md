# IOTDB Database and Point Table Creation Template

## Prerequisites

- DolphinDB version >= 3.00.2
- IOTDB engine enabled

## Step 1: Create IOTDB Database

When creating a point management table, the database must use COMPO partition with time partition as the LAST dimension (required by IOTDB engine; single-layer partition will cause point table creation to fail).

```sql
// HASH(deviceId) + VALUE(date) composite partition
hashPart = database("", HASH, [INT, 20])
timePart = database("", VALUE, 2024.01.01..2025.12.31)
db = database("dfs://iot_db", COMPO, [hashPart, timePart], engine="IOTDB")
```

## Step 2: Create Point-Management Table

```sql
// With IOTANY column and latestKeyCache
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

## Step 3: Verify

```sql
// Check schema
schema(loadTable("dfs://iot_db", "sensors"))

// Check static table
getLocalIOTDBStaticTable("dfs://iot_db", "sensors")
```

## Important Rules

- sortColumns: all point-identifying columns (ID + tags) + time column (last)
- IOTANY column: mandatory latestKeyCache=true
- latestKeyCache=true requires sortColumns with at least 2 columns
- Only ALL and LAST deduplication supported
- No dimension tables in IOTDB database
