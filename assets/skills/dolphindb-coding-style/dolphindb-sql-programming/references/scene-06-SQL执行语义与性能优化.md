# scene-06 SQL 执行语义与性能优化

## 场景定义

适用于 SQL 结果不符合预期、查询慢、分布式表扫描分区过多、查询组织不合理、执行顺序误判、SQL Trace 和执行计划分析等任务。

## 适用任务

- SQL 多条件过滤结果异常。
- `context by`、`csort`、`limit`、`order by` 执行顺序不清。
- 分布式查询扫描分区过多。
- 查询先生成中间表再继续分组，性能差。
- 先连接后过滤，查询慢。
- 分组结果不跨分区但仍做全局汇总。
- 多市场、多表结果先合并再过滤。
- 需要查看执行计划或 SQL Trace。

## 推荐入口

- `[HINT_EXPLAIN]`
- `[HINT_KEEPORDER]`
- `sqlDS`
- `setTraceMode`
- `getTraces`
- `viewTraceInfo`
- `map`
- `where ... in`
- `like`
- `rowSum`

## 编码规则

### `context by` 执行顺序必须显式检查

存在 `context by` 时，SQL 会先分组，再 `csort`，再按组执行 `limit`，再计算 `select` 表达式，最后执行 `order by`。不存在 `context by` 时，`limit` 在 `order by` 后执行。

### 序列相关过滤必须使用 `and`

`where` 条件包含 `deltas`、`ratios`、`ffill`、`move`、`prev`、`cumsum` 等序列相关函数时，使用逗号会让条件顺序改变序列上下文。此类过滤应使用 `and`。

### 分布式查询优先检查分区剪枝

分布式表以分区作为物理索引。`where` 条件应尽量命中分区列或可识别的分区表达式。对分区列使用 `temporalFormat`、任意算术、链式比较、非分区时间列等，可能导致扫描过多分区。

### 能用 `where in` 过滤时，不应先连接

维度表只提供筛选键时，应先取键集合，再在主表中 `where key in keys`。先 `join` 再过滤通常会引入不必要的连接成本。

### 分布式表应直接在源表上计算

可在分布式表内完成的过滤、派生列、分组和聚合应保留在一条查询中。先查出内存表再分组，会增加合并与拆分步骤，并失去分区并行能力。

### 分组不跨分区时可使用 `map`

若分区粒度大于分组粒度，并确认分组不会跨分区，可在 `group by` 后添加 `map`，减少全局汇总成本。

### 多表归整应先过滤后合并

多张分布式表参与同一结果时，应先在各自源表中过滤日期、代码、因子，再合并结果。不要先合并大结果再过滤。

### 复杂 SQL 优化先看查询组织

多个 SQL 分步处理、分组粒度过细、字符串转换过多、未命中分区列，往往比单个函数选择更影响性能。应优先减少扫描、合并查询、调整分组粒度和下推过滤。

### SQL Trace 的开启命令必须单独执行

`setTraceMode(true)` 从开启后的第一次请求开始跟踪。它必须单独执行，不能与待跟踪 SQL 放在同一段脚本中。

## 典型写法

### 查看执行计划

```dos
select [HINT_EXPLAIN] *
from loadTable("dfs://depth", "depth")
where date(eventTime) between 2024.01.23 : 2024.01.25,
      code = "BTCUSDT"
```

### 查看扫描分区

```dos
sqlDS(<select * from loadTable("dfs://depth", "depth")
       where date(eventTime) == 2024.01.23 and code = "BTCUSDT">)
```

### 保留 `context by` 前顺序

```dos
select [HINT_KEEPORDER] id, msum(v, 3) as msum
from t
context by rowNo(v) % 2
```

### SQL Trace

```dos
setTraceMode(true)
```

```dos
select * from loadTable("dfs://S_SEC_INFO", "S_SEC_INFO")
```

```dos
setTraceMode(false)
getTraces()
viewTraceInfo(traceId)
```

### 使用 `where in` 替代过滤型连接

```dos
industrySecurityID = exec securityID from t2 where industry = "edu"

select securityID, dateTime
from t1
where securityID in industrySecurityID
```

### 分区剪枝写法

```dos
select * from loadTable("dfs://depth", "depth")
where date(eventTime) == 2024.01.23 and code = "BTCUSDT"
```

### 分组结果不跨分区时使用 `map`

```dos
select count(*)
from loadTable("dfs://depth", "depth")
group by code, bar(eventTime, 60s) map
```

### 分布式源表直接分组

```dos
select iif(max(OfferPrice1) - min(BidPrice1) == 0, 0, 1) as Price1Diff,
       count(OfferPrice1) as OfferPrice1Count,
       sum(Volume) as Volumes
from snapshot
where date(DateTime) = 2020.06.01, second(DateTime) >= 09:30:00
group by SecurityID, date(DateTime) as Date, iif(LastPx > OpenPx, 1, 0) as Flag
```

### 合并多步 SQL

```dos
res = select SecurityID, TradeTime,
      nullFill(rowSum(BidOrderQty[BidPrice >= nullFill(move(BidPrice[9], 1), BidPrice[9])])
      - nullFill(move(BidOrderQty[9], 1), 0), 0) as Bid_vol_diff,
      nullFill(rowSum(OfferOrderQty[OfferPrice <= nullFill(move(OfferPrice[9], 1), OfferPrice[9])])
      - nullFill(move(OfferOrderQty[9], 1), 0), 0) as Offer_vol_diff
from snapshot
where date(TradeTime) >= startDate
  and date(TradeTime) <= endDate
  and time(TradeTime) >= 09:30:00.000
  and time(TradeTime) <= 15:00:00.000
  and (SecurityID like "0%" or SecurityID like "3%" or SecurityID like "6%" or SecurityID like "8%")
  and (SecurityID not like "01%" and SecurityID not like "02%")
context by SecurityID, date(TradeTime)
```

## 常见反例

### 反例 01：分区列套格式化函数

代码特征：`where temporalFormat(DateTime, "yyyy.MM.dd") >= ...`。  
推荐方向：使用 `date(DateTime) between ...` 等可识别表达式。

### 反例 02：使用非分区时间列过滤

代码特征：分区列是 `eventTime`，查询按 `tradeTime` 过滤日期。  
推荐方向：用分区时间列限定扫描范围，必要时再叠加业务时间列。

### 反例 03：链式比较影响分区剪枝

代码特征：`2020.06.01 < date(DateTime) < 2020.06.03`。  
推荐方向：使用 `between` 或两个明确比较条件。

### 反例 04：先连接再过滤

代码特征：`lj(t1, t2, key)` 后只根据右表分类筛选主表。  
推荐方向：先取键集合，再 `where key in keys`。

### 反例 05：分布式查询先落成内存表

代码特征：`tmp = select ... from dfsTable where ...`，随后 `select ... from tmp group by ...`。  
推荐方向：把派生列和分组放回分布式 SQL。

### 反例 06：序列过滤使用逗号且顺序靠后

代码特征：`where date = ..., sym = ..., ratios(qty) > 1`。  
推荐方向：涉及序列条件时改用 `and`。

### 反例 07：SQL Trace 封装在一个函数中

代码特征：函数里依次执行 `setTraceMode(true)`、`code.eval()`、`setTraceMode(false)`。  
推荐方向：`setTraceMode(true)` 必须单独执行。

### 反例 08：多表因子先合并后过滤

代码特征：先 `unionAll` 沪深市场大结果，再连接维度表过滤股票。  
推荐方向：先取股票集合，各源表下推过滤和 `pivot by`，再合并。

## 检查清单

- SQL 结果是否受执行顺序影响。
- 是否存在序列相关过滤条件。
- 分布式查询是否命中分区列。
- 是否存在先连接后过滤。
- 是否存在分布式表先转内存表再分组。
- 分组是否不会跨分区，是否可使用 `map`。
- 多表是否可以先过滤后合并。
- 是否需要 `[HINT_EXPLAIN]`、`sqlDS` 或 SQL Trace 验证。

## 可转测试样本

1. `temporalFormat(DateTime, ...)` 破坏分区剪枝。
2. `tradeTime` 过滤无法命中 `eventTime` 分区。
3. `lj` 后只做行业过滤，要求改为 `where in`.
4. 分布式查询生成 `tmp_t` 后再 `group by`。
5. 普通过滤与序列过滤混用逗号。
6. `group by code, bar(eventTime, 60s)` 识别 `map` 适用条件。
7. SQL Trace 封装函数错误。
8. 三段 SQL 合并为一条 SQL 的综合优化。
