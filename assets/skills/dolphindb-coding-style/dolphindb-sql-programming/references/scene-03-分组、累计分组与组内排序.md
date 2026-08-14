# scene-03 分组、累计分组与组内排序

## 场景定义

适用于普通分组聚合、明细等长组内计算、组内排序、每组前后 N 条、累计分组、连续段分组、区间分桶统计、组内更新和组内顺序函数计算。


## 适用任务

- 每组一行聚合。
- 每行保留组内统计值。
- 组内滑动窗口、差分、前值、累计值。
- 每组最新 N 条、前 N 条或按组排序后取 N 条。
- 累计分组计算。
- 连续相同值或连续满足条件的数据段统计。
- 数值区间归类统计。
- 按累计成交量切分窗口。
- 按分组更新列。

## 推荐入口

- `group by`
- `context by`
- `csort`
- `limit`
- `order by`
- `cgroup by`
- `having`
- `update ... context by`
- `aggrTopN`
- `segment`
- `asof`
- `volumeBar`
- `window`
- `mwavg`
- `deltas`
- `move`
- `cum*`

## 编码规则

### 每组一行使用 `group by`

`group by` 会把每组压缩成一行，并自动把分组列带入结果。普通聚合、分桶统计和区间统计应优先检查 `group by`。

### 明细等长输出使用 `context by`

`context by` 只分组，不压缩行数。组内统计结果会扩展到每一行。使用 `context by` 时，分组列需要在 `select` 中显式选择。

### 组内顺序计算必须声明排序依据

`context by` 配合 `csort` 时，执行顺序为分组、组内排序、组内限制行数、执行 `select`。使用差分、前值、滑窗和每组最新记录时，应检查 `csort` 是否存在。

### `limit` 与 `order by` 的顺序取决于是否存在 `context by`

存在 `context by` 时，`limit` 先于 `order by`，表示每组取数后再全局排序。不存在 `context by` 时，`limit` 在 `order by` 后执行。

### 累计分组使用 `cgroup by`

需要按时间或其他字段逐步扩大聚合范围时，使用 `cgroup by`。该语法必须配合 `order by`，并受聚合函数范围限制。

### 连续段分组使用 `segment`

按连续相同值或连续满足条件的区间计算时，使用 `segment` 生成组标识。不应手工维护组编号。

### 数值区间分桶使用 `asof`

按金额、价格、指标值落入不同区间进行统计时，使用 `asof(range, value)`。不应为每个区间写一条 SQL。

### 组内 TopN 聚合优先检查 `aggrTopN`

需要按某个排序字段选择组内前若干比例或条数后再聚合时，可使用 `aggrTopN` 减少“先过滤再外层聚合”的中间过程。

## 典型写法

### 每组一行

```dos
select sum(orderQty) as sum_orderQty
from orders
group by date
```

### 明细等长组内统计

```dos
select date, sum(orderQty) as sum_orderQty
from orders
context by date
```

### 组内滑动窗口

```dos
select tradeTime, code,
       tmavg(tradeTime, price, 3s) as movingAvg3Sec,
       tmavg(tradeTime, price, 5s) as movingAvg5Sec
from aggTradeStream10
context by code
```

### 每组按交易量取前两条

```dos
select * from t1 context by sym csort qty desc limit 2
```

### 每组最新 10 条

```dos
select *
from loadTable("dfs://Level1_TSDB", "Snapshot")
where date(DateTime) = 2020.06.01
context by SecurityID csort DateTime limit -10
```

### 标准开窗函数的 `context by` 写法

```dos
select *, window(sum, price, -1:2)
from t1
context by sym
```

### 分组更新

```dos
update t1 set avgPrice = avg(price) context by sym
```

### 累计分组 VWAP

```dos
select wavg(price, volume) as vwap
from t
group by sym
cgroup by minute(time) as minute
order by minute
```

### 分组后直接 TopN 聚合

```dos
select aggrTopN(std, LastPx, Volume, 0.25, false) as std
from snapshot
where date(DateTime) = 2020.06.01
group by SecurityID
order by SecurityID
```

### 连续相同报价分段

```dos
select last(OfferPrice1) \ first(OfferPrice1) - 1
from loadTable("dfs://Level1", "Snapshot")
where date(DateTime) = 2020.06.01
group by SecurityID, segment(OfferPrice1, false)
```

### 连续满足条件的区间最值

```dos
select * from t
context by segment(value >= targetVal)
having value >= targetVal and value = max(value)
limit 1
```

### 金额区间分类统计

```dos
range = [0.0, 40000.0, 200000.0, 1000000.0, 100000000.0]

select sum(volume) as volume_sum, sum(volume * price) as amount_sum
from t
where time <= 10:00:00
group by date, symbol, side, asof(range, volume * price) as type
```

## 常见反例

### 反例 01：需要明细等长结果却使用 `group by`

代码特征：先 `group by` 得到每组统计表，再连接回原明细。  
推荐方向：使用 `context by`。

### 反例 02：组内顺序函数缺少 `context by`

代码特征：多只股票混在一张表中，直接对全表执行 `deltas`、`move`、`ratios`。  
推荐方向：按股票 `context by`，必要时 `csort` 时间列。

### 反例 03：每组滑窗在脚本层循环

代码特征：循环每个 `symbol`，每轮 `exec` 出组内向量，再执行 `mwavg`。  
推荐方向：`select mwavg(price, volume, 4) from t context by symbol`。

### 反例 04：累计分组手工维护历史范围

代码特征：逐分钟扩大历史窗口，多次扫描前序记录。  
推荐方向：`group by ... cgroup by ... order by ...`。

### 反例 05：连续段编号由循环维护

代码特征：逐行比较当前值和下一值，手工设置分段 ID。  
推荐方向：`segment`。

### 反例 06：每个区间单独一条 SQL

代码特征：小单、中单、大单、特大单分别写查询，再追加结果。  
推荐方向：`asof(range, amount)` 后一次 `group by`。

## 检查清单

- 结果是每组一行还是明细等长。
- 组内计算是否依赖顺序。
- 是否需要 `csort`。
- 是否存在 `limit` 和 `order by` 顺序误判。
- 累计分组是否应使用 `cgroup by`。
- 连续段是否应使用 `segment`。
- 区间分类是否应使用 `asof`。

## 可转测试样本

1. 循环每只股票计算 `mwavg`，要求识别为 `context by`。
2. `group by` 后连接回明细，要求改为 `context by`。
3. 手工连续段编号，要求改为 `segment`。
4. 四条区间统计 SQL，要求改为 `asof`。
5. 使用 `context by ... order by ... limit`，要求判断实际执行顺序。
6. 累计 VWAP，要求使用 `cgroup by` 并保留 `order by`。
