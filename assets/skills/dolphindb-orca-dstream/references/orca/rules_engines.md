# Orca DStream 引擎专项规则

本文件由原 `SKILL.md` 中的细则拆分而来，供 coding agent 在需要相关细节时按路径读取。

适用场景：需求涉及 timeSeriesEngine、reactiveStateEngine、joinEngine、crossSectionalEngine、sessionWindowEngine、ruleEngine、timerEngine、复杂官方案例转写或因子流式计算时读取本文件。

## 8. timeSeriesEngine 规则

### 8.1 基本规则

使用 timeSeriesEngine 时必须明确：

- `windowSize`
- `step`
- `metrics`
- `timeColumn`
- `keyColumn`

示例：

```dolphindb
.timeSeriesEngine(
    windowSize=60,
    step=60,
    metrics=metrics,
    timeColumn=`TradeTime,
    keyColumn=`SecurityID
)
```

### 8.2 metrics 字段来源

metrics 中引用的字段必须来自当前上游输出 schema。

注意：不要想当然引用 map 后的新列。如果 map 后字段在下游 metrics 中无法解析，应调整链路，或直接在 metrics 中用原始列计算。

### 8.3 条件聚合

条件聚合优先使用 `iif`：

```dolphindb
metrics = [
    <sum(iif(BSFlag == "B", TradeAmount, 0.0)) as buyAmount>,
    <sum(iif(BSFlag == "S", TradeAmount, 0.0)) as sellAmount>
]
```

如果字符串常量在元代码中导致解析问题，优先参考已验证示例或改写为更稳定的预处理字段。

### 8.4 count 必须带参数

不要写：

```dolphindb
<count() as tradeCount>
```

应写：

```dolphindb
<count(TradeID) as tradeCount>
```

或使用当前确实存在的列：

```dolphindb
<count(Price) as tradeCount>
```

### 8.5 窗口触发规则

当使用事件时间窗口，且 `useSystemTime=false` 时，窗口通常需要窗口结束后的新数据触发输出。

因此 mock 数据必须跨越窗口边界。例如窗口 60 秒时，不要只插入：

```text
09:30:01
09:30:10
09:30:20
```

应插入跨窗口数据：

```text
09:30:01
09:30:20
09:31:01
09:32:01
```

这样前一个窗口能被关闭并触发输出。

如果结果为空，优先检查：

- 数据是否跨越窗口边界。
- 是否等待了足够时间。
- timeColumn 类型是否正确。
- 是否写入了 source。
- 流图是否 running。


### 8.6 平均价格语义

若用户说“平均价格”，需区分：

简单平均价：

```dolphindb
<avg(Price) as avgPrice>
```

VWAP：

```dolphindb
<sum(Price * Volume) / sum(Volume) as vwap>
```

若用户未说明，默认使用简单均价，并在说明中提示可改为 VWAP。

### 8.7 末尾窗口强制触发规则

当使用事件时间窗口且 `useSystemTime=false` 时，最后一个窗口可能因为没有更晚数据而不输出。这是正常行为，不应误判为业务逻辑错误。

如果 demo 需要让最后一个窗口也及时输出，可考虑在 `timeSeriesEngine` 中设置 `forceTriggerTime`，例如：

```dolphindb
forceTriggerTime=30000
```

注意：

- `forceTriggerTime` 要求 `useSystemTime=false`。
- 不要与 `updateTime` 同时使用。
- 设置过小可能导致迟到的同窗口数据被丢弃。
- demo 中可以用它保证窗口及时结算；生产中需结合数据乱序和迟到数据情况谨慎设置。

### 8.8 比值 / 占比类指标规则

比值和占比类指标通常应在聚合后计算，不要在聚合阶段直接对单条记录比值求和。

错误倾向：

```text
在 timeSeriesEngine 的 metrics 中直接计算 aggressiveBuyRatio
```

推荐流程：

```text
先用 timeSeriesEngine 聚合 aggressiveBuyAmount、aggressiveSellAmount、totalAmount
再用 map 计算 aggressiveBuyRatio = aggressiveBuyAmount / totalAmount
```

适用场景：

- 主动买入占比。
- 撤单率。
- 净买入比例。
- 买卖压力比例。

---

## 9. reactiveStateEngine 规则

### 9.1 使用场景

reactiveStateEngine 适合：

- 最近 N 笔移动平均。
- 当前值与历史状态比较。
- 累计状态。
- 简单状态告警。
- 需要按 keyColumn 分组维护状态的计算。

### 9.2 状态函数限制

不要假设任意序列函数都能在 reactiveStateEngine 中使用。

若使用 `first`、`last`、复杂序列敏感函数，必须先确认该函数在 reactiveStateEngine 中受支持。

已知高风险写法：

```dolphindb
first(Price)
```

若目的是判断涨跌，优先把 `PreClose` 或基准价作为输入字段带入，而不是在 reactiveStateEngine 中强行取首值。

### 9.3 输出告警

reactiveStateEngine 计算出状态指标后，若只输出异常，需后接 map/filter 或在 metrics 中设计告警字段，确保最终结果表只包含目标输出。

### 9.4 keyColumn

必须明确 keyColumn，并确保 source 或上游输出存在该字段：

```dolphindb
.reactiveStateEngine(
    metrics=metrics,
    keyColumn=`SecurityID
)
```

---

## 10. joinEngine 规则

### 10.1 使用场景

| 场景 | 推荐 |
|---|---|
| 成交流按 OrderID 找委托价 | lookupJoinEngine / equalJoinEngine |
| 成交关联最近盘口快照 | asofJoinEngine / snapshotJoinEngine |
| 成交关联“当前最新维表/委托状态” | lookupJoinEngine |
| 两路流按 SeqNo 对齐 | equalJoinEngine / windowJoinEngine |
| 实时流关联静态映射表 | lookupJoinEngine |


### 10.1.1 as-of 语义与 lookup 语义区分

“按成交时刻关联同一股票最近一条盘口快照”这类需求，需要 as-of 语义：每笔成交应匹配时间不晚于成交时刻的最近快照。

推荐使用：

- `asofJoinEngine`
- `snapshotJoinEngine`
- 必要时使用 `windowJoinEngine`

不要误用 `lookupJoinEngine`。`lookupJoinEngine` 更适合关联“当前最新维表 / 当前最新委托状态 / 静态映射表”。如果批量注入右表快照，`lookupJoinEngine` 可能只保留每个分组最新一条右表记录，导致所有历史成交都关联到最后一条快照，从而判断结果错误。

判断原则：

| 需求 | 推荐引擎 |
|---|---|
| `SecurityID -> Industry` 静态映射 | `lookupJoinEngine` |
| `OrderID -> OrderPrice` 当前委托状态 | `lookupJoinEngine` / `equalJoinEngine` |
| 每笔成交关联成交时刻之前最近盘口 | `asofJoinEngine` / `snapshotJoinEngine` |
| 两路流按时间窗口近邻匹配 | `windowJoinEngine` |

### 10.1.2 asof join 输出列引用

as-of join 后的输出列不一定带表名前缀。下游 `map`、`metrics` 应按实际输出列名引用字段。若不确定，先查询 join 后中间 buffer 或简化输出查看 schema，不要想当然写 `left.Price`、`right.Price` 这类前缀。

### 10.2 不要在 map 中做外部字典映射

错误倾向：

```dolphindb
industryDict = dict(...)
.map(addIndustryUsingDict)
```

推荐：

```text
tradeStream + industryMap -> lookupJoinEngine -> timeSeriesEngine
```

### 10.3 多输入流必须明确左右表和关联键

生成 join 代码前必须明确：

- 左流表。
- 右流表。
- 关联键。
- 时间列。
- 同名列处理。
- 输出字段。
- 后续 metrics 引用哪一侧字段。

如果左右表有同名列，尽量避免歧义。必要时改字段名或在代码中显式处理。

### 10.4 join 后再聚合

多流 join 后，通常需要：

```text
sourceA + sourceB -> joinEngine -> map -> timeSeriesEngine -> sink
```

不要在 join 前就引用右表字段。

---

## 11. crossSectionalEngine 规则

### 11.1 使用场景

crossSectionalEngine 适合：

- 同一时间点所有股票排名。
- 行业成交额排名。
- 市场横截面 TopN。
- 板块横截面统计。

### 11.2 输出列规则

不要假设 keyColumn 会自动出现在输出表中。

若结果需要输出行业、股票、分组字段，必须在 metrics 中显式列出：

```dolphindb
metrics = <[Industry, sum_TradeAmount, rank(sum_TradeAmount, false) as amtRank]>
```

### 11.3 避免重复列名

不要把 `timeColumn` 和 `contextByColumn` 设置为同一个列，避免 `Duplicate column name`。

若上游已经是每个时间窗口一批数据，且不需要额外 contextByColumn，可以只保留 timeColumn 或按官方文档确认参数。

### 11.4 自动时间列

当使用系统时间触发时，不要想当然查询 `time` 列。输出表可能生成 `system_timestamp` 等列名。查询前可先：

```dolphindb
select top 5 * from <catalog>.orca_table.<resultTable>
```

查看真实 schema。

---

## 12. sessionWindowEngine 规则

### 12.1 使用场景

当业务是“相邻两条数据间隔超过阈值则切分片段”时，使用 sessionWindowEngine，不要用固定 timeSeriesEngine 强行模拟。

例如：

```text
同一 SecurityID 相邻两笔成交间隔超过 20 秒，则开启新的 session。
```

### 12.2 mock 数据

sessionWindowEngine 示例必须构造明显时间断点：

```text
09:30:01
09:30:05
09:30:08
09:30:45  // 与上一条间隔超过 20 秒，触发新 session
09:30:50
```

---

## 13. ruleEngine / timerEngine / udfEngine 规则

### 13.1 ruleEngine

ruleEngine 适合规则告警。若只是简单单条过滤，可用 map/filter；若有连续条件、规则组合、状态逻辑，可考虑 ruleEngine 或 reactiveStateEngine。

### 13.2 timerEngine

timerEngine 适合定时输出快照。生成 timerEngine 示例时必须明确：

- 触发间隔。
- 触发时读取什么状态。
- 输出表字段。
- mock 数据分批写入，保证定时输出有变化。

### 13.3 udfEngine

udfEngine 用于支持副作用和状态持久化的自定义函数。不要随意使用。若涉及 sharedDict / sharedTable / sharedKeyedTable，必须严格按照官方文档确认共享变量的读写声明。未确认时优先选择更简单的 DStream 内置引擎方案。

---

## 25. 复杂官方流计算案例 Orca 转写补充规则（v1.2.0）

当用户要求把 DolphinDB 官方旧式流计算案例改写成 Orca DStream API 时，必须额外遵守以下规则：

### 25.1 先识别原始案例的引擎语义

- `createAsofJoinEngine` → 需要 as-of 时间邻近语义，优先转为 Orca `asofJoinEngine`，不要误用 `lookupJoinEngine`。
- `createLeftSemiJoinEngine` → 通常是订单号、委托号等值匹配，不要误用 `asofJoinEngine`。
- `createTimeSeriesAggregator` / `createTimeSeriesEngine` → 转为 Orca `timeSeriesEngine`。
- `createReactiveStateEngine` → 转为 Orca `reactiveStateEngine`，但复杂自定义序列状态不一定适合硬塞进 `@state`。
- `createCrossSectionalEngine` → 转为 Orca `crossSectionalEngine`；需要输出 key 字段时必须在 metrics 中显式列出。

### 25.2 查询路径规则

在脚本已执行 `use catalog xxx` 后，demo 查询优先使用：

```dolphindb
select * from orca_table.resultTable
```

不要盲目拼接：

```dolphindb
select * from xxx.orca_table.resultTable
```

如果完整 FQN 查询失败，先用当前 catalog 下的 `orca_table.<表名>` 验证。

### 25.3 join metrics 字段规则

- join 的 `matchingColumn` 和 `timeColumn` 可能会自动输出，不要在 metrics 中重复列出。
- metrics 元代码中的表名前缀应使用 source 名称，不要使用脚本变量名。
- 出现 `Duplicate column name` 时，优先检查连接列和时间列是否被重复输出。
- 出现 `Unrecognized column name` 或误导性的 `Please use '==' rather than '='` 时，优先检查 source 名称、字段名和 metrics 字段来源。

### 25.4 mock 数据规则

- `appendOrcaStreamTable` 的输入表列顺序必须与 source schema 严格一致。
- 手写长向量前后必须检查各列长度一致。
- 时间戳字面量优先使用 DolphinDB 原生格式：`2024.01.15T09:30:00.000`。
- asof join demo 应先写右流，再写左流，并覆盖无匹配、匹配历史快照、匹配最新快照三类情况。
- 基于事件时间的窗口必须构造跨窗口数据，或设置合适的 `forceTriggerTime` / `delayedTime`。

### 25.5 复杂 DAG 分段验证规则

复杂转写不得一次性盲目生成超长链路。应优先拆成可验证的小段：

```text
source -> 单个 engine -> sink
source -> engine -> map/metrics -> sink
buffer 后验证下游 schema
fork / join / 多图联动
最终完整脚本
```

### 25.6 因子类案例特殊规则

- 派生字段依赖哪个上游 schema，就必须放在哪个节点之后。例如 `netAmount` 依赖 K 线 `open/close`，必须在 `timeSeriesEngine` 输出 K 线之后计算。
- 不要在 map handler 中维护外部 `dictHistory`。
- 若 `reactiveStateEngine` 难以维护最近 N 条序列，可用多个不同窗口的 `timeSeriesEngine` 加 join 对齐替代。
- fork 后下游无法识别上游 map 派生列时，先用 `buffer` 落地中间结果。
- 当前环境若不支持 `DStream::map`，可将派生计算放入下游 metrics 或 `@state` 函数中。
- 在 reactiveStateEngine 中处理逐行标量时，不要直接使用依赖 array vector 的函数；必要时写标量 helper，例如 `calPressScalar`。

## 26. v1.2.0 新增可参考示例

| `examples/multi_source_asof_join_trade_cost.dos` | asofJoinEngine 交易成本 |
| `examples/future_position_indicator.dos` | asofJoinEngine + 持仓指标计算 |
| `examples/l2_delayed_trade_factor.dos` | leftSemiJoinEngine + reactiveStateEngine + timeSeriesEngine |
| `examples/hf_money_flow_factor.dos` | timeSeriesEngine + buffer + fork + asofJoinEngine |
| `examples/avg_press_factor.dos` | reactiveStateEngine + 标量状态函数 |
