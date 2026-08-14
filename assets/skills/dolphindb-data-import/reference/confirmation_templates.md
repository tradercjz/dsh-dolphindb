# Confirmation Output Templates

## Distributed Table Creation Confirmation

Before creating a distributed table, chat output MUST include:

- **Data source**: file path, format, row count, column count
- **Schema mapping**: original column name/type → target column name/type, correction notes
- **Storage engine**: selected engine and reason
- **Partition scheme**: partition type, partition columns, partition granularity
- **Create SQL**: complete DolphinDB CREATE DATABASE/TABLE script
- **Risks and warnings**: partition conflict, data skew, type conversion risks
- **Confirmation question**: `Please confirm whether to create the distributed table with the above plan and import data. If adjustments are needed, please specify.`

## Binary File Schema Confirmation

Before binary file import, chat output MUST include:

- **File info**: path, size, inferred record count
- **Inference basis**: user-provided creation script / file size calculation / other
- **Schema**: column names, data types, byte offsets
- **Preview data**: first 5 rows (if readable)
- **Risks and warnings**: schema mismatch may cause garbled data or data loss
- **Confirmation question**: `Please confirm the above schema is correct. If adjustments are needed, please specify which columns to modify.`

## Storage Engine Selection Confirmation

When storage engine is not specified, present options:

1. **OLAP** — Bulk analysis, full-table scan (default, recommended for general use)
2. **TSDB** — Time-series point queries, sort key indexing, deduplication
3. **PKEY** — Primary key uniqueness, near-real-time updates
4. **IOTDB** — IoT massive point management, variable-type values, millisecond-level latest-value queries

Selection criteria:
- Financial k-line, trade records, log analysis → OLAP
- High-frequency sensor data, snapshot dedup → TSDB
- CDC sync, user profiles, config management → PKEY
- IoT sensors, device monitoring, SCADA → IOTDB

## Partition Scheme Confirmation

When partition scheme has multiple options, present specific choices based on
the data's actual columns and the selected engine. Always include a recommended
default and explain the trade-off.

**For general time-series data (OLAP/TSDB)**:
1. **VALUE(time_column)** — Simple, good for time-range queries (default for single-dimension)
2. **HASH(category_column, N)** — Even distribution, good for unknown cardinality
3. **COMPO(VALUE(time_column) + HASH(category_column, N))** — Best for both time-range and category queries (default for TSDB)

**For IOTDB engine (mandatory COMPO with time as LAST dimension)**:
1. **COMPO(HASH(deviceId, N) + VALUE(timestamp))** — By device hash + time (default, recommended)
2. **COMPO(RANGE(deviceId) + VALUE(timestamp))** — By device range + time

Ask format: "请选择分区方案：" with options like:
- "VALUE({time_col}) — 按时间值分区（推荐）"
- "HASH({category_col}, 10) — 按{category}哈希分区"
- "COMPO(VALUE({time_col}) + HASH({category_col}, 10)) — 时间+{category}组合分区"

Default: engine-appropriate default. User can specify custom scheme.

## Date/Time Format Confirmation

When date/time format cannot be inferred from data sample, present options:

1. **yyyyMMdd** — Integer date like `20240101` (common in Chinese financial data)
2. **yyyy-MM-dd** — ISO date like `2024-01-01`
3. **Unix timestamp (seconds)** — Like `1701199585`
4. **Unix timestamp (milliseconds)** — Like `1701199585108`
5. **HHmmssSSS** — Integer time like `104000000` (common in market data)
6. **Already correct type** — No conversion needed

Default: infer from data sample. If sample contains 8-digit integers starting with 20, suggest yyyyMMdd.

## Null Handling Confirmation

When null values exist and handling strategy may affect business semantics:

1. **Keep as NULL** — No modification (default, safest)
2. **Fill with specific value** — `nullFill!{, value}`
3. **Forward fill** — `ffill` (carry last known value forward)
4. **Backward fill** — `bfill` (use next known value)
5. **Linear interpolation** — `interpolate` (numeric columns only)

Default: keep as NULL. Only ask when null ratio > 10% or user explicitly asks about null handling.

## Column Type Ambiguity Confirmation

When extractTextSchema returns columns whose type may be ambiguous:

**STRING columns that may be array vectors** (containing delimited numeric values like "1.0,2.0,3.0"):
1. **STRING** — Keep as-is (default if uncertain)
2. **DOUBLE[]** — Array vector of doubles
3. **INT[]** — Array vector of integers
Ask: "Detected {column} as STRING with delimited numeric values. Is this an array vector column?"
If array vector: set `arrayDelimiter` parameter accordingly.

**LONG/INT columns that may be dates or timestamps**:
1. **LONG/INT** — Keep as-is (default if uncertain)
2. **DATE** — yyyyMMdd format (8-digit integers starting with 19 or 20)
3. **TIMESTAMP** — Millisecond Unix timestamp (13-digit integers)
4. **NANOTIMESTAMP** — Nanosecond Unix timestamp (19-digit integers)
Ask: "Detected {column} as {type} with values resembling {pattern}. Should this be converted?"
If conversion needed: import as LONG/INT first, then use `replaceColumn!` to convert (do NOT change type in schema directly for timestamps).

## Import Method Confirmation

When multiple import methods are viable for the same file, present options:

**For text files:**
1. **loadText** — Memory table, single-thread (default for small files < 16 MB)
2. **ploadText** — Memory table, parallel (recommended for files > 16 MB)
3. **loadTextEx** — Distributed table, direct-to-disk (recommended for production)
4. **textChunkDS + mr** — Chunked import for very large files (> memory)

**For binary files:**
1. **loadRecord** — Supports string columns, one-step import (use when file has string/symbol columns)
2. **readRecord!** — No string support, incremental reading (preferred for pure numeric files)

Ask: "请选择导入方式：" with options based on file characteristics.

## Data Preprocessing Confirmation

When preprocessing options are available, confirm with user:

**Column selection:**
- "是否只导入部分列？如需指定，请提供列名或列索引。"

**Row skipping:**
- "是否跳过文件开头的行？请指定跳过行数（0-1024）。"

**Null handling:**
- See Null Handling Confirmation above.

**Date/time format:**
- See Date/Time Format Confirmation above.

## Final Form Confirmation

Before executing the import, confirm the final storage form:

**Memory table:**
- Table name: default to filename-based name or user-specified.
- No partition scheme needed.

**Distributed table (partitioned):**
- Database path, table name, storage engine, partition scheme.
- See Distributed Table Creation Confirmation above.

**Distributed table (dimension table):**
- Database path, table name.
- No partition scheme needed (dimension tables are not partitioned).

Ask: "数据将存储为：1. 内存表 2. 分布式分区表 3. 分布式维度表" with default based on data size and use case.
