# Orca 声明式 DStream API 应用：实时计算日累计逐单资金流

> 来源：DolphinDB 官方文档《Orca 声明式 DStream API 应用：实时计算日累计逐单资金流》  
> 原文链接：https://docs.dolphindb.cn/zh/tutorials/orca_finance.html  
> 本文档为 skill 使用的摘要型参考资料，用于指导 coding agent 编写新的 Orca DStream API 完整脚本。  
> 注意：官方案例用于确认 API、结构和编程模式；生成新示例时不要直接照搬官方业务逻辑、表结构和代码。

---

## 1. 文档定位

该官方教程用金融实时计算场景介绍 DolphinDB Orca 的声明式 DStream API。文档包含两个层次的示例：

1. 入门示例：过去 5 分钟主动成交量占比。
2. 复杂示例：实时计算日累计逐单资金流。

它主要展示：

- 如何创建 Orca 流图。
- 如何通过 `source` 定义输入流表。
- 如何使用 `map` 做无状态转换。
- 如何使用 `reactiveStateEngine` 做状态计算。
- 如何使用 `parallelize` 与 `sync` 做并行处理。
- 如何使用 `sink` 输出结果表。
- 如何使用 `timeSeriesEngine` 或日级时序聚合引擎做降频聚合。
- 如何通过 `appendOrcaStreamTable` 或 `useOrcaStreamTable` 向 Orca 流表写入 / 回放数据。
- 如何通过 SQL 查询 Orca 输出表。

---

## 2. DStream API 与传统 Stream API 的关系

官方文档指出，3.00.3 以前 DolphinDB 流计算主要通过函数式 Stream API 编写，例如手动创建 `streamTable`、`subscribeTable`、`createReactiveStateEngine` 等。

从 3.00.3 开始，DolphinDB 提供进一步抽象的 DStream API。它使用声明式链式编程方式定义流处理逻辑，底层系统自动完成：

- 流表创建。
- 引擎级联。
- 订阅关系。
- 并行拆分。
- 任务调度。
- 资源清理。

写 Orca 示例时，应优先体现 DStream API 的链式结构，而不是回到传统 Stream API 写法。

---

## 3. Orca 流计算作业的五个基本组成部分

官方教程将一个 Orca 流计算作业拆成五部分：

1. 在 catalog 下创建流图。
2. 指定或创建数据源。
3. 定义数据转换逻辑。
4. 指定计算结果输出表。
5. 提交流图。

对应代码结构通常是：

```dolphindb
use catalog tutorial

g = createStreamGraph("quickStart")

sourceStream = g.source(
    "trade_original",
    `securityID`tradeTime`tradePrice`tradeQty`tradeAmount`buyNo`sellNo,
    [SYMBOL,TIMESTAMP,DOUBLE,INT,DOUBLE,LONG,LONG]
)

transformedStream = sourceStream
    .map(msg -> select * from msg where tradePrice != 0)
    .reactiveStateEngine(
        metrics = [<tradeTime>, <tmsum(tradeTime, iif(buyNo > sellNo, tradeQty, 0), 5m) \ tmsum(tradeTime, tradeQty, 5m) as factor>],
        keyColumn = ["SecurityID"]
    )

transformedStream.sink("resultTable")

g.submit()
```

生成新的 skill 示例时，不必复用该业务公式，但应保留这种完整结构。

---

## 4. Catalog 与流图命名规则

官方文档说明，Orca 将流图、流表、流引擎注册到 catalog 下统一管理。流图完整标识格式类似：

```text
<catalog>.orca_graph.<graphName>
```

流表完整标识格式类似：

```text
<catalog>.orca_table.<tableName>
```

写 demo 脚本时建议：

- 使用独立 catalog，避免和用户已有对象冲突。
- 创建流图前先 `use catalog <name>`。
- 若 catalog 不存在，应先 `createCatalog`。
- 测试脚本建议先清理同名旧流图，避免同名流表 schema 冲突。

推荐结构：

```dolphindb
if (!existsCatalog("orcaDemo")) {
    createCatalog("orcaDemo")
}
go
use catalog orcaDemo

try { dropStreamGraph("demoGraph", true) } catch(ex) {}

g = createStreamGraph("demoGraph")
```

---

## 5. source 节点规则

官方示例使用 `StreamGraph::source` 新建持久化共享流数据表作为数据源。

典型写法：

```dolphindb
sourceStream = g.source(
    "tradeOriginal",
    `ChannelNo`ApplSeqNum`MDStreamID`BidApplSeqNum`OfferApplSeqNum`SecurityID`SecurityIDSource`TradePrice`TradeQty`ExecType`TradeDate`TradeTime`LocalTime`SeqNo`DataStatus`TradeMoney`TradeBSFlag`BizIndex`OrderKind`Market,
    [INT, LONG, SYMBOL, LONG, LONG, SYMBOL, SYMBOL, DOUBLE, LONG, SYMBOL, DATE, TIME, TIME, LONG, INT, DOUBLE, SYMBOL, LONG, SYMBOL, SYMBOL]
)
```

生成脚本时必须保证：

- source 字段名明确。
- source 字段类型明确。
- mock 数据列数、顺序、类型与 source schema 对齐。
- 如果用 `sourceByName` 绑定已有流表，必须明确表所在 catalog 和表名。

---

## 6. map 节点规则

官方示例中 `map` 用于无状态转换，例如过滤无效成交价格：

```dolphindb
sourceStream.map(msg -> select * from msg where tradePrice != 0)
```

在 skill 生成代码时：

- `map` 适合过滤、派生字段、无状态转换。
- 不要在 `map` 中直接引用外部字典或外部可变变量。
- 复杂映射关系优先使用 join 类引擎。
- 生成更稳妥脚本时，可先定义命名函数，再传入 `.map(funcName)`。

错误倾向：

```dolphindb
.map(function(msg) { ... })
```

推荐：

```dolphindb
def cleanTrade(msg) {
    return select * from msg where TradePrice > 0 and TradeQty > 0
}

sourceStream.map(cleanTrade)
```

---

## 7. reactiveStateEngine 使用模式

官方快速上手示例使用 `reactiveStateEngine` 计算过去 5 分钟主动成交量占比。

复杂逐单资金流案例则通过多个 `reactiveStateEngine` 级联，依次实现：

1. 按买单订单号合并。
2. 按卖单订单号合并。
3. 根据大小单标签统计资金流指标。

典型模式：

```dolphindb
buyProcessing = sourceStream.parallelize("SecurityID", parallel)
    .reactiveStateEngine(
        metrics = [
            <TradeTime>,
            <OfferApplSeqNum>,
            <TradeMoney>,
            <TradeQty>,
            <TradePrice>,
            <cumsum(TradeMoney) as `TotalBuyAmount>,
            <tagFunc(cumsum(TradeQty)) as `BuyOrderFlag>,
            <prev(cumsum(TradeMoney)) as `prevTotalBuyAmount>,
            <prev(tagFunc(cumsum(TradeQty))) as `prevBuyOrderFlag>
        ],
        keyColumn = ["SecurityID", "BidApplSeqNum"]
    )
```

要点：

- `metrics` 中既可以保留原始字段，也可以定义状态计算字段。
- `keyColumn` 决定状态分组粒度。
- 对订单级合并类逻辑，keyColumn 往往是多列，例如 `SecurityID + OrderID`。
- 自定义状态函数需要使用 `@state` 修饰。
- 不要假设任意序列函数都能在 reactiveStateEngine 中使用。

---

## 8. 自定义状态函数规则

官方资金流案例定义了大小单标签函数：

```dolphindb
@state
def tagFunc(qty) {
    return iif(qty <= 20000, 0, iif(qty <= 200000, 1, 2))
}
```

规则：

- 若函数用于 `reactiveStateEngine` 的 `metrics`，应使用 `@state`。
- 函数逻辑应保持简单明确。
- 不要在自定义状态函数中嵌套定义函数。
- 不要依赖外部可变状态。
- 阈值类逻辑应根据用户业务重新设定，不要照搬官方大小单边界。

---

## 9. parallelize 与 sync 规则

官方文档强调：`DStream::parallelize` 和 `DStream::sync` 必须配套使用。二者之间的转换逻辑会被自动拆成多个流计算子任务并行执行。

示例结构：

```dolphindb
parallel = 3

stream = sourceStream
    .parallelize("SecurityID", parallel)
    .reactiveStateEngine(...)
    .reactiveStateEngine(...)
    .sync()
```

规则：

- 使用 `parallelize` 后，必须在适当位置调用 `sync`。
- 并行字段通常选分组键，例如 `SecurityID`。
- 不要随意设置过高并行度。
- 示例脚本中可使用较小并行度，例如 2 或 3。
- 并行段内的计算应保证同一 key 的状态被路由到同一任务。

---

## 10. sink 规则

官方示例中用 `sink` 将转换结果写入 Orca 流表：

```dolphindb
transformedStream.sink("resultTable")
```

规则：

- `sink` 可创建或指定结果表。
- 结果表可通过 SQL 查询。
- 一个流图中可以有多个输出表。
- 可以先输出中间结果，再基于该结果继续转换。

例如官方资金流案例中，先输出逐单资金流结果，再继续对其进行时间降频聚合。

---

## 11. timeSeriesEngine / 降频聚合模式

官方资金流案例在逐单资金流计算后，继续用时序聚合引擎做 60 分钟降频：

```dolphindb
hourlyAggr = capitalFlow
    .timeSeriesEngine(
        windowSize = 60000 * 60,
        step = 60000 * 60,
        metrics = [
            <last(TotalAmount)>,
            <last(SellSmallAmount)>,
            <last(SellMediumAmount)>,
            <last(SellBigAmount)>,
            <last(BuySmallAmount)>,
            <last(BuyMediumAmount)>,
            <last(BuyBigAmount)>
        ],
        timeColumn = "TradeTime",
        useSystemTime = false,
        keyColumn = "SecurityID"
    )

hourlyAggr.sink("capitalFlowStream60min")
```

生成新代码时可借鉴：

- 对明细流先做状态计算。
- 将状态计算结果输出到中间表。
- 再用 `timeSeriesEngine` 做降频聚合。

注意：

- `timeColumn` 必须存在。
- `useSystemTime=false` 时，窗口输出依赖事件时间推进。
- mock 数据必须跨越窗口边界。
- 若使用 `last` 等聚合函数，确保字段存在于上游输出。

---

## 12. appendOrcaStreamTable 与 useOrcaStreamTable

入门示例通过 `appendOrcaStreamTable` 向 Orca source 写入模拟数据：

```dolphindb
data = table(securityID, tradeTime, tradePrice, tradeQty, tradeAmount, buyNo, sellNo)
appendOrcaStreamTable("tutorial.orca_table.trade_original", data)
```

复杂案例中使用 `useOrcaStreamTable` 在 Orca 集群中对流表执行远程调用，例如提交数据回放任务：

```dolphindb
useOrcaStreamTable("tutorial.orca_table.tradeOriginal", def (table) {
    submitJob("replay", "replay", def (table) {
        ds = replayDS(<select * from loadTable("dfs://trade", `trade) where TradeDate = 2024.10.09>, datecolumn=`TradeDate)
        replay(inputTables=ds, outputTables=table, dateColumn=`TradeTime, timeColumn=`TradeTime, replayRate=1, absoluteRate=false, preciseRate=true)
    }, table)
})
```

skill 生成 demo 脚本时优先使用 `appendOrcaStreamTable` 写入 mock 数据。只有用户明确需要回放历史 DFS 表时，才使用 `useOrcaStreamTable` 和 `replay` 相关逻辑。

---

## 13. 查询结果规则

官方示例用 SQL 查询 Orca 输出表：

```dolphindb
select * from tutorial.orca_table.resultTable
```

生成脚本时必须包含查询代码，例如：

```dolphindb
select * from <catalog>.orca_table.<sourceName>
select * from <catalog>.orca_table.<resultTable>
```

复杂脚本建议查询：

1. source 表，验证数据是否写入。
2. 中间结果表，验证级联是否工作。
3. 最终输出表，验证业务结果。

---

## 14. 官方案例可借鉴的代码模式

### 14.1 入门链式模式

```text
createStreamGraph
  -> source
  -> map
  -> reactiveStateEngine
  -> sink
  -> submit
  -> appendOrcaStreamTable
  -> select result
```

适用于：

- 简单实时因子。
- 当前记录 + 历史窗口状态。
- 过滤 + 状态计算。

### 14.2 多级状态引擎级联模式

```text
source
  -> parallelize
  -> reactiveStateEngine 1
  -> reactiveStateEngine 2
  -> reactiveStateEngine 3
  -> sync
  -> sink intermediate
  -> timeSeriesEngine
  -> sink final
```

适用于：

- 订单合并。
- 多阶段状态依赖。
- 先计算明细状态，再降频输出。

### 14.3 并行处理模式

```text
source.parallelize(key, n)
    .engineA(...)
    .engineB(...)
    .sync()
```

适用于：

- 按股票、账户、设备等 key 独立计算。
- 状态计算压力较大。
- 需要提升吞吐。

---

## 15. 官方案例不应照搬的内容

在生成新示例时，不要直接复用以下官方业务案例：

1. 过去 5 分钟主动成交量占比。
2. 实时日累计逐单资金流。
3. 官方表结构中的完整逐笔成交字段集。
4. 官方大小单标签边界。
5. 官方 `capitalFlow` 计算链路。
6. 官方 Dashboard 配置。
7. 官方回放数据路径和 CSV 文件路径。

可以借鉴 API 和结构，但业务场景、字段、mock 数据、指标逻辑必须根据用户需求重新设计。

---

## 16. coding agent 生成脚本时的强制规则

1. 生成完整脚本，不只给片段。
2. 创建或切换 catalog。
3. 调试脚本前清理旧流图：`dropStreamGraph(name, true)`。
4. 定义 source schema。
5. 使用 DStream API 链式写法。
6. 包含 `g.submit()`。
7. 包含 mock 数据。
8. 使用 `appendOrcaStreamTable` 写入 source。
9. 查询输出结果表。
10. 不用普通 SQL 替代流图计算。
11. 不照搬官方业务案例。

---

## 17. 常见生成任务映射

| 用户需求 | 可参考官方模式 | 不要照搬 |
|---|---|---|
| 简单过滤 + 状态指标 | 入门示例的 source -> map -> reactiveStateEngine -> sink | 主动成交量占比公式 |
| 多阶段状态计算 | 资金流案例的多级 reactiveStateEngine | 逐单资金流业务逻辑 |
| 并行计算 | 资金流案例的 parallelize + sync | 官方 parallel=3 可按需调整 |
| 明细流降频 | 资金流案例的 sink intermediate -> timeSeriesEngine | 官方 60 分钟资金流指标 |
| 历史数据回放 | useOrcaStreamTable + replay 模式 | 官方 CSV 路径和 DFS 表名 |

---

## 18. 生成前检查清单

生成使用本参考文档的脚本前，检查：

- 是否需要 `reactiveStateEngine`，还是普通 `timeSeriesEngine` 就足够。
- 若使用 `reactiveStateEngine`，状态函数是否被支持。
- 若使用 `parallelize`，是否配套 `sync`。
- 若使用 `timeSeriesEngine`，mock 数据是否跨窗口。
- 若输出中间结果，后续是否基于该 DStream 继续处理。
- 是否正确使用 `appendOrcaStreamTable` 写入 source。
- 是否查询 `<catalog>.orca_table.<table>`。
- 是否避免照搬官方主动成交量占比和逐单资金流示例。

---

## 19. 推荐在 skill 中引用的结论

- DStream API 的价值在于通过链式调用定义流处理逻辑，降低手动管理流表、订阅、引擎级联的复杂度。
- Orca 流图提交后会被系统转换为物理流图，并由 Orca 自动完成调度和并行拆分。
- Catalog 能帮助隔离不同项目的流图和流表，建议 demo 使用独立 catalog。
- `source` 创建输入流表，`map` 做无状态转换，各类 engine 做有状态计算，`sink` 指定输出，`submit` 提交流图。
- 示例脚本应包含数据写入和结果查询，证明流图能被触发。

