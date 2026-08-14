---
name: dolphindb-finance-dbtbcreate
description: 金融数据建库建表 — 自动检测 CSV 结构并在 DolphinDB 中建库建表
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - AskUserQuestion
---

# /dolphindb-finance-dbtbcreate — 金融数据建库建表

适用于：手头有一个 CSV 文件想在 DolphinDB 中建库建表。自动检测 CSV 列结构、修正类型、计算分区方案，通过 .dos 脚本在 DolphinX 平台执行。

> **本 skill 只负责建库建表**，不负责导入数据。数据导入请调用 `/dolphindb-finance-dataimport`。

## 分区方案参考

以下是已知数据集的分区方案（AI 助手在 Step 1 用户选择数据集后从此表读取对应方案）：

| 产品大类 | 数据集 | 存储引擎 | 分区方案 | 分区列 | 排序列 |
|---|---|---|---|---|---|
| 股票 | Level-2 快照（沪深分表） | TSDB | 按天分区 + 按股票代码 HASH25 分区 | 交易日期 + 股票代码 | 股票代码 + 交易时间 |
| 股票 | Level-1 快照（沪深分表） | TSDB | 按天分区 + 按股票代码 HASH25 分区 | 交易日期 + 股票代码 | 股票代码 + 交易时间 |
| 股票 | 逐笔委托（沪深分表） | TSDB | 按天分区 + 按股票代码 HASH25 分区 | 交易日期 + 股票代码 | 股票代码 + 交易时间 |
| 股票 | 逐笔成交（沪深分表） | TSDB | 按天分区 + 按股票代码 HASH25 分区 | 交易日期 + 股票代码 | 股票代码 + 交易时间 |
| 股票 | Level-2 快照（沪深合并） | TSDB | 按天分区 + 按股票代码 HASH50 分区 | 交易日期 + 股票代码 | 交易所类型 + 股票代码 + 交易时间 |
| 股票 | Level-1 快照（沪深合并） | TSDB | 按天分区 + 按股票代码 HASH50 分区 | 交易日期 + 股票代码 | 交易所类型 + 股票代码 + 交易时间 |
| 股票 | 逐笔委托（沪深合并） | TSDB | 按天分区 + 按股票代码 HASH50 分区 | 交易日期 + 股票代码 | 交易所类型 + 股票代码 + 交易时间 |
| 股票 | 逐笔成交（沪深合并） | TSDB | 按天分区 + 按股票代码 HASH50 分区 | 交易日期 + 股票代码 | 交易所类型 + 股票代码 + 交易时间 |
| 股票 | 日 K 线 | OLAP | 按年分区 | 交易时间 | 无 |
| 股票 | 分钟 K 线 | OLAP | 按天分区 | 交易时间 | 无 |
| 期权 | 快照 | TSDB | 按天分区 + 按期权代码 HASH20 分区 | 交易日期 + 期权代码 | 期权代码 + 接收时间 |
| 期货 | 快照 | TSDB | 按天分区 + 按期货代码 HASH10 分区 | 交易日期 + 期货代码 | 期货代码 + 接收时间 |
| 期货 | 日 K 线 | OLAP | 按年分区 | 交易时间 | 无 |
| 期货 | 分钟 K 线 | OLAP | 按天分区 | 交易时间 | 无 |
| 银行间债券 | X-Bond 报价 | TSDB | 按天分区 | 创建日期 | 债券代码 + 创建时间 |
| 银行间债券 | X-Bond 成交 | TSDB | 按天分区 | 创建日期 | 债券代码 + 创建时间 |
| 银行间债券 | ESP 报价 | TSDB | 按天分区 | 创建日期 | 债券代码 + 创建时间 |
| 银行间债券 | ESP 成交 | TSDB | 按天分区 | 创建日期 | 债券代码 + 创建时间 |
| 银行间债券 | QB 报价 | TSDB | 按天分区 | 市场时间 | 债券代码 + 市场时间 |
| 银行间债券 | QB 成交 | TSDB | 按天分区 | 市场时间 | 债券代码 + 市场时间 |

## 已知数据集的典型列结构参考

以下是从经验中提炼的各数据集常见列，辅助 Step 2.3 schema 类型修正判断：

### 快照 (Snapshot)
`TradeDate DATE, TradeTime TIME, SecurityID SYMBOL, PreCloPrice DOUBLE, NumTrades LONG, TotalVolumeTrade LONG, TotalValueTrade DOUBLE, LastPrice DOUBLE, OpenPrice DOUBLE, HighPrice DOUBLE, LowPrice DOUBLE, BidPrice DOUBLE[], OfferPrice DOUBLE[], BidOrderQty LONG[], OfferOrderQty LONG[]`

### 逐笔委托 (Entrust)
`SecurityID SYMBOL, TradeDate DATE, TradeTime TIME, Price DOUBLE, OrderQty LONG, Side SYMBOL, OrderType SYMBOL, ApplSeqNum LONG`

### 逐笔成交 (Trade)
`SecurityID SYMBOL, TradeDate DATE, TradeTime TIME, TradePrice DOUBLE, TradeQty LONG, ExecType SYMBOL, BidApplSeqNum LONG, OfferApplSeqNum LONG`

### K 线
`TradeDate DATE, TradeTime TIME, OpenPrice DOUBLE, HighPrice DOUBLE, LowPrice DOUBLE, ClosePrice DOUBLE, Volume LONG, Amount DOUBLE`

## 执行流程

### Step 1: 收集用户输入

用 `AskUserQuestion` 收集以下参数。注意：纯文本输入的问题**不要设置 options**，用户通过"Other"填写；分区类型用 options 做多选。

**问题 1 — CSV 文件路径**（必填）
- 直接提问："请输入 CSV 文件在 DDB 服务器上的绝对路径"
- 不设 options，用户通过"Other"填写路径

**问题 2 — 数据库名**（可选，可回车跳过）
- 直接提问："请输入数据库名（默认建议：dfs://DB_{表名}，直接回车使用默认值）"
- 不设 options，用户通过"Other"填写或留空

**问题 3 — 表名**（可选，可回车跳过）
- 直接提问："请输入表名（默认建议：TB_{CSV 文件名}，直接回车使用默认值）"
- 不设 options，用户通过"Other"填写或留空

**问题 4a — 数据源大类**（必选）
- 选择题，options 如下：
  - `股票`
  - `期货`
  - `期权`
  - `银行间债券`
  - `未知/都不是（自动计算分区方案）`

**问题 4b — 具体数据集**（必选，根据 4a 从分区方案参考表中过滤对应选项）
- 如果 4a = `股票`，options：
  - `Level-2 快照（沪深分表）` / `Level-1 快照（沪深分表）` / `逐笔委托（沪深分表）` / `逐笔成交（沪深分表）`
  - `Level-2 快照（沪深合并）` / `Level-1 快照（沪深合并）` / `逐笔委托（沪深合并）` / `逐笔成交（沪深合并）`
  - `日 K 线` / `分钟 K 线`
- 如果 4a = `期货`，options：`快照` / `日 K 线` / `分钟 K 线`
- 如果 4a = `期权`，options：`快照`
- 如果 4a = `银行间债券`，options：`X-Bond 报价` / `X-Bond 成交` / `ESP 报价` / `ESP 成交` / `QB 报价` / `QB 成交`
- 如果 4a = `未知/都不是`，跳过 4b，进入 Step 3 Case B

> 注意：沪深分表的 SZ/SH 分区方案相同，不需要单独询问交易所。用户在问题 2（数据库名）和问题 3（表名）中自行指定具体名称（如 `dfs://DB_split_SZ` / `TB_split_SH_entrust`）。

选择完成后，从分区方案参考表中读取该行的存储引擎、分区方案、分区列、排序列，带入后续步骤。

### Step 2: 分析 CSV 结构

#### 2.1 分析 CSV 结构

直接提交以下代码给 DolphinX 平台执行：

```dos
schema = extractTextSchema("{CSV路径}");
print("=== COLUMNS ===");
print(schema);
t = loadText("{CSV路径}");
print("=== PREVIEW ===");
select top 3 * from t;
```

#### 2.2 提取分析结果

读取 `=== COLUMNS ===` 和 `=== PREVIEW ===` 后的输出，解析列名+类型和前 3 行数据样例。

#### 2.3 Schema 类型修正

AI 助手根据列名关键词和数据预览，对 DDB 自动推断的类型做智能修正：

| 自动推断类型 | 列名关键词 | 建议修正 |
|---|---|---|
| INT/LONG | `id`/`code`/`证券`/`SecurityID`/`ApplSeqNum` | → **SYMBOL** |
| INT（形如 20230201） | `date`/`日`/`trade_date` | → **DATE** |
| INT（形如 093000） | `time`/`time` | → **TIME** |
| STRING（形如 2023.02.01） | `date`/`日` | → **DATE** |
| DOUBLE（全为 NULL） | 任意 | 提示用户确认 |

#### 2.4 向用户展示确认

用 `AskUserQuestion` 向用户展示修正后的 schema：

```
解析后的 schema 如下（含自动修正建议）：
  trade_date  →  DATE（原推断 INT，建议修正）
  SecurityID  →  SYMBOL（原推断 INT，建议修正）
  last_price  →  DOUBLE ✓
  trade_qty   →  LONG ✓
  trade_time  →  TIME（原推断 INT，建议修正）

请确认以上 schema 是否正确，或逐列说明需要修改的地方。
```

用户确认后进入下一步。

#### 2.5 确认分区日期列

用 `AskUserQuestion` 向用户确认用于分区的日期列（不设 options，用户通过"Other"填写）：

```
从确认后的 schema 中检测到以下时间相关列：
  {列名1}  {类型}
  {列名2}  {类型}

请回答以下问题（一行一个）：
1. 哪一列是日期分区列？例如 trade_date
2. 该列的日期格式是什么？例如 INT 类型 20230201，或 DATE 类型 2023.02.01
3. 数据覆盖的日期范围是什么？例如 2023.02.01..2023.02.28（如果未知可留空）
```

用户的回答将用于 Step 3 的 VALUE 分区子句和 Step 4 的建表 DDL。

### Step 3: 确定分区方案

#### Case A — 已知分区类型

从**分区方案参考表**中已选数据集所在行读取存储引擎、分区方案、分区列、排序列，按以下规则生成 DDL：

**映射规则 1 — 存储引擎：**
CSV 中的存储引擎值直接传递：`engine='{存储引擎}'`

**映射规则 2 — 分区方案 → partition_clause：**

| 分区方案 | 生成的 partition_clause |
|---|---|
| `按天分区` | `VALUE({起始日期}..{结束日期})` |
| `按年分区` | `VALUE({起始年份}.01M..{结束年份}.12M)` |
| `按天分区 + 按{某代码} HASH{N} 分区` | `VALUE({起始日期}..{结束日期}), HASH([SYMBOL, {N}])` |

其中 `{起始日期}/{结束日期}` 格式为 `yyyy.MM.dd`，来自 Step 2.5 用户确认；`{N}` 从分区方案 HASH 中提取数字；`{起始年份}/{结束年份}` 从日期范围计算。

**映射规则 3 — 分区列（中文 → 实际列名）：**

按 ` + ` 分割分区列，逐段映射到 schema 中的实际列名：

| 中文片段 | 查找优先级 |
|---|---|
| `交易日期` | Step 2.5 用户确认的日期分区列 |
| `股票代码` | `SecurityID` → `code` → `证券代码` |
| `期权代码` | `OptionID` → `期权代码` |
| `期货代码` | 查找含 `Future`/`期货` 的列 |
| `创建日期` | `CreateDate` → `创建日期` |
| `市场时间` | `MarketTime` → `市场时间` |
| `交易所类型` | `Market` → `Exchange` → `交易所` |
| `债券代码` | `BondCode` → `债券代码` |
| `接收时间` | `ReceiveTime` → `接收时间` |

映射后的顺序成为 `partition_cols` 列表。映射不到的列通过 `AskUserQuestion` 请用户确认。

**映射规则 4 — 排序列：**

将排序列按 ` + ` 分割，逐段映射（规则同规则 3）。特殊值 `无` 表示空列表 `[]`（OLAP 表用）。

结果顺序成为 `sort_cols` 列表。

**注意：** 当前规则使用 `TradeDate` 作为日期列名占位符，如果 Step 2.5 用户确认的实际列名不同，生成 DDL 时以用户确认为准。

#### Case B — 新数据源

1. 直接提交以下代码给 DolphinX 平台执行：

```dos
t = loadText("{CSV路径}");
bytes = memSize(t);
print("=== MEM_MB ===");
print(string(bytes / 1024.0 / 1024.0));
```

2. 读取 `=== MEM_MB ===` 后的值获取内存占用（MB）

3. 计算辅助指标：

   ```
   总内存MB = MEM_MB  （从脚本读取）
   覆盖天数 = 用户确认的日期范围天数
   日均     = 总内存MB / 覆盖天数
   按月     = 总内存MB / ceil(覆盖天数 / 30)
   ```

4. 按规则计算分区方案（目标：每个分区 100~500MB）：

   | 条件 | 时间分区 | Hash 桶数 |
   |---|---|---|
   | 总内存 < 500MB | `VALUE(日期范围·整个区间)` | 0 |
   | 日均 >= 100MB | `VALUE(日期范围·按日)` | `ceil(总内存MB/300)` |
   | 日均 < 100MB 且 按月 > 500MB | `VALUE(日期范围·按日)` | 0 |
   | 日均 < 100MB 且 按月 100~500MB | `VALUE(月份范围·按月)` | 0 |
   | 日均 < 100MB 且 按月 < 100MB | `VALUE(年份范围·按年)` | 0 |

5. HASH 列取 Step 2.5 用户确认的日期分区列或股票代码列（如有 `SecurityID`/`code`/`证券代码` 等则用该列）。有 HASH 时分区子句如 `VALUE(2023.02.01..2023.02.28), HASH([SYMBOL, 25])`，无 HASH 时如 `VALUE(2023.02M..2023.02M)`。

### Step 4: 生成建库建表脚本

写入 `generated/create_{表名}_{时间戳}.dos`：

```dos
// create_{表名}_{时间戳}.dos — 自动生成，建库建表
// 建库
if(!existsDatabase("{数据库路径}")){
    create database "{数据库路径}"
    partitioned by {分区子句，如 VALUE(2023.02.01..2023.02.28), HASH([SYMBOL, 25])}
    engine='{存储引擎}'    // 从分区方案参考表读取
}

// 建表（列定义从确认后的 schema 生成）
if(!existsTable("{数据库路径}", "{表名}")){
    create table "{数据库路径}"."{表名}"(
        TradeDate DATE[comment="交易日期", compress="delta"],
        TradeTime TIME[comment="交易时间", compress="delta"],
        ...
    )
    partitioned by {分区列},
    sortColumns=[{排序列}],
    keepDuplicates=ALL
}

// 验证
print("=== RESULT ===");
print("DB_EXISTS=" + string(existsDatabase("{数据库路径}")));
print("TB_EXISTS=" + string(existsTable("{数据库路径}", "{表名}")));
```

AI 助手提交 `.dos` 执行，读取 `=== RESULT ===` 的结果。

### Step 5: 验证与结果

读取脚本输出，向用户报告建库建表结果：

```
数据库 dfs://DB_test → 创建成功
表 dfs://DB_test.TB_test → 创建成功

数据库路径: dfs://DB_test
表名: TB_test
分区: VALUE(2023.02.01..2023.02.28), HASH([SYMBOL, 25])
列数: 6
  trade_date DATE
  SecurityID SYMBOL
  last_price DOUBLE
  trade_qty LONG
  trade_time TIME
```

## 注意事项

- **CSV 路径**：路径必须在 DDB 服务器上可访问
- **时间列**：`extractTextSchema` 基于前 100 行推断类型，大文件可能出现类型误判
- **建表 DDL**：列定义之间必须加逗号
- **覆盖数据库**：如果 DDB 报错"不允许覆盖已有数据库"，先执行 `dropDatabase("{数据库路径}")` 删除后再重建
- **生成目录**：建表 DDL 脚本统一存放在 `generated/` 子目录中

## 产出文件清单

| 文件 | 来源 |
|---|---|
| `generated/create_{表名}_{时间戳}.dos` | Step 4 建库建表脚本 |
