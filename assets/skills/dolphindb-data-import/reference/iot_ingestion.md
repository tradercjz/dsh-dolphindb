# IoT Real-Time Data Ingestion

DolphinDB provides end-to-end solutions for IoT real-time data ingestion.

## Architecture

```
Devices/Sensors → MQTT/OPC UA Server → DolphinDB Plugin → Stream Table → Stream Engine → Distributed Table
```

## MQTT Plugin

Subscribe to MQTT broker topics and write data to DolphinDB stream tables.

### Installation

```sql
// Safe loading (recommended)
try { loadPlugin("mqtt") } catch(ex) { if (strpos(string(ex[1]), "already in use") == -1) { installPlugin("mqtt"); loadPlugin("mqtt") } }

// Or: Preload (production recommended)
// Add to node config: preloadModules=plugins::mqtt
```

### Subscribe with JSON Parser

```sql
// Create stream table
share streamTable(1:0, `tag`ts`value, [SYMBOL, TIMESTAMP, FLOAT]) as iotStream

// Create JSON parser and subscribe
sp = mqtt::createJsonParser([SYMBOL, TIMESTAMP, FLOAT], `tag`ts`value)
conn = mqtt::subscribe("broker_host", 1883, "sensor/#", sp, iotStream)    // ▶ 替换为实际的 MQTT broker 地址
```

### Subscribe with CSV Parser

```sql
p = mqtt::createCsvParser([INT, TIMESTAMP, FLOAT], ',', ';')
conn = mqtt::subscribe("broker_host", 1883, "sensor/#", p, iotStream)    // ▶ 替换为实际的 MQTT broker 地址
```

### Unsubscribe

```sql
mqtt::unsubscribe(conn)
```

## OPC UA Plugin

Subscribe to OPC UA server nodes and write data to DolphinDB stream tables.

```sql
try { loadPlugin("opcua") } catch(ex) {
    if (strpos(string(ex[1]), "already in use") == -1) {
        installPlugin("opcua"); loadPlugin("opcua")
    }
}
conn = opcua::connect(EndpointUrl, "myclient")
opcua::subscribe(conn, 3, ["Counter","Expression","Random","Sawtooth"], iotStream)
```

## Stream Table Setup

Stream tables are in-memory tables for real-time data buffering.

```sql
// Basic stream table
share streamTable(1:0, `id`datetime`value, [INT, DATETIME, FLOAT]) as iotStream

// With persistence (recommended for production)
t = streamTable(1:0, `id`datetime`value, [INT, DATETIME, FLOAT])
enableTableShareAndPersistence(table=t, tableName=`iotStream,
    cacheSize=1000000, preCache=0)
```

## Stream Engine Integration

After data arrives in stream tables, use `subscribeTable` to feed data
into stream computation engines:

- **TimeSeriesEngine**: Downsampling (e.g., 10-second aggregates)
- **AnomalyDetectionEngine**: Threshold alerting (e.g., temperature > 40°C)
- **ReactiveStateEngine**: State change tracking (e.g., value != prev(value))
- **CrossSectionalEngine**: Cross-device aggregation (e.g., avg across devices)
- **SessionWindowEngine**: Data loss detection (e.g., 5-minute gap alert)

### Example: Anomaly Detection

```sql
engine1 = createAnomalyDetectionEngine(
    name="engine1",
    metrics=<[sum(temperature > 40) > 2]>,
    dummyTable=sensor,
    outputTable=warningTable,
    timeColumn=`ts,
    keyColumn=`deviceID,
    windowSize=180,
    step=180
)
subscribeTable(tableName="sensor", actionName="anomaly",
    handler=append!{engine1}, msgAsTable=true)
```

### Example: State Change Detection

```sql
reactivEngine = createReactiveStateEngine(
    name=`reactivEngine,
    metrics=<[ts, value]>,
    dummyTable=stream01,
    outputTable=outputSt,
    keyColumn="tag",
    filter=<value!=prev(value) && prev(value)!=NULL>
)
subscribeTable(tableName="inputSt", actionName="monitor",
    handler=append!{reactivEngine}, msgAsTable=true)
```

## Writing Stream Data to Distributed Table

```sql
// Subscribe stream table and write to IOTDB distributed table
pt = loadTable("dfs://iot_db", "sensors")
subscribeTable(tableName="iotStream", actionName="toDB",
    handler=append!{pt}, msgAsTable=true)
```
