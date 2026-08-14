# MQTT Real-Time Ingestion Setup Template

## Step 1: Create Stream Table

```sql
// With persistence for production reliability
t = streamTable(1:0, `tag`ts`value, [SYMBOL, TIMESTAMP, FLOAT])
enableTableShareAndPersistence(table=t, tableName=`iotStream,
    cacheSize=1000000, preCache=0)
```

## Step 2: Load MQTT Plugin

```sql
try { loadPlugin("mqtt") } catch(ex) { if (strpos(string(ex[1]), "already in use") == -1) { installPlugin("mqtt"); loadPlugin("mqtt") } }
```

## Step 3: Create Parser and Subscribe

```sql
// JSON format (recommended)
sp = mqtt::createJsonParser([SYMBOL, TIMESTAMP, FLOAT], `tag`ts`value)
conn = mqtt::subscribe("broker_host", 1883, "sensor/#", sp, iotStream)    // ▶ 替换为实际的 MQTT broker 地址

// Or CSV format
p = mqtt::createCsvParser([SYMBOL, TIMESTAMP, FLOAT], ',', ';')
conn = mqtt::subscribe("broker_host", 1883, "sensor/#", p, iotStream)    // ▶ 替换为实际的 MQTT broker 地址
```

## Step 4: (Optional) Subscribe to Distributed Table

```sql
pt = loadTable("dfs://iot_db", "sensors")
subscribeTable(tableName="iotStream", actionName="toDB",
    handler=append!{pt}, msgAsTable=true)
```

## Step 5: (Optional) Add Stream Computation Engine

```sql
// Example: 10-second downsampling
tsEngine = createTimeSeriesEngine(
    name="downsample",
    windowSize=10, step=10,
    metrics=<[last(value), max(value), min(value)]>,
    dummyTable=iotStream,
    outputTable=resultStream,
    timeColumn=`ts,
    keyColumn=`tag
)
subscribeTable(tableName="iotStream", actionName="downsample",
    handler=append!{tsEngine}, msgAsTable=true)
```

## Step 6: Verify

```sql
select top 10 * from iotStream
select count(*) from iotStream
```

## Cleanup

```sql
mqtt::unsubscribe(conn)
unsubscribeTable(tableName="iotStream", actionName="toDB")
```
