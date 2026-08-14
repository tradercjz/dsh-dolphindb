# Orca 转写案例参考：复杂流计算文档案例

> 用途：记录已经用 coding agent 从 DolphinDB 官方传统流计算案例转写为 Orca DStream API 的代表案例。  
> 适用对象：当用户要求“把官方旧式 streamTable / subscribeTable / createXxxEngine 示例改写成 Orca DStream API”时，coding agent 可优先查阅本文件。  
> 原则：参考业务结构和引擎语义，不照搬旧式 API；最终仍要生成完整 Orca 流图脚本。

---

## 1. 多数据源流式实时关联处理：Asof Join 计算交易成本

### 原始旧式结构

```text
trades 流表
snapshot 流表
    ↓ createAsofJoinEngine
output
```

### Orca 转写目标

```text
snapshotStream + tradeStream
    ↓ asofJoinEngine
    ↓ map / metrics 计算 TradeCost
tradeCostResult
```

### 关键规则

- 这是 as-of 时间邻近匹配，不是维表最新值匹配，不要使用 `lookupJoinEngine`。
- 右流快照应先写入，再写入左流成交。
- 第一笔成交如果早于所有快照，匹配结果为 null，这是正确行为。
- `delayedTime` 可以用于等待右流超时输出。
- 当前 catalog 下查询结果时优先使用 `orca_table.<tableName>`，不要盲目拼接 `catalog.orca_table.<tableName>`。

### 对应示例

```text
examples/multi_source_asof_join_trade_cost.dos
```

---

## 2. 商品期货持仓指标实时计算

### 原始旧式结构

```text
InvestorPositionTable
market / contract information
    ↓ createCrossSectionalEngine / custom function
GreekTable keyedTable
```

### Orca 转写目标

```text
marketStream + positionStream
    ↓ asofJoinEngine
    ↓ 指标计算
positionIndicatorResult
```

### 关键规则

- 持仓更新时间关联最近历史行情属于 as-of 语义，优先使用 `asofJoinEngine`。
- `matchingColumn` 和 `timeColumn` 通常会自动输出对应列，不要在 `metrics` 中重复列出，避免 Duplicate column name。
- mock 数据表的列顺序必须和 source schema 严格一致。
- 时间戳字面量使用 DolphinDB 原生写法，例如 `2024.01.15T09:30:00.000`。
- 若输出最新持仓状态，key 粒度应包含 `AccountID + InstrumentID + PosiDirection`。

### 对应示例

```text
examples/future_position_indicator.dos
```

---

## 3. Level-2 延时成交订单因子

### 原始旧式结构

```text
tradeTable + entrustTable
    ↓ createLeftSemiJoinEngine（买方）
    ↓ createLeftSemiJoinEngine（卖方）
    ↓ createReactiveStateEngine
    ↓ createTimeSeriesEngine
result
```

### Orca 转写目标

```text
tradeStream + entrustStream
    ↓ leftSemiJoinEngine / 等值 join 类引擎
    ↓ reactiveStateEngine
    ↓ timeSeriesEngine
delayedTradeMinuteResult
```

### 关键规则

- 这是订单号等值匹配，不是 as-of 时间匹配，不要使用 `asofJoinEngine`。
- `metrics` 元代码中表名前缀应使用 source 名称，不要使用脚本变量名。
- 连接列通常会自动输出，不要在 metrics 里重复列出。
- 若同一个 source 在同一流图中多次用于 `leftSemiJoinEngine` 出现元数据限制，可拆成买方、卖方两个独立流图。
- 自定义状态函数必须使用 `@state`。
- 60 秒窗口必须构造跨窗口 mock 数据。

### 对应示例

```text
examples/l2_delayed_trade_factor.dos
```

---

## 4. 实时高频因子：资金净流入比例因子

### 原始旧式结构

```text
Trade
    ↓ createTimeSeriesAggregator
OHLC
    ↓ subscribeTable + factorHandler + dictHistory
factors
```

### Orca 转写目标

```text
tradeStream
    ↓ timeSeriesEngine 生成分钟 K 线
    ↓ map 计算 netAmount
    ↓ buffer 落地派生列
    ↓ fork / 多窗口 timeSeriesEngine
    ↓ asofJoinEngine 对齐 5 分钟与 10 分钟窗口
    ↓ map 计算 factor
moneyFlowFactorResult
```

### 关键规则

- `netAmount` 依赖 `open/close`，必须放在 K 线聚合之后计算，不能在原始 Trade 流上计算。
- 不要在 map/handler 中维护外部 `dictHistory`。
- `reactiveStateEngine` 不适合维护“最近 N 条并切片求和”的复杂自定义序列状态；可用多个不同窗口的 timeSeriesEngine 替代。
- 如果 fork 后下游识别不到 map 派生列，先用 `buffer("klineNet")` 落地派生结果，再从 buffer fork。
- `sourceByName` 是 `StreamGraph` 的方法，不是 DStream 的链式方法。

### 对应示例

```text
examples/hf_money_flow_factor.dos
```

---

## 5. 金融因子流式实现：移动平均买卖压力

### 原始旧式结构

```text
snapshot
    ↓ createReactiveStateEngine(metrics=<averagePress2(...)>)
resultTable
```

### Orca 转写目标

```text
snapshotStream
    ↓ reactiveStateEngine(metrics=<avgPressState(...)>)
avgPressFactorResult
```

### 关键规则

- 文档推荐“无状态函数 + 状态函数”的拆分思想，但在某些环境中 `DStream::map` 可能不可用，可退回到 reactiveStateEngine metrics 内计算。
- `fixedLengthArrayVector`、`rowWavg` 等面向向量/array vector 的函数在逐行标量执行模式下可能返回 null。
- 需要将盘口压力计算改成标量函数，例如 `calPressScalar`，手动展开多档盘口计算。
- `each(calPressScalar, ...)` 不一定能被 reactiveStateEngine 识别。
- 稳定做法：在 `@state` 函数内调用标量无状态函数，再调用 `mavg`。

### 对应示例

```text
examples/avg_press_factor.dos
```

---

## 6. 调试方法：小步快跑

复杂转写不要一次提交完整链路。推荐顺序：

```text
1. source -> 单个 engine -> sink
2. source -> engine -> map/metrics -> sink
3. buffer 后验证下游 schema
4. fork / join / 多图联动
5. 最后整合完整脚本
```

遇到连续错误时，应先验证最小 API 片段、字段名、source schema、时间字面量和输出 schema，再继续扩展。
