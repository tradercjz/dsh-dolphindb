# Long Integer Timestamp Handling

## The Problem

Many datasets use LONG (millisecond Unix timestamp) to represent time.
DolphinDB cannot directly import LONG values as TIMESTAMP — it produces NULL.

## Wrong Approach

```sql
// This produces NULL values in the timestamp column!
schema = extractTextSchema("/data/ticks.csv")
update schema set type = "TIMESTAMP" where name = "timestamp"
t = loadText("/data/ticks.csv", schema=schema)
```

## Correct Approach

```sql
// Step 1: Import as LONG
t = loadText("/data/ticks.csv")

// Step 2: Convert to TIMESTAMP
replaceColumn!(t, `timestamp, timestamp(exec timestamp from t))
```

## Timezone Conversion

If the LONG timestamp represents UTC time but you need local time:

```sql
// Option 1: localtime() — convert UTC to local timezone
replaceColumn!(t, `timestamp, localtime(timestamp(exec timestamp from t)))

// Option 2: convertTZ() — convert between specific timezones
replaceColumn!(t, `timestamp, convertTZ(timestamp(exec timestamp from t), "UTC", "Asia/Shanghai"))
```

## For loadTextEx

When using `loadTextEx`, import as LONG first, then convert after loading
the table from the database:

```sql
// Import with LONG type
loadTextEx(db, "ticks", `date, "/data/ticks.csv")

// Convert after loading
t = loadTable("dfs://db", "ticks")
// Use SQL to create a view or update
```
