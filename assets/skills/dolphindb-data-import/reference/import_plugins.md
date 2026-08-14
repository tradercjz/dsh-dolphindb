# Import Plugins

DolphinDB provides plugins for importing data from external databases and
file formats. All plugins must be loaded with `loadPlugin()` before use.

## Plugin Management (Install → Load → Verify → Use)

```sql
// Step 1: Check if plugin exists in repository
listRemotePlugins("mysql")

// Step 2: Install plugin
installPlugin("mysql")

// Step 3: Load plugin (safe loading recommended)
try { loadPlugin("mysql") } catch(ex) {
    if (strpos(string(ex[1]), "already in use") == -1) {
        installPlugin("mysql"); loadPlugin("mysql")
    }
}

// Step 4: Verify plugin is loaded
getLoadedPlugins()
defs("mysql::%")

// Step 5: Use plugin with namespace prefix
conn = mysql::connect("host", port, "username", "password", "database")    // ▶ 替换为实际的连接参数
// Or import namespace: use mysql
```

### Safe Plugin Loading Function

```sql
def safeLoadPlugin(pluginName) {
    try {
        loadPlugin(pluginName)
    } catch(ex) {
        if (strpos(string(ex[1]), "already in use") == -1) {
            installPlugin(pluginName)
            loadPlugin(pluginName)
        }
    }
}

safeLoadPlugin("mysql")
safeLoadPlugin("hdf5")
```

### Auto-Preload Plugins (Production)

Add to node configuration file:
```
preloadModules=plugins::mqtt,plugins::mysql
```

## Database Plugins

| Plugin | Description | Key Functions |
|--------|-------------|---------------|
| mysql | Connect and read from MySQL | `mysql::connect`, `mysql::load`, `mysql::loadEx`, `mysql::extractSchema` |
| odbc | Connect via ODBC to most databases | `odbc::connect`, `odbc::query`, `odbc::execute` |
| HBase | Connect via Thrift to HBase | HBase read operations |
| kdb | Connect to kdb+ or read kdb+ files | kdb+ data import |
| mongodb | Connect to MongoDB | MongoDB read operations |

## File Format Plugins

| Plugin | Description | Key Functions |
|--------|-------------|---------------|
| parquet | Read/write Apache Parquet files | `parquet::loadParquet`, `parquet::loadParquetEx`, `parquet::extractParquetSchema`, `parquet::parquetDS` |
| hdf5 | Read/write HDF5 files | `hdf5::loadHDF5`, `hdf5::loadHDF5Ex`, `hdf5::extractHDF5Schema`, `hdf5::ls`, `hdf5::lsTable`, `hdf5::HDF5DS` |
| hdfs | Read/write Hadoop HDFS files | HDFS file access |
| aws | Read/write AWS S3 files | S3 file access |
| feather | Read/write Apache Feather files | Feather import/export |
| orc | Read/write ORC files | ORC import/export |
| zip | Decompress ZIP files | ZIP extraction |
| zlib | Compress/decompress gz files | gz handling |

## MySQL Plugin Example

```sql
// Safe plugin loading
try { loadPlugin("mysql") } catch(ex) {
    if (strpos(string(ex[1]), "already in use") == -1) {
        installPlugin("mysql"); loadPlugin("mysql")
    }
}
conn = mysql::connect("host", port, "username", "password", "employees")    // ▶ 替换为实际的连接参数
schema = mysql::extractSchema(conn, "employees")
db = database("dfs://mysql", VALUE, `F`M)
pt = mysql::loadEx(conn, db, "pt", "gender", "employees")
mysql::close(conn)
```

## ODBC Plugin Example

```sql
try { loadPlugin("odbc") } catch(ex) {
    if (strpos(string(ex[1]), "already in use") == -1) {
        installPlugin("odbc"); loadPlugin("odbc")
    }
}
conn = odbc::connect("Driver={PostgreSQL};Server=host;Database=mydb;Uid=username;Pwd=password;")    // ▶ 替换为实际的连接字符串
tb = odbc::query(conn, "select * from my_table")
odbc::close(conn)
```

## HDF5 Plugin

For HDF5 file import, see `reference/functions/hdf5_import.md` for the
complete step-by-step guide with schema preview, memory/distributed import,
and complex type handling.

## Parquet Plugin

For Parquet file import, see `reference/functions/parquet_import.md` for the
complete step-by-step guide with schema preview, memory/distributed import,
and row group-based parallel import.

## Plugin Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Plugin not found" | Not installed | `installPlugin("name")` first |
| "already in use" | Loaded in another session | Safe to ignore; available cluster-wide |
| "Cannot open file" | Wrong path | Use `installPlugin()` for correct path |
| "No privilege" | Insufficient permissions | Login as admin |
| "Unsupported OS" | Platform incompatible | Check plugin compatibility |

## DataX Import Tool

DolphinDB provides a DataX dolphindbwriter plugin for batch data
synchronization from heterogeneous sources (MySQL, Oracle, SqlServer,
Postgre, HDFS, Hive, etc.). Supports full import and incremental update.
