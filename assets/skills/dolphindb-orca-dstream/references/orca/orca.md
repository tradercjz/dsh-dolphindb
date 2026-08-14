# Orca 实时计算平台参考笔记

> 来源：DolphinDB 官方文档《Orca 实时计算平台》  
> 原始链接：https://docs.dolphindb.cn/zh/stream/orca.html  
> 用途：供 `dolphindb-orca-dstream` skill 在生成、审查和修复 Orca DStream API 完整脚本时参考。  
> 注意：本文是面向 coding agent 的摘要与工程规则，不是官方文档全文。生成代码时仍应优先查阅官方原文确认 API 参数和版本差异。

---

## 1. Orca 的定位

Orca 是 DolphinDB 在现有流数据能力之上提供的一层实时计算平台抽象，目标是降低复杂流计算任务的开发、部署、调度和高可用运维成本。

传统流计算容易遇到的问题包括：

- 需要手动推导不同引擎之间的表结构；
- 需要手写并行逻辑、级联关系和资源清理；
- 需要理解 `share`、共享会话、订阅等底层概念；
- 需要手动指定流任务部署节点；
- 节点重启后需要手动重建流计算框架；
- 查看流表、写入数据、引擎预热等运维操作分散在不同节点上。

Orca 的核心目标包括：

| 目标 | 含义 |
|---|---|
| 计算抽象 | 提供声明式 API 和链式编程风格，简化流图构建。 |
| 自动调度 | 根据流图、集群拓扑和资源状况自动部署任务。 |
| 计算任务高可用 | 通过 Checkpoint 机制在故障后恢复到最近快照。 |

对 coding agent 来说，最重要的结论是：

> 用户要求写 Orca / DStream API 时，应生成声明式流图代码，而不是普通 SQL 批处理代码。

---

## 2. 全限定名 FQN

Orca 将流图、流表、流引擎注册到 DolphinDB catalog 中，并使用三段式全限定名：

```text
<catalog>.<schema>.<name>
```

schema 由对象类型决定：

| 对象类型 | schema |
|---|---|
| 流图 | `orca_graph` |
| 流表 | `orca_table` |
| 流引擎 | `orca_engine` |

示例：

```text
demo.orca_graph.indicators
demo.orca_table.trade
demo.orca_engine.someEngine
```

生成脚本时建议：

1. 先创建或切换 catalog；
2. 查询结果表时使用 `<catalog>.orca_table.<tableName>`；
3. 不要把 Orca 公共流表当作普通内存表路径处理。

---

## 3. DStream API 编程模型

Orca 提供声明式 DStream API，用于用链式方式构建实时流计算图。

官方文档将 DStream API 分为三类：

| 类别 | 示例 |
|---|---|
| 节点定义类 | `source`, `buffer`, `sink`, `timeSeriesEngine`, `reactiveStateEngine` |
| 节点修饰类 | `setEngineName`, `parallelize`, `sync` |
| 边操作类 | `map`, `fork` |

基本模式：

```dolphindb
g = createStreamGraph("graphName")

g.source("sourceName", `col1`col2, [TYPE1, TYPE2])
    .map(funcName)
    .timeSeriesEngine(...)
    .buffer("resultTable")

g.submit()
```

coding agent 必须遵守：

- 生成 Orca 示例必须以 `createStreamGraph` 和 DStream 链式 API 为核心；
- 普通 SQL 只能用于 mock 数据准备和结果查询，不能替代流图计算；
- 必须调用 `submit()` 提交流图；
- 提交后建议等待并查看流图状态，再写入数据。

---

## 4. 流图概念

DStream API 构建的计算流程会抽象为流图。流图是有向无环图：

- 节点表示流表或引擎；
- 边表示数据传递关系；
- 流图不能成环。

流图分为：

| 类型 | 含义 |
|---|---|
| 逻辑流图 | 用户通过 DStream API 构建的业务流程。 |
| 物理流图 | `submit` 后系统添加私有流表、优化、拆分子图和流任务后的实际执行图。 |

流图状态包括：

| 状态 | 含义 |
|---|---|
| `building` | 正在构建任务。 |
| `running` | 任务已构建并正常运行。 |
| `error` | 可恢复错误，系统可能重新调度。 |
| `failed` | 不可恢复错误，需要用户修改脚本或排查运行错误。 |
| `destroying` | 正在销毁。 |
| `destroyed` | 已销毁。 |

生成脚本时建议在 `submit()` 后查看状态：

```dolphindb
sleep(3000)
getStreamGraphMeta("graphName")
```

---

## 5. 流表类型

Orca 支持两类流表：

| 类型 | 特点 | coding agent 注意事项 |
|---|---|---|
| 私有流表 | 非持久化，仅供当前流图内部使用；用于缓存、并行度匹配、多下游订阅等；不支持直接 SQL 查询。 | 不要生成 SQL 查询私有流表。 |
| 公共流表 | 持久化，可作为 source 或 sink，可被多个流图订阅，可直接 SQL 查询。 | demo 输出表应使用公共流表，便于验证。 |

查询公共流表示例：

```dolphindb
select * from demo.orca_table.trade
select * from demo.orca_table.resultTable
```

---

## 6. 提交流图后的系统处理

用户提交逻辑流图后，Orca 会进行：

1. 检查环：通过拓扑排序检查流图是否成环；
2. 添加流表：当某引擎有多个输出，或上下游并行度不同时，系统可能添加私有流表；
3. 优化：删除多余私有流表；
4. 分割子图：按并行度拆分子图；
5. 拆分流任务：每个任务调度到线程执行；
6. 添加 Channel：用于 Checkpoint 时 Barrier 对齐。

对 coding agent 的要求：

- 生成分叉流图时优先用 `fork`，不要复制多个相同 source；
- 上下游并行度不同时，应理解系统可能自动 shuffle；
- 不要构造环形数据流；
- 若需要多个下游，中间加 `buffer` 往往更清晰。

---

## 7. 系统架构摘要

Orca 采用 Master-Worker 架构：

| 组件 | 部署位置 | 职责 |
|---|---|---|
| Stream Master | Controller | 接收请求、调度任务、管理状态机、触发 Checkpoint、维护元信息。 |
| Stream Worker | data node 或 compute node | 构建流表与引擎、执行流任务、完成本地状态快照。 |
| DFS 表 | 分布式文件系统 | 持久化流图结构、调度记录、流表位置、Checkpoint 元信息。 |

coding agent 生成脚本时无需手动调度任务，但需要提醒用户：

- 集群环境下 Orca 函数需在计算组中的计算节点上运行；
- 用户需要具备相关计算组和 Orca 权限；
- 公共流表部署和持久化依赖 Orca 环境配置。

---

## 8. 调度规则摘要

Orca 调度器会考虑：

- 均衡负载；
- 计算组隔离；
- 公共流表部署在数据节点；
- siblings 任务亲和性；
- 节点 CPU、内存、磁盘等资源评分。

coding agent 不应在示例脚本中手动指定物理部署节点，除非用户明确要求并提供版本文档依据。

---

## 9. Checkpoint 与一致性

Orca 通过流图级 Checkpoint 提供高可用。

核心概念：

| 概念 | 含义 |
|---|---|
| Checkpoint | 对流图状态做快照，故障后从快照恢复。 |
| Barrier | 插入数据流中的一致性边界标记。 |
| source offset | source 端记录数据回放位置。 |
| Barrier 对齐 | 多上游场景下等所有上游 Barrier 到达后再做快照。 |

一致性语义：

| 语义 | 含义 |
|---|---|
| `AT_LEAST_ONCE` | 不丢数据，但可能重复处理。 |
| `EXACTLY_ONCE` | 不丢不重，依赖 source、计算任务和 sink 端共同保证。 |

sink 端一致性：

- 除 source 外的公共流表若使用 `keyedStreamTable` 或 `latestKeyedStreamTable`，可依靠 key 去重实现端到端 `EXACTLY_ONCE`；
- 否则通常只能保证 `AT_LEAST_ONCE`。

coding agent 生成普通 demo 时不必强制配置 Checkpoint，但如果用户要求高可用或 exactly-once，应提醒其 sink 表类型和去重 key 的要求。

---

## 10. 运维与权限

常用运维动作：

```dolphindb
getStreamGraphMeta()
getStreamGraphMeta("graphName")
dropStreamGraph("graphName")
```

调试脚本推荐：

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

注意：

- `dropStreamGraph("graphName", true)` 常用于 demo / 测试环境中清理流图及关联表；
- 生产环境不要默认删除上游流表或生产流图；
- 删除前应明确说明影响；
- 需要具备 Orca 相关权限以及计算组执行权限。

Orca 权限类型包括流图、流表、引擎管理等相关权限。生成生产脚本时，应提醒用户确认权限，而不是假设当前用户有全部权限。

---

## 11. 官方基本示例结构

官方主文档中的示例使用如下结构：

```dolphindb
g = createStreamGraph("indicators")

g.source("trade", `time`symbol`price`volume, [DATETIME,SYMBOL,DOUBLE,LONG])
    .parallelize(`symbol, 3)
    .timeSeriesEngine(windowSize=60, step=60, metrics=aggerators, timeColumn=`time, keyColumn=`symbol)
    .sync()
    .buffer("one_min_bar")
    .parallelize(`symbol, 2)
    .reactiveStateEngine(metrics=indicators, keyColumn=`symbol)
    .sync()
    .buffer("one_min_indicators")

g.submit()
```

然后：

```dolphindb
getStreamGraphMeta()
appendOrcaStreamTable("trade", trade)
select * from demo.orca_table.trade
select * from demo.orca_table.one_min_bar
select * from demo.orca_table.one_min_indicators
dropStreamGraph("indicators")
```

coding agent 可以学习这个结构，但不能在用户要求新场景时直接照搬官方 K 线、EMA、MACD、KDJ 业务代码。

---

## 12. 附录接口清单摘要

官方附录列出了 Orca 流图、流表、引擎、Checkpoint 等接口。以下为 coding agent 生成 DStream API 时最常用的接口类别摘要。

### 12.1 定义类接口

| 接口 | 作用 |
|---|---|
| `createStreamGraph` | 创建 StreamGraph 对象。 |
| `StreamGraph::setConfigMap` | 设置图的私有流表和订阅配置项。 |
| `StreamGraph::source` | 定义输入源流表。 |
| `StreamGraph::keyedSource` | 定义 keyed 输入源流表。 |
| `StreamGraph::latestKeyedSource` | 定义 latest keyed 输入源流表。 |
| `StreamGraph::haSource` | 定义高可用输入源流表。 |
| `StreamGraph::haKeyedSource` | 定义高可用 keyed 输入源流表。 |
| `StreamGraph::sourceByName` | 获取一个 Orca 创建的公共流表。 |

### 12.2 引擎类接口

| 接口 | 作用 |
|---|---|
| `DStream::timeSeriesEngine` | 定义时间序列聚合引擎。 |
| `DStream::dailyTimeSeriesEngine` | 定义日级时间序列引擎。 |
| `DStream::timeBucketEngine` | 定义自定义窗口长度时间序列聚合引擎。 |
| `DStream::reactiveStateEngine` | 定义响应式状态引擎。 |
| `DStream::reactiveStatelessEngine` | 定义响应式无状态引擎。 |
| `DStream::narrowReactiveStateEngine` | 定义生成窄表的响应式状态引擎。 |
| `DStream::dualOwnershipReactiveStateEngine` | 定义 Dual Ownership 响应式状态引擎。 |
| `DStream::crossSectionalEngine` | 定义横截面计算引擎。 |
| `DStream::sessionWindowEngine` | 定义会话窗口引擎。 |
| `DStream::ruleEngine` | 定义规则引擎。 |
| `DStream::timerEngine` | 定义时间触发引擎。 |
| `DStream::anomalyDetectionEngine` | 定义异常检测引擎。 |
| `DStream::orderBookSnapshotEngine` | 定义订单簿引擎。 |
| `DStream::cryptoOrderBookEngine` | 定义数字货币实时订单簿引擎。 |
| `DStream::udfEngine` | 创建支持副作用和状态持久化的自定义函数。 |

### 12.3 Join 类接口

| 接口 | 作用 |
|---|---|
| `DStream::asofJoinEngine` | 定义 asof join 引擎。 |
| `DStream::equalJoinEngine` | 定义等值连接引擎。 |
| `DStream::leftSemiJoinEngine` | 定义左半等值连接引擎。 |
| `DStream::lookupJoinEngine` | 定义 lookup join 引擎。 |
| `DStream::snapshotJoinEngine` | 定义快照连接引擎。 |
| `DStream::windowJoinEngine` | 定义窗口连接引擎。 |

### 12.4 流表与输出接口

| 接口 | 作用 |
|---|---|
| `DStream::buffer` | 定义中间结果流表。 |
| `DStream::keyedBuffer` | 定义 keyed 中间结果流表。 |
| `DStream::latestKeyedBuffer` | 定义 latest keyed 中间结果流表。 |
| `DStream::sink` | 定义数据输出流表。 |
| `DStream::keyedSink` | 定义 keyed 输出流表。 |
| `DStream::latestKeySink` | 定义 latest keyed 输出流表。 |

### 12.5 边操作与修饰接口

| 接口 | 作用 |
|---|---|
| `DStream::map` | 定义数据转换逻辑。 |
| `DStream::fork` | 定义流图分叉。 |
| `DStream::parallelize` | 设置并行度。 |
| `DStream::sync` | 汇总上游计算结果。 |
| `DStream::setEngineName` | 设置当前引擎名称。 |
| `DStream::getOutputSchema` | 获取表结构用于下游定义。 |

### 12.6 运行与管理接口

| 接口 | 作用 |
|---|---|
| `submit` | 提交流图。 |
| `getStreamGraphMeta` | 查看流图元信息和状态。 |
| `dropStreamGraph` | 删除流图。 |
| `appendOrcaStreamTable` | 向 Orca 流表写入数据。 |
| `stopTimerEngine` | 暂停 `timerEngine` 提交的任务。 |
| `resumeTimerEngine` | 恢复 `timerEngine` 提交的任务。 |
| `setOrcaCheckpointConfig` | 配置 Checkpoint 参数。 |
| `getOrcaCheckpointConfig` | 查看 Checkpoint 配置。 |
| `getOrcaCheckpointJobInfo` | 查看 Checkpoint Job 运行信息。 |

---

## 13. 代码生成规则摘要

当用户要求写 Orca DStream API 示例时，默认必须生成：

1. 独立 catalog；
2. `try { dropStreamGraph(name, true) } catch(ex) {}` 清理；
3. `createStreamGraph`；
4. 一个或多个 `source`；
5. DStream 链式计算；
6. `submit()`；
7. `sleep` 或 `getStreamGraphMeta`；
8. mock 数据；
9. `appendOrcaStreamTable`；
10. 结果查询；
11. 说明和注意事项。

禁止：

- 用 SQL 批处理冒充流图；
- 使用未确认 API；
- 照搬官方示例业务；
- 忘记提交；
- 忘记写入 mock 数据；
- 忘记查询结果；
- 忘记处理重复运行的旧对象残留。

---

## 14. 常见场景到引擎选择

| 业务需求 | 推荐 DStream 结构 |
|---|---|
| 过滤大额成交、阈值告警 | `source -> map/filter -> sink` |
| 每 N 秒统计成交额、笔数、均价 | `source -> map -> timeSeriesEngine -> sink` |
| 当前价格与最近 N 笔均值比较 | `source -> reactiveStateEngine -> sink` |
| 成交关联委托价格 | `orderSource + tradeSource -> lookup/equalJoinEngine -> map -> timeSeriesEngine -> sink` |
| 成交关联最近盘口快照 | `snapshotSource + tradeSource -> asof/snapshotJoinEngine -> map -> timeSeriesEngine -> sink` |
| 股票映射到行业后排名 | `source + mapTable -> lookupJoinEngine -> timeSeriesEngine -> crossSectionalEngine -> sink` |
| 连续 N 次异常 | `source -> map -> reactiveStateEngine/ruleEngine -> sink` |
| 交易片段识别 | `source -> sessionWindowEngine -> sink` |
| 定时输出市场概览 | `source -> 状态维护 -> timerEngine -> sink` |
| 一条输入流分两路处理 | `source -> fork -> branchA / branchB` |

---

## 15. 与 coding agent 问题汇总的交叉规则

结合已验证示例和问题汇总，生成代码时尤其注意：

- 不要使用 `existsStreamGraph`；
- `catch` 必须带异常变量；
- `map` 不写 `function(t){}`；
- `map` 尽量使用命名函数；
- `map` 不直接引用外部字典；
- 条件聚合使用 `iif`；
- `count` 必须带列名；
- `timeSeriesEngine` mock 数据要跨窗口；
- 结果为空先查窗口触发和 source 写入；
- `dropStreamGraph(name, true)` 用于测试环境彻底清理；
- `crossSectionalEngine` 需要显式输出分组字段；
- 不要把 `timeColumn` 和 `contextByColumn` 配成同名导致重复列；
- 不要想当然查询 `time` 列；
- `reactiveStateEngine` 不是所有序列函数都支持；
- 生产环境不要默认删除上游流表。
