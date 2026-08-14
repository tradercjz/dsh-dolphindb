# Orca 金融案例参考：账户持仓损益实时监控

> 来源：DolphinDB 官方文档《Orca 声明式 DStream API 应用：账户持仓损益实时监控》  
> URL: https://docs.dolphindb.cn/zh/tutorials/orca_finance_position.html  
> 用途：作为 `dolphindb-orca-dstream` skill 的参考资料，用于确认 Orca DStream API 的复杂金融场景脚本结构、双流/多流关联、状态指标计算、数据回放、流图状态查看和结果查询方式。  
> 注意：本文件是面向 coding agent 的摘要型参考，不复制官方完整代码。生成新示例时只参考 API 结构和工程组织方式，不照搬官方业务案例。

---

## 1. 文档定位

该官方教程展示了如何使用 DolphinDB Orca 声明式 DStream API 实现“账户持仓损益实时监控”。

核心业务是：

```text
委托成交数据流
    + 持仓基础信息表
    + 行情快照数据流
        ↓
流式关联生成宽表
        ↓
响应式状态引擎计算持仓指标
        ↓
输出持仓监控结果
```

该案例比普通单流窗口聚合更复杂，适合作为以下场景的参考：

- 多输入流关联。
- 静态/准静态基础信息表与实时流关联。
- 行情快照流与成交流关联。
- 使用 `reactiveStateEngine` 计算多项有状态指标。
- 使用 `parallelize` 提高数据处理并发度。
- 使用 `appendOrcaStreamTable` 和 `useOrcaStreamTable` 写入/回放数据。
- 使用 Orca 运维函数查看流图、流表和流引擎状态。

---

## 2. 官方案例的应用场景

文档面向金融市场中的实时持仓损益监控。其背景是市场价格高速刷新，投资者需要及时掌握账户、证券、组合层面的实时盈亏、持仓偏离、可用数量等指标。

官方方案的核心目标：

- 实时接收委托成交数据。
- 实时接收行情快照数据。
- 关联账户持仓基础信息。
- 基于交易和行情变化，持续计算持仓监控指标。
- 将结果输出到 Orca 流表，供查询、订阅或 Web 数据面板展示。

---

## 3. 数据源设计

官方案例使用三类数据。

### 3.1 委托成交数据流

典型字段包括：

| 字段 | 类型 | 含义 |
|---|---|---|
| `AccountID` | SYMBOL | 账户代码 |
| `Type` | INT | 委托/成交标识 |
| `OrderNo` | INT | 委托编号 |
| `SecurityID` | SYMBOL | 证券代码 |
| `Date` | DATE | 日期 |
| `Time` | TIME | 时间 |
| `BSFlag` | SYMBOL | 买卖方向 |
| `Price` | DOUBLE | 价格 |
| `Volume` | INT | 数量 |
| `TradeNo` | INT | 成交编号 |
| `State` | SYMBOL | 状态 |
| `Mark` | INT | 成交/撤单状态标识 |
| `NetVolume` | INT | 净买入 |
| `CumSellVol` | INT | 累计卖出股数 |
| `CumBuyVol` | INT | 累计买入股数 |
| `SellPrice` | DOUBLE | 卖出均价 |
| `BuyPrice` | DOUBLE | 买入均价 |
| `ReceivedTime` | NANOTIMESTAMP | 数据接收时刻 |

### 3.2 持仓基础信息表

典型字段包括：

| 字段 | 类型 | 含义 |
|---|---|---|
| `AccountID` | SYMBOL | 账户代码 |
| `SecurityID` | SYMBOL | 证券代码 |
| `Date` | DATE | 日期 |
| `SecurityName` | STRING | 证券名称 |
| `Threshold` | INT | 阈值数量 |
| `OpenVolume` | INT | 期初数量 |
| `PreVolume` | INT | 盘前持仓 |
| `PreClose` | DOUBLE | 昨收价 |

### 3.3 行情快照数据流

典型字段包括：

| 字段 | 类型 | 含义 |
|---|---|---|
| `SecurityID` | SYMBOL | 证券代码 |
| `Date` | DATE | 日期 |
| `Time` | TIME | 行情时间 |
| `LastPx` | DOUBLE | 最新价 |

---

## 4. 关键 DStream API 结构

官方案例的流图大致包含以下阶段。

### 4.1 创建 catalog 和流图

参考结构：

```dolphindb
if (!existsCatalog("positionMonitorDemo")) {
    createCatalog("positionMonitorDemo")
}
go

use catalog positionMonitorDemo
try { dropStreamGraph("positionMonitor") } catch(ex) {}
positionMonitorGraph = createStreamGraph("positionMonitor")
```

skill 中生成新脚本时建议改进为：

```dolphindb
try { dropStreamGraph("positionMonitor", true) } catch(ex) {}
```

这样在调试/示例场景下可以同步清理流图关联流表，减少重复运行污染。

### 4.2 定义多个 source

官方案例使用 `StreamGraph::source` 定义多个 Orca 流数据表：

- `MarketDataStream`
- `PositionInfo`
- `SnapshotStream`

其中委托成交数据量较大，使用 `parallelize("AccountID", 2)` 根据账户做并行分支。

示意结构：

```dolphindb
MarketDataStream = graph.source("MarketDataStream", colNameMarketData, colTypeMarketData)
    .parallelize("AccountID", 2)

PositionInfo = graph.source("PositionInfo", colNamePositionInfo, colTypePositionInfo)

SnapshotStream = graph.source("SnapshotStream", colNameSnapshot, colTypeSnapshot)
```

写新脚本时应注意：

- source 字段名、字段类型必须和 mock 数据一致。
- 并行字段必须存在于 source schema。
- 不要为了并行而随意选择字段，应优先选择业务 key，如 `AccountID`、`SecurityID`。

### 4.3 关联持仓基础信息

官方案例使用 `lookupJoinEngine` 将委托成交流关联到持仓基础信息表。

关键参数：

- `rightStream`
- `metrics`
- `matchingColumn`
- `rightTimeColumn`

示意结构：

```dolphindb
marketJoinPositionInfo = MarketDataStream.lookupJoinEngine(
    rightStream = PositionInfo,
    metrics = [...],
    matchingColumn = `AccountID`SecurityID,
    rightTimeColumn = `Date
)
```

生成新脚本时应遵循：

- 多输入流或维表映射优先用 join engine，不要在 `map` 中引用外部字典。
- `matchingColumn` 必须明确。
- `metrics` 中必须列出后续需要的字段。
- 若存在同名列，要避免输出歧义。

### 4.4 关联行情快照

官方案例再次使用 `lookupJoinEngine`，将前一步结果与行情快照流关联，得到最新价 `LastPx`。

示意结构：

```dolphindb
marketJoinSnapshot = marketJoinPositionInfo.lookupJoinEngine(
    rightStream = SnapshotStream,
    metrics = [..., <LastPx>],
    matchingColumn = `SecurityID,
    rightTimeColumn = `Date
)
```

生成新脚本时可参考此模式处理：

```text
成交流 + 快照流
订单流 + 成交流
实时流 + 参考流
```

### 4.5 使用 reactiveStateEngine 计算持仓指标

官方案例在完成流式关联后，使用 `reactiveStateEngine` 计算多项持仓指标。

示意结构：

```dolphindb
metrics = [
    <ReceivedTime>,
    <Date>,
    <Time>,
    <SecurityName>,
    <calPositionVolume(...) as `PositionVolume>,
    <calThresholdDeviation(...) as `ThresholdDeviation>,
    ...
]

marketJoinSnapshot.reactiveStateEngine(
    metrics = metrics,
    keyColumn = `AccountID`SecurityID
)
```

要点：

- 指标函数需要有状态时，应使用 `@state` 修饰。
- `keyColumn` 必须能唯一或合理地区分状态维护对象。
- metrics 中引用的字段必须来自上游 join 后的宽表。
- 不要在 reactiveStateEngine 中使用未确认支持的状态函数。
- 对复杂持仓指标，要优先拆分成清晰的 `@state def` 函数。

---

## 5. 官方案例中的指标函数模式

官方案例定义了多类持仓监控指标，包括：

- 撤单数量。
- 实时持仓数量。
- 阈值偏离度。
- 持仓偏离度。
- 当日买入数量。
- 当日买入均价。
- 当日卖出数量。
- 当日卖出均价。
- 当日净买入数量。
- 冻结持仓。
- 可用持仓。
- 可用持仓比例。
- 当日盈亏。

对于 coding agent，重点不是记住这些具体金融公式，而是学习以下代码组织方式：

```dolphindb
@state
def calSomeIndicator(arg1, arg2, arg3) {
    // 使用 cumsum、ffill、iif、round 等状态/向量函数
    return ...
}
```

生成新脚本时要注意：

- 若函数依赖历史状态，使用 `@state`。
- 自定义状态函数应在流图定义前声明。
- 不要在自定义函数内部再嵌套定义函数。
- 不要使用未确认可在响应式状态引擎中运行的序列函数。
- 如果只是简单无状态派生字段，优先使用 `map`，不必强行使用 `reactiveStateEngine`。

---

## 6. 数据写入和回放模式

官方案例通过以下方式模拟实时数据写入：

1. 开盘前写入静态持仓基础信息：

```dolphindb
appendOrcaStreamTable("PositionInfo", positionInfo)
```

2. 对委托成交数据和行情快照数据使用 `useOrcaStreamTable`、`submitJob`、`replayDS`、`replay` 回放历史表数据。

要点：

- `appendOrcaStreamTable` 适合将内存表写入 Orca 流表。
- `useOrcaStreamTable` 可用于获取 Orca 流表对象并传给回放任务。
- `replayDS` 和 `replay` 适合从历史 DFS 表模拟实时流入。
- 示例 skill 中生成普通 demo 时，可优先使用简单 mock table + `appendOrcaStreamTable`，避免引入复杂 DFS 回放。
- 如果用户明确要求模拟真实回放，再参考官方回放模式。

---

## 7. 状态查看和结果查询

官方文档展示了以下运维和查询方式。

### 7.1 查看流图结构

```dolphindb
getStreamGraphInfo("positionMonitorDemo.orca_graph.positionMonitor")
```

### 7.2 查看流表元信息

```dolphindb
getOrcaStreamTableMeta("positionMonitorDemo.orca_table.MarketDataStream")
```

### 7.3 查看流引擎元信息

```dolphindb
getOrcaStreamEngineMeta("positionMonitorDemo.orca_graph.positionMonitor")
```

### 7.4 查询结果流表

```dolphindb
select * from positionMonitorDemo.orca_table.PositionMonitorStream
```

对 skill 的启示：

- 查询 Orca 对象时优先使用完整 FQN。
- 查询结果前最好确认流图已提交并正常运行。
- 输出表列名不要想当然，必要时先 `select top 5 *` 查看 schema。
- 若只是简单示例，可使用 `getStreamGraphMeta` 或 `getStreamGraphInfo` 辅助查看状态。

---

## 8. 性能和并行度启示

官方案例中使用大批量数据测试持仓指标计算延迟，并通过提高并发度改善高负载下的处理能力。

对 coding agent 生成脚本的启示：

- 大流量输入源可以考虑使用 `parallelize`。
- 并行字段应选择业务分组字段，如 `AccountID`、`SecurityID`。
- 并行度不应随意设置过大，demo 中通常设置 2 或 3 即可。
- 如果上下游需要汇总，可根据场景使用 `sync`。
- 性能测试不是普通 demo 的必须项，除非用户明确要求。

---

## 9. 不得照搬的官方业务内容

本文件只作为参考，生成新示例时不要直接照搬以下内容：

- 官方账户持仓损益监控业务。
- 官方 `PositionMonitorStream` 完整指标体系。
- 官方十多个持仓指标函数。
- 官方样例数据路径。
- 官方 dashboard 展示配置。
- 官方完整 PositionMonitor.dos。

可以参考的是：

- 多 source 流图结构。
- `lookupJoinEngine` 链式关联模式。
- `reactiveStateEngine` 计算多指标的组织方式。
- `parallelize` 使用方式。
- `appendOrcaStreamTable` 和回放数据写入方式。
- 运维函数和结果查询方式。

---

## 10. 对 skill 生成 Orca 代码的具体规则

当用户要求写类似“持仓/账户/成交/行情关联”场景时，coding agent 应按以下顺序设计：

```text
1. 明确所有输入流和参考表
2. 定义 source schema
3. 判断是否需要 parallelize
4. 用 joinEngine 生成宽表
5. 用 map 或 reactiveStateEngine 计算指标
6. 将结果写入 sink/buffer
7. submit 流图
8. 写入 mock 数据
9. 查询 source / join 后结果 / 最终结果
10. 说明生产环境和 demo 清理差异
```

特别注意：

- 不要在 `map` 中引用外部字典做持仓或行业映射，优先使用 `lookupJoinEngine`。
- join 后的 `metrics` 必须保留后续指标计算需要的所有字段。
- `reactiveStateEngine` 的 `keyColumn` 应包含状态维度，例如账户 + 证券。
- 如果数据量较大，可对高流量源按账户或证券并行。
- 示例 mock 数据必须保证 join key 能匹配，否则结果为空。

---

## 11. 可迁移到新示例的模式

### 模式 A：交易流 + 静态基础表

```text
tradeStream
    + baseInfo
        ↓ lookupJoinEngine
wideTradeStream
        ↓ map / reactiveStateEngine
result
```

适合：

- 账户基础信息关联。
- 股票行业映射。
- 合约乘数映射。
- 昨日均值关联。
- 风控阈值关联。

### 模式 B：交易流 + 行情快照流

```text
tradeStream
    + snapshotStream
        ↓ lookupJoinEngine / asofJoinEngine / snapshotJoinEngine
tradeWithPrice
        ↓ 指标计算
result
```

适合：

- 成交价相对盘口判断。
- 滑点计算。
- 持仓市值估算。
- 实时盈亏估算。

### 模式 C：关联宽表 + 响应式状态指标

```text
wideStream
    ↓ reactiveStateEngine(keyColumn=`AccountID`SecurityID)
positionOrRiskResult
```

适合：

- 持仓数量。
- 累计买入/卖出。
- 当日盈亏。
- 净买入。
- 阈值偏离。

---

## 12. 常见问题提醒

1. `lookupJoinEngine` 的 `matchingColumn` 必须明确，不要省略。
2. `rightTimeColumn` 应与右表时间字段一致。
3. 多次 join 后，metrics 要显式保留所有后续需要字段。
4. `reactiveStateEngine` 的 keyColumn 要覆盖状态粒度。
5. 静态基础信息表需要先写入，再写实时流。
6. 回放数据时，左右流写入顺序会影响 join 结果，应构造能匹配的数据。
7. 查询结果时使用完整 FQN。
8. 复杂指标函数必须先定义，再用于 metrics。
9. 不要把官方持仓监控代码直接当作新业务答案。
10. demo 脚本建议使用较小 mock 数据，不要默认构造千万级数据。

---

## 13. 最小参考骨架

下面是从官方案例抽象出来的多源关联 + 状态计算骨架，仅用于结构参考：

```dolphindb
if (!existsCatalog("demoCatalog")) {
    createCatalog("demoCatalog")
}
go
use catalog demoCatalog

try { dropStreamGraph("demoGraph", true) } catch(ex) {}

g = createStreamGraph("demoGraph")

leftStream = g.source("leftStream", leftCols, leftTypes).parallelize("AccountID", 2)
rightInfo = g.source("rightInfo", rightCols, rightTypes)
snapshotStream = g.source("snapshotStream", snapshotCols, snapshotTypes)

joined1 = leftStream.lookupJoinEngine(
    rightStream = rightInfo,
    metrics = [...],
    matchingColumn = `AccountID`SecurityID,
    rightTimeColumn = `Date
)

joined2 = joined1.lookupJoinEngine(
    rightStream = snapshotStream,
    metrics = [...],
    matchingColumn = `SecurityID,
    rightTimeColumn = `Date
)

resultMetrics = [
    <...>,
    <stateFunc(...) as resultCol>
]

joined2.reactiveStateEngine(
    metrics = resultMetrics,
    keyColumn = `AccountID`SecurityID
).sink("resultStream")

g.submit()
```

使用该骨架时必须根据用户的新业务重新设计：

- catalog 名称。
- graph 名称。
- source 字段。
- join key。
- metrics。
- mock 数据。
- 输出表字段。
