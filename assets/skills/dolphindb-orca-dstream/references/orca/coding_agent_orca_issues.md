# Coding Agent 写 DolphinDB Orca DStream API 代码问题汇总

> 用途：作为 `dolphindb-orca-dstream` skill 的参考资料。  
> 来源：用户整理的 coding agent 编写 Orca DStream API 示例过程中遇到的问题、报错、修复方式和经验总结。  
> 适用对象：生成、审查和修复 DolphinDB Orca 声明式 DStream API 完整脚本的 coding agent。  
> 目标：把实际踩坑沉淀成“可执行规则”，避免 coding agent 重复生成错误代码。

---

## 1. 总体经验

coding agent 生成 Orca DStream API 脚本时，最容易出错的地方不是业务公式，而是：

1. Orca 对象生命周期管理不完整。
2. 旧流图、旧流表、旧 schema 残留导致重复运行失败。
3. source schema 与 mock 数据不一致。
4. timeSeriesEngine 窗口数据没有触发输出。
5. map / udf 中错误引用外部变量。
6. metrics 中引用了当前上游 schema 中不存在的字段。
7. reactiveStateEngine 中使用了不支持的状态函数。
8. crossSectionalEngine 输出列、时间列、分组列配置不当。
9. 查询结果表时想当然使用错误 schema 或列名。
10. mock 数据没有人为构造触发条件，导致结果为空。

因此，生成 Orca 示例时必须优先保证：

```text
完整生命周期
    ↓
可重复运行
    ↓
mock 数据可触发
    ↓
结果可查询
    ↓
错误可定位
```

---

## 2. 环境清理与重复运行问题

### 2.1 不存在 `existsStreamGraph`

#### 问题

coding agent 曾尝试使用：

```dolphindb
if (existsStreamGraph("graphName")) {
    dropStreamGraph("graphName")
}
```

但 DolphinDB 中没有确认可用的 `existsStreamGraph` 函数，执行会失败。

#### 正确做法

测试 / demo 脚本中使用 `try-catch`：

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

#### 规则

- 不要生成 `existsStreamGraph`。
- 清理旧流图时，优先使用 `dropStreamGraph(name, true)`。
- `catch` 中必须声明异常变量，如 `catch(ex) {}`。
- 清理逻辑应放在创建新流图之前。

---

### 2.2 `dropStreamGraph` 对不存在流图会报错

#### 问题

当流图尚未创建或已被删除时，直接执行：

```dolphindb
dropStreamGraph("graphName", true)
```

可能报：

```text
no such stream graph
```

#### 正确做法

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

#### 规则

- demo 脚本必须允许重复执行。
- 所有清理旧图的代码都要用 `try-catch` 包裹。
- 不要因为清理失败中断后续创建流程。

---

### 2.3 `catch` 语法必须声明变量

#### 问题

写成：

```dolphindb
try {
    dropStreamGraph("g", true)
} catch {
}
```

会出现语法问题。

#### 正确写法

```dolphindb
try {
    dropStreamGraph("g", true)
} catch(ex) {
}
```

#### 规则

- DolphinDB `catch` 中必须声明异常变量。
- 统一使用 `catch(ex) {}`。

---

### 2.4 旧流表 schema 冲突

#### 问题

重复运行脚本时报：

```text
streamTable already exists, schema is not consistent
```

常见原因：

- 上次运行留下了同名 source 流表。
- 新脚本修改了 source 字段数或字段类型。
- Orca 创建 source 时复用旧流表，发现 schema 不一致。

#### 正确做法

调试脚本开头使用：

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

必要时换用独立 catalog，避免和历史对象冲突。

#### 规则

- 修改 source schema 后，必须清理旧流图和旧流表。
- 不要只 drop graph 而保留旧表。
- 调试场景优先使用独立 catalog。
- 生产场景不要默认删除真实上游流表。

---

### 2.5 结果行数翻倍 / 重复输出

#### 问题

每重新运行一次插入脚本，输出表行数加倍或结果重复。

#### 原因

- 输入流表仍保留上次写入的旧数据。
- 新流图启动后重新处理历史遗留数据。
- 旧引擎状态未清理。

#### 正确做法

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

#### 规则

- demo 脚本必须清理旧流图和关联流表，保证结果可复现。
- 生产环境不要删除上游真实流表。
- 清理逻辑应在注释中标明“Demo/Test only”。

---

## 3. Catalog 与 Orca 对象路径问题

### 3.1 使用独立 catalog 避免污染

#### 问题

在已有 `demo` 或 `orca` catalog 中反复测试，容易遇到同名表、同名图、schema 残留。

#### 正确做法

示例脚本使用独立 catalog：

```dolphindb
if (!existsCatalog("orcaDemo")) {
    createCatalog("orcaDemo")
}
go
use catalog orcaDemo
```

#### 规则

- demo 脚本不要默认使用生产 catalog。
- 复杂示例建议按业务单独创建 catalog，例如：
  - `orcaTradeDemo`
  - `slippage`
  - `orcaMktDemo`
  - `industryRankDemo`

---

### 3.2 查询路径错误

#### 问题

查询 Orca 表时报：

```text
The database schema demo.orca_table doesn't exist
```

可能原因：

- 流图尚未提交完成。
- 输出流表还未自动创建。
- 流图已被销毁，关联表被删除。
- 查询 catalog 不正确。

#### 正确做法

提交流图后等待并检查：

```dolphindb
g.submit()
sleep(3000)
getStreamGraphMeta("graphName")
```

查询时使用：

```dolphindb
select * from catalogName.orca_table.tableName
```

或者在已 `use catalog` 后：

```dolphindb
select * from orca_table.tableName
```

#### 规则

- 不要在 `submit()` 后立即查询输出表。
- 写入数据前最好确认流图 `status == running`。
- 查询前确认当前 catalog。
- 输出表不存在时，先确认流图是否已成功提交。

---

### 3.3 不要错误使用 `loadTable`

#### 问题

写成：

```dolphindb
loadTable("orca.orca_table.tradeStream")
```

可能报参数不足或路径错误。

#### 正确做法

对于 Orca 示例，优先直接使用 SQL 查询：

```dolphindb
select * from orca.orca_table.tradeStream
```

#### 规则

- Orca 结果验证优先用 SQL 查询。
- 不要用错误参数形式的 `loadTable`。
- 若确实要使用 `loadTable`，必须先确认对应函数签名和 catalog/schema 路径支持情况。

---

## 4. DStream::map / udf 函数问题

### 4.1 不支持 JavaScript 风格 `function(t){}`

#### 问题

写成：

```dolphindb
.map(function(t) {
    ...
})
```

报：

```text
Cannot recognize the token function
```

#### 原因

DolphinDB 不使用 JavaScript 风格匿名函数语法。

#### 正确做法 1：命名函数

```dolphindb
def calcAmount(msg) {
    return select *, Price * Volume as TradeAmount from msg
}

g.source(...)
    .map(calcAmount)
```

#### 正确做法 2：lambda 写法

在确认支持时可用：

```dolphindb
.map(msg -> select *, Price * Volume as TradeAmount from msg)
```

#### 规则

- 默认推荐“先定义命名函数，再传入 map”。
- 不要生成 `function(t){}`。
- map 函数应保持简单、纯粹、字段来源明确。

---

### 4.2 map 中不要直接引用外部变量或外部字典

#### 问题

在 `DStream::map` 或 `udfEngine` 中直接引用外部变量，例如：

```dolphindb
industryDict = dict(...)

def addIndustry(msg) {
    return select *, industryDict[SecurityID] as Industry from msg
}
```

报：

```text
Cannot recognize the token industryDict
```

#### 原因

Orca 对 DStream 自定义函数存在闭包限制。map 要求函数尽量是纯函数，不应依赖外部可变状态。

#### 正确做法

维表映射使用 `lookupJoinEngine`：

```text
tradeStream + industryMap -> lookupJoinEngine -> downstream engine
```

#### 规则

- 不要在 map 中引用外部 dict、外部 table、外部可变变量。
- 行业映射、账户映射、阈值映射、昨日日均值映射等，优先使用 join engine。
- 只有确认官方共享变量机制并配置读写者后，才考虑 udfEngine + shared variable。

---

### 4.3 udfEngine 共享变量需要正确声明

#### 问题

使用 `g.sharedDict(...)` 后，在 `udfEngine` 中读取时报：

```text
sharedVariable industryDict used in udf has not been defined for writing
```

#### 原因

Orca 共享变量机制要求明确读写关系，且写入者需要声明。

#### 规则

- 不要随意使用 udfEngine 共享变量。
- 能用 `lookupJoinEngine` 解决的映射问题，优先使用 join。
- 若必须用 shared variable，必须查官方文档确认完整声明方式。

---

## 5. timeSeriesEngine 问题

### 5.1 窗口未触发，结果为空

#### 问题

写入数据后，结果表为空。

#### 常见原因

- 数据只落在一个窗口内。
- `useSystemTime=false` 时，窗口结束后的第一条新数据才触发前一窗口输出。
- 没有等待引擎处理。
- 数据时间分布不满足窗口关闭条件。

#### 正确做法

mock 数据必须跨越窗口边界，例如窗口 60 秒时：

```text
09:30:01
09:30:20
09:31:01
09:32:01
```

写入后等待：

```dolphindb
appendOrcaStreamTable("tradeStream", t)
sleep(3000)
```

#### 规则

- 时间窗口测试数据必须跨窗口。
- 不要只写入一个窗口内的数据后立即断言有结果。
- 告警窗口需要在 mock 数据中构造能触发的窗口。
- 结果为空时先检查 source 是否有数据，再查窗口触发。

---

### 5.2 metrics 中引用字段失败

#### 问题

`timeSeriesEngine` 的 metrics 中引用某列时报：

```text
Can't recognize column ...
```

或：

```text
S02005
```

#### 常见原因

- metrics 引用了上游不存在的列。
- map 生成的新列没有按预期进入下游 schema。
- 字段名大小写或拼写不一致。
- 在元代码中使用了不稳定写法。

#### 规则

- metrics 中引用的字段必须来自当前上游 schema。
- 不要想当然使用 map 后的新字段。
- 若条件聚合可直接基于原始列完成，优先在 metrics 中直接写。
- 生成脚本前必须检查 metrics 字段来源。

---

### 5.3 `count()` 必须指定列名

#### 问题

写成：

```dolphindb
<count() as tradeCount>
```

报：

```text
The function [count] expects 1 argument(s)
```

#### 正确做法

```dolphindb
<count(TradeID) as tradeCount>
```

或：

```dolphindb
<count(Price) as tradeCount>
```

#### 规则

- 不要生成空参数 `count()`。
- 选择一个当前上游确实存在的列作为 count 参数。
- 推荐使用业务唯一列，如 `TradeID`、`OrderID`，没有时使用非空价格列。

---

### 5.4 平均价格语义要明确

#### 问题

`avg(Price)` 与 VWAP 语义不同。

#### 规则

- 用户说“平均价格”且未说明时，默认简单均价：

```dolphindb
<avg(Price) as avgPrice>
```

- 如果用户说“成交量加权均价 / VWAP”，使用：

```dolphindb
<sum(Price * Volume) / sum(Volume) as vwap>
```

- 输出说明中要提示两者差异。

---

## 6. reactiveStateEngine 问题

### 6.1 不要使用未确认支持的状态函数

#### 问题

在 `reactiveStateEngine` 中使用：

```dolphindb
first(TradePrice)
```

报：

```text
Can't find the corresponding reactive state function for sequence sensitive function first
```

#### 原因

响应式状态引擎只支持特定优化过的状态函数，不是所有序列函数都能直接使用。

#### 正确做法

- 如果需要基准值，尽量作为输入字段传入，例如 `PreClose`。
- 如果需要移动平均，使用确认支持的窗口/状态函数。
- 不确定时先查官方文档。

#### 规则

- 不要想当然在 reactiveStateEngine 中使用 `first`、复杂序列敏感函数。
- 对状态函数支持性不确定时，必须标注需验证。
- 若逻辑可以用输入字段解决，不要强行用状态函数。

---

### 6.2 状态计算要明确 keyColumn

#### 规则

- `reactiveStateEngine` 必须明确 `keyColumn`。
- `keyColumn` 应反映状态粒度，例如：
  - 股票状态：`SecurityID`
  - 账户持仓状态：`AccountID` + `SecurityID`
  - 通道状态：`ChannelID` + `MsgType`

---

### 6.3 告警类 reactiveStateEngine 必须构造触发数据

#### 问题

随机数据波动太小，首次无告警。

#### 正确做法

人为制造异常点，例如：

```dolphindb
// 构造价格跳变，确保 abs(deviation) > 0.01
```

#### 规则

- 依赖阈值的状态告警示例，mock 数据必须确定性触发。
- 不要只用随机数验证告警逻辑。

---

## 7. lookupJoinEngine / 多流关联问题

### 7.1 行业映射不要用外部字典

#### 问题

尝试在 map 中使用 `industryDict` 失败。

#### 正确做法

创建行业映射流或参考表，通过 `lookupJoinEngine` 关联：

```text
tradeStream + industryMap -> lookupJoinEngine
```

#### 规则

- `SecurityID -> Industry` 这类映射，优先使用 `lookupJoinEngine`。
- 不要把映射字典写进 map 函数闭包。
- mock 数据必须保证 join key 能匹配。

---

### 7.2 多流 join 后 metrics 必须保留后续字段

#### 规则

- join engine 的 metrics 要显式保留后续计算需要的所有列。
- 不要只保留部分字段导致 downstream metrics 缺列。
- 若左右表有同名字段，要避免歧义，必要时改别名。

---

### 7.3 订单成交滑点场景的经验

#### 典型需求

```text
orderStream(OrderID, Side, OrderPrice)
tradeStream(OrderID, TradePrice)
    ↓ join by OrderID
计算 slippage
    ↓ timeSeriesEngine
统计 avgSlippage / maxSlippage / tradeAmount / tradeCount
```

#### 关键规则

- 成交流必须能关联到委托流。
- `count` 不要写空参数。
- 时间数据必须跨越窗口边界。
- 如果旧流表 schema 冲突，换用独立 catalog 或彻底清理旧图。

---

## 8. crossSectionalEngine 问题

### 8.1 keyColumn 不一定自动输出

#### 问题

crossSectionalEngine 输出结果缺少 `Industry`。

#### 原因

`keyColumn` 指定的列不会自动出现在结果中。

#### 正确做法

在 metrics 中显式输出：

```dolphindb
metrics = <[Industry, sum_TradeAmount, rank(sum_TradeAmount, false) as amtRank]>
```

#### 规则

- 需要在结果表中看到分组字段，就在 metrics 中显式列出。
- 不要假设 keyColumn 自动进入输出。

---

### 8.2 timeColumn 与 contextByColumn 同名导致重复列名

#### 问题

设置：

```text
timeColumn = "TradeTime"
contextByColumn = "TradeTime"
```

报：

```text
Duplicate column name TradeTime
```

#### 正确做法

- 如果不需要额外 context 分组，不设置 contextByColumn。
- 如果需要 contextByColumn，避免与 timeColumn 同名。
- 先理解上游批次是否已经天然表示同一时间点。

#### 规则

- 不要把 `timeColumn` 和 `contextByColumn` 设置为同一列。
- 横截面排名示例中，如果上游 timeSeriesEngine 已按窗口输出，通常可以不额外设置同名 contextByColumn。

---

### 8.3 自动生成时间列名不要想当然

#### 问题

查询：

```dolphindb
select * from result order by time
```

报：

```text
Unrecognized column name [time]
```

#### 原因

部分引擎在 `useSystemTime=true` 时自动生成的时间列名可能是 `system_timestamp`，不是 `time`。

#### 正确做法

先查看 schema：

```dolphindb
select top 5 * from catalog.orca_table.resultTable
```

#### 规则

- 不要默认输出表有 `time` 列。
- 查询排序前先确认真实列名。
- demo 脚本中可先不写 `order by time`，或使用实际输出列。

---

## 9. sessionWindowEngine 问题

### 9.1 适用场景

当业务是“相邻数据间隔超过阈值则切分片段”时，使用 `sessionWindowEngine`，不要强行使用固定窗口。

#### 规则

- mock 数据必须构造时间断点。
- 每个 key 至少构造两个 session，方便验证。
- 输出应包含 sessionStart、sessionEnd、tradeCount、totalAmount 等字段。

---

## 10. timerEngine / 定时输出问题

### 10.1 定时输出市场概览

#### 典型需求

持续维护每只股票最新状态，然后每 10 秒输出一次市场概览。

#### 遇到的问题

1. 旧 catalog 残留导致 source 建表冲突。
2. reactiveStateEngine 中使用不支持的 `first`。
3. 输出表时间列名假设错误。

#### 规则

- 定时类示例必须先确认 API 参数，如 `triggeringPattern`、`interval`。
- 不要用未确认支持的状态函数维护首值。
- 如果需要基准价，优先将 `PreClose` 作为输入字段。
- mock 数据应分批写入，确保定时输出能变化。
- 查询输出表前先查看 schema。

---

## 11. 查询与验证问题

### 11.1 不要重复查询同一结果

#### 问题

第一次查询已得到结果，又立即 sleep + 查询同一表，得到完全相同 JSON。

#### 规则

- 已获得有效结果后，不要立即重复查询。
- 流式结果不会因为 1 秒 sleep 自动变化，除非有新数据或定时触发。
- 总结时引用第一次有效结果即可。

---

### 11.2 结果为空时的排查顺序

按照以下顺序排查：

```text
1. getStreamGraphMeta(graphName) 是否 running
2. source 表是否有数据
3. mock 数据时间是否跨窗口
4. mock 数据是否满足告警条件
5. metrics 引用字段是否存在
6. join key 是否匹配
7. sink / buffer 表是否已创建
8. 查询 catalog 和表名是否正确
```

---

## 12. 生成完整 Orca 示例脚本的硬性要求

coding agent 生成完整脚本时必须包含：

1. 顶部注释说明业务功能。
2. 创建 / 切换 catalog。
3. `try { dropStreamGraph(name, true) } catch(ex) {}` 清理旧图。
4. 创建 `createStreamGraph`。
5. 定义 source schema。
6. 定义必要 map / 状态函数。
7. 使用 DStream API 链式构建流图。
8. 调用 `submit()`。
9. `sleep` 或 `getStreamGraphMeta` 等待流图启动。
10. 构造 mock 数据。
11. 检查 mock 数据列长度。
12. `appendOrcaStreamTable` 写入数据。
13. `sleep` 等待计算。
14. 查询输入表、中间表、输出表。
15. 说明生产环境不要随意清理真实流表。

---

## 13. 代码生成前检查清单

输出前逐项检查：

- [ ] 是否创建了 catalog？
- [ ] 是否清理了旧流图？
- [ ] 是否避免使用 `existsStreamGraph`？
- [ ] `catch` 是否写成 `catch(ex)`？
- [ ] 是否创建了 `createStreamGraph`？
- [ ] 是否调用了 `submit()`？
- [ ] source 字段名、类型、mock 数据是否一致？
- [ ] mock 数据列长度是否一致？
- [ ] timeSeriesEngine 的 mock 时间是否跨窗口？
- [ ] 告警条件是否有确定性触发数据？
- [ ] map 是否使用命名函数或合法 lambda？
- [ ] map 是否没有引用外部变量？
- [ ] metrics 是否没有引用不存在字段？
- [ ] `count` 是否带参数？
- [ ] join key 是否能匹配？
- [ ] crossSectionalEngine 是否显式输出 key 字段？
- [ ] 是否避免 timeColumn/contextByColumn 重复列名？
- [ ] reactiveStateEngine 是否没有使用未确认支持的状态函数？
- [ ] 查询路径是否正确？
- [ ] 是否避免照搬官方示例？

---

## 14. 建议沉淀为 skill 规则的典型句式

### 14.1 清理旧图

```dolphindb
try {
    dropStreamGraph("graphName", true)
} catch(ex) {
}
```

### 14.2 map 命名函数

```dolphindb
def addAmount(msg) {
    return select *, Price * Volume as TradeAmount from msg
}
```

### 14.3 append 写入

```dolphindb
appendOrcaStreamTable("tradeStream", tradeData)
```

### 14.4 查询结果

```dolphindb
select * from catalogName.orca_table.resultTable
```

### 14.5 检查流图

```dolphindb
getStreamGraphMeta("graphName")
```

---

## 15. 不要再犯的问题清单

禁止生成：

```dolphindb
existsStreamGraph("g")
```

禁止生成：

```dolphindb
.map(function(t) { ... })
```

禁止生成：

```dolphindb
catch {
}
```

禁止生成：

```dolphindb
<count() as tradeCount>
```

禁止在 map 中直接使用：

```dolphindb
industryDict[SecurityID]
```

禁止在未确认时使用：

```dolphindb
first(Price)
```

禁止默认查询：

```dolphindb
order by time
```

禁止只写：

```dolphindb
select ... group by ...
```

来替代 Orca DStream API。

---

## 16. 适合测试 coding agent 的代表场景

用户已经验证过的场景类型包括：

1. 逐笔成交异常监控。
2. 实时价格偏离均线告警。
3. 实时净买入金额监控。
4. 订单成交滑点实时监控。
5. 成交价相对盘口的主动性判断。
6. 行业板块实时成交额排名。
7. 连续异常价差告警。
8. 定时输出市场概览快照。

这些案例可作为 examples 目录中的参考脚本，但生成新需求时不要简单复制。

---

## 17. 成交价相对盘口的主动性判断问题

本节来自“成交价相对盘口的主动性判断”示例调试过程。

### 17.1 关联引擎选错：as-of 需求不要误用 lookupJoinEngine

#### 需求

有两个输入流：

```text
snapshotStream：盘口快照流
tradeStream：逐笔成交流
```

对每笔成交，关联同一只股票最近的一条盘口快照，然后判断：

```text
TradePrice >= OfferPrice1 -> aggressiveBuy
TradePrice <= BidPrice1   -> aggressiveSell
otherwise                 -> neutral
```

#### 问题

最初使用 `lookupJoinEngine`，结果所有成交都被判成 `aggressiveSell`，明显不符合预期。

#### 原因

`lookupJoinEngine` 更适合关联“当前最新维表 / 当前最新状态”。在批量注入盘口快照时，它可能只保留右表每个分组时间最大的最新一条快照。这样所有成交都会关联到该股票最后一条快照，而不是按照每笔成交自己的成交时间匹配最近快照。

#### 正确做法

使用具备 as-of 语义的 join 引擎，例如：

- `asofJoinEngine`
- `snapshotJoinEngine`
- 必要时使用 `windowJoinEngine`

as-of 语义是：

```text
对每笔成交，匹配同一 SecurityID 下时间不晚于 TradeTime 的最近一条快照。
```

#### 规则

- “成交关联最近盘口快照”这类按事件时间就近匹配的需求，优先使用 `asofJoinEngine` / `snapshotJoinEngine`。
- 不要误用 `lookupJoinEngine`。
- `lookupJoinEngine` 适合关联静态映射表、当前最新维表、当前委托状态等。
- 生成多流 join 脚本前，必须先判断业务需要的是“当前最新状态”还是“按事件时间最近匹配”。

---

### 17.2 占比不能在聚合前计算

#### 问题

主动买入占比：

```text
aggressiveBuyRatio = aggressiveBuyAmount / (aggressiveBuyAmount + aggressiveSellAmount)
```

属于聚合后的比值，不能直接放在聚合前或在 timeSeriesEngine 中对单条记录比值求和。

#### 原因

聚合阶段还没有得到窗口内的 `aggressiveBuyAmount` 和 `aggressiveSellAmount` 汇总值。对单条记录的比值做 `sum` 或 `avg` 通常没有业务意义。

#### 正确做法

分两步：

1. 在 `timeSeriesEngine` 中只聚合可加的分子分母：

```text
aggressiveBuyAmount
aggressiveSellAmount
totalAmount
```

2. 在窗口结果后接一个 `map(calcRatio)` 计算占比：

```text
aggressiveBuyRatio = aggressiveBuyAmount / totalAmount
```

#### 规则

- 比值、占比、比例类指标，应优先在聚合后计算。
- timeSeriesEngine 中只计算可加指标或窗口内基本聚合值。
- 撤单率、主动买入占比、净买入比例、买卖压力比例都适用该规则。

---

### 17.3 最后一个窗口不输出不是 bug

#### 问题

某只股票唯一一笔 `aggressiveBuy` 落在最后一个时间窗口中，但结果表中该窗口一直没有输出，误以为逻辑有 bug。

#### 原因

事件时间窗口在 `useSystemTime=false` 时，窗口关闭通常需要窗口结束后的新数据触发。若最后一个窗口之后没有更晚数据，该窗口就可能一直不输出。

#### 处理方法

可以在 `timeSeriesEngine` 中设置：

```dolphindb
forceTriggerTime=30000
```

其效果是：某分组窗口结束后，只要任意分组的数据将时间线推进超过指定时间，就可以强制结算该窗口。

#### 注意

- `forceTriggerTime` 要求 `useSystemTime=false`。
- 不能与 `updateTime` 同时使用。
- 强制触发后再到达的同窗口迟到数据可能被丢弃。
- 不要设置过小，生产环境需谨慎评估乱序和迟到数据。

#### 规则

- 结果缺少最后一个窗口时，先判断是否是窗口触发机制导致。
- demo 中可以使用 `forceTriggerTime` 或补充更晚时间数据触发末尾窗口。
- 不要把最后窗口未触发误判为业务计算错误。

---

### 17.4 方法链前导点续行报错

#### 问题

把链式调用拆成多行，且下一行以 `.` 开头时，可能报：

```text
. is not a unary operator
```

#### 原因

DolphinDB 解析时可能把行首的 `.` 当成一元操作符。

#### 高风险写法

```dolphindb
g.source(...)
    .map(...)
    .timeSeriesEngine(...)
```

#### 推荐写法

使用中间变量逐步承接每一步：

```dolphindb
src = g.source(...)
joined = src.asofJoinEngine(...)
classified = joined.map(classifyTrade)
agg = classified.timeSeriesEngine(...)
result = agg.map(calcRatio)
result.sink("aggressivenessResult")
```

#### 规则

- 复杂 Orca 流图优先使用中间变量承接每一步。
- 这样既避免行首点号续行问题，也方便逐段定位错误。
- 如果保留链式写法，应把 `.` 放在上一行行尾，不要放在下一行行首。

---

### 17.5 其他细节

#### 除号

DolphinDB 脚本中除法使用普通 `/`，不要在转义或拼接时改成其他符号。

#### drop 后重建偶发元信息未就绪

`dropStreamGraph` 后立刻重建，偶尔可能遇到：

```text
stream table meta not exists
```

处理方式：

```dolphindb
try { dropStreamGraph("graphName", true) } catch(ex) {}
sleep(1000)
```

提交后如果状态是 `building`，稍等通常会转为 `running`。

#### asof join 输出列名

asof join 后的输出列不一定带表名前缀，下游应按结果实际列名引用字段。不要想当然使用表名前缀。

---

---

## 18. 复杂官方流计算案例转写问题补充（v1.2.0）

本节来自近期 5 个官方文档案例的 Orca 转写实践：Asof Join 交易成本、商品期货持仓指标、Level-2 延时成交订单因子、资金净流入比例因子、移动平均买卖压力。

### 18.1 查询 Orca 表时不要盲目拼接 catalog 前缀

#### 问题

在已执行 `use catalog xxx` 后，查询写成：

```dolphindb
select * from xxx.orca_table.result
```

可能报：

```text
xxx.orca_table doesn't exist
```

#### 经验

在部分环境中，当前 session 已切到 catalog 后，查询 Orca 流表优先使用：

```dolphindb
select * from orca_table.result
```

#### 规则

- 示例脚本中可以在 `use catalog` 后使用 `orca_table.<tableName>`。
- 如果使用完整 FQN 查询失败，不要继续猜测，应先用当前 catalog 下的 `orca_table.<tableName>` 验证。
- 不要把“查询路径错误”误判为流图未创建或表不存在。

---

### 18.2 Asof Join 右流写入顺序和 delayedTime

#### 问题

asof join 查询为空或部分数据迟迟不输出。

#### 原因

asof join 的语义是：左流记录匹配右流中时间戳不晚于左流时间戳的最近记录。若右流尚无可匹配记录，或非系统时间场景下还未达到超时触发条件，结果可能暂时为空。

#### 规则

- asof join demo 中优先先写右流，再写左流。
- mock 数据应覆盖三类情况：无匹配、匹配到前一条快照、匹配到最新快照。
- 需要强制输出时可考虑 `delayedTime`，并在代码注释中说明。
- 第一笔左流早于所有右流导致匹配为空，是正确的 asof join 语义，不是 bug。

---

### 18.3 matchingColumn / timeColumn 自动输出导致重复列

#### 问题

join engine 报：

```text
Duplicated column name: <InstrumentID>
```

#### 原因

在 `asofJoinEngine` 或 `leftSemiJoinEngine` 中，`matchingColumn` 指定的连接列、`timeColumn` 指定的时间列可能会自动进入输出表。如果又在 `metrics` 中显式列出这些列，就会重复。

#### 规则

- join engine 的 `metrics` 中不要重复列出 `matchingColumn`、`timeColumn` 自动输出的列。
- 出现 Duplicate column name 时，优先检查 metrics 是否重复输出了连接列或时间列。
- 下游要按实际输出 schema 引用列，不要想当然加表名前缀。

---

### 18.4 metrics 元代码中的表名前缀使用 source 名称

#### 问题

在 `leftSemiJoinEngine` 的 metrics 中写：

```dolphindb
<trd.DateTime>
<ent.DateTime>
```

报：

```text
Unrecognized column name
```

#### 原因

Orca DStream API 的 metrics 元代码中，表名前缀应使用 `g.source("name", ...)` 中定义的 source 名称，而不是脚本变量名。

#### 规则

- 如果 source 名称是 `"trade"`，metrics 中使用 `trade.DateTime`，不要使用承接变量名 `trd.DateTime`。
- 出现 `Please use '==' rather than '='` 这类误导性报错时，也应优先检查 source 名称、字段名和 metrics 字段来源。
- 复杂 join 先用 `getOutputSchema()` 或最小链路验证输出 schema。

---

### 18.5 appendOrcaStreamTable 要求列顺序严格匹配 source schema

#### 问题

写入 mock 表时报：

```text
Failed to append data to column 'InstrumentID'
```

#### 原因

mock table 的列顺序与 source 定义顺序不同。例如 source 为：

```text
InstrumentID, MarketTime, LastPrice, VolumeMultiple
```

而 mock 表实际先写了 `MarketTime` 再写 `InstrumentID`。

#### 规则

- `appendOrcaStreamTable` 前必须检查 mock table 的列名、列类型、列顺序与 source schema 一致。
- 手写 mock 向量时先用 `size()` 检查长度一致。
- 时间戳字面量使用 `2024.01.15T09:30:00.000`，不要默认用字符串 `timestamp("2024-01-15T09:30:00.000")`。

---

### 18.6 同一 source 多次进入 leftSemiJoinEngine 的限制

#### 问题

在一个流图里用同一个 trade source 分别构建买方和卖方 `leftSemiJoinEngine`，第二个 join 报：

```text
leftStream does not contain matchingColumn
```

#### 经验

当前环境中同一 source 对多个 `leftSemiJoinEngine` 的元数据处理可能有限制，第二次调用可能丢失部分列信息。

#### 规则

- 如果买方、卖方两条等值关联分支在一个流图中不稳定，可以拆成两个独立流图。
- 拆分为 `delayedTradeBuy` 与 `delayedTradeSell` 这类独立图，在 demo 中是可接受的。
- 不要把订单号等值关联误写成 `asofJoinEngine`。

---

### 18.7 复杂序列状态不一定适合 reactiveStateEngine 自定义函数

#### 问题

尝试用 `@state` 函数维护最近 10 条 `netAmount` 序列并计算 factor，出现：

```text
Unrecognized column name [history]
Can't recognize function mrsum
```

或因自赋值/序列维护受限而难以实现。

#### 经验

`reactiveStateEngine` 适合使用内置状态函数或较简单的状态表达式，不适合随意维护复杂 list/dict/history 并做切片求和。

#### 规则

- 对“最近 5 / 10 分钟窗口和”的需求，优先考虑多个 `timeSeriesEngine` 分别计算，再 join 对齐。
- 不要在 map handler 中维护外部 `dictHistory`。
- 如果 `netAmount` 依赖 K 线 `open/close`，必须先 `timeSeriesEngine` 生成 K 线，再 map 计算 `netAmount`。

---

### 18.8 fork 后无法识别上游派生列时先 buffer

#### 问题

`fork(2)` 后两个下游 `timeSeriesEngine` 识别不到上游 map 派生列：

```text
Unrecognized column name [netAmount]
```

#### 规则

- 若 fork 后下游引擎无法识别 map 派生列，先用 `buffer("klineNet")` 将派生字段落地，再从 buffer 上 fork。
- buffer 适合作为中间结果；最终输出优先使用 sink。
- 对多阶段复杂 DAG，优先逐段验证每一段输出 schema。

---

### 18.9 sourceByName 是 StreamGraph 方法，不是 DStream 链式方法

#### 问题

写成：

```dolphindb
someDStream.sourceByName("window5")
```

会报错。

#### 规则

- 正确方式是：

```dolphindb
g.sourceByName("catalog.orca_table.window5")
```

- `sourceByName` 用于在新的流图中引用已有 Orca 流表时，应该由 `StreamGraph` 对象调用。
- 不要把它当成 DStream 的链式方法。

---

### 18.10 DStream::map 不可用时的降级策略

#### 问题

当前环境中调用：

```dolphindb
g.source(...).map(calPressMsg)
```

报：

```text
Can't recognize the method [map]
```

#### 规则

- 如果确认当前环境不支持 `DStream::map`，不要反复尝试。
- 可将简单派生计算放到下游引擎 `metrics` 中，或封装到 `@state` 函数中。
- 生成脚本时可优先使用 references/examples 中已经跑通的写法；若仍使用 map，应说明版本依赖。

---

### 18.11 reactiveStateEngine 中的标量执行与 array vector 函数

#### 问题

在 reactiveStateEngine 中调用内部使用 `fixedLengthArrayVector`、`rowWavg` 的函数，结果全为 null。

#### 原因

在分组逐行计算中，传入函数的参数可能是标量，而 `fixedLengthArrayVector` 要求向量、矩阵或表；标量输入会导致运行期失败或返回 null。

#### 规则

- 在 reactiveStateEngine 的 metrics / @state 函数中，不要随意使用依赖 array vector 的函数处理逐行标量。
- 可改写为标量函数，例如 `calPressScalar`，手动展开 5 档盘口计算。
- `each(customFunc, ...)` 不一定能被 reactiveStateEngine 正确识别。
- 稳定做法：在 `@state` 函数中调用标量 helper，再调用 `mavg` 等状态函数。

---

### 18.12 小步快跑的调试策略

#### 规则

复杂 Orca 转写不要一次提交完整长链路。优先按以下顺序：

```text
source -> 单个 engine -> sink
source -> engine -> map/metrics -> sink
buffer 后验证下游 schema
fork / join / 多图联动
整合完整脚本
```

每一步只新增一个关键节点，先确认 schema 和输出，再继续叠加。

