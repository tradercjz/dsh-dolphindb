# Orca DStream 代码生成通用规则

本文件由原 `SKILL.md` 中的细则拆分而来，供 coding agent 在需要相关细节时按路径读取。

适用场景：生成或修复任何 Orca DStream 脚本时读取本文件，尤其是生命周期、source/map/buffer/sink、mock 数据、查询验证、常见错误和禁止项。

## 6. 环境与生命周期规则

### 6.1 Orca 功能启用

Orca 脚本运行前，目标环境需要启用 Orca。若脚本依赖 Orca，说明中必须提醒：

```text
运行前请确认 cluster.cfg 或 controller.cfg 已配置 enableORCA=true，并确认当前节点支持运行 Orca 函数。
```

### 6.2 Catalog 使用

生成 demo 脚本时，优先使用独立 catalog，避免和用户已有对象冲突。

推荐命名：

```text
orcaDemo
orcaTradeDemo
orcaRankDemo
orcaMktDemo
```

不要默认使用用户生产 catalog。

### 6.3 清理旧流图

测试 / demo 脚本默认写：

```dolphindb
try {
    dropStreamGraph("<graphName>", true)
} catch(ex) {
}
```

原因：

- 旧流图可能残留旧引擎状态。
- 旧公共流表可能残留旧数据。
- source 同名但 schema 变了会导致 `streamTable already exists, schema is not consistent`。
- 多次运行时结果可能重复叠加。

不要写：

```dolphindb
if (existsStreamGraph("<graphName>")) ...
```

因为 `existsStreamGraph` 不是确认过的 API。

### 6.4 生产环境清理规则

调试脚本可以清理旧图。生产脚本不要默认清理真实上游流表。

生产环境建议写成注释或独立清理段：

```dolphindb
// Demo only:
// try { dropStreamGraph("<graphName>", true) } catch(ex) {}
//
// In production, do not drop upstream Orca stream tables unless confirmed.
```

### 6.5 不要手动乱删流表

若流表由流图创建，优先使用：

```dolphindb
dropStreamGraph("<graphName>", true)
```

不要在流图仍引用流表时直接删除流表。若确实需要删除独立流表，必须先确认它不被运行中的流图引用。

---

## 7. DStream API 编写规则

### 7.1 必须使用 createStreamGraph

Orca DStream API 脚本必须以流图为核心：

```dolphindb
g = createStreamGraph("<graphName>")
...
g.submit()
```

不得只写普通 SQL：

```dolphindb
select sum(...) from t group by ...
```

普通 SQL 只能用于：

- 构造 mock 数据。
- 查询 Orca 结果表。
- 辅助验证输出。

### 7.2 source 规则

source 定义必须明确字段名和字段类型：

```dolphindb
g.source("tradeStream", `SecurityID`TradeTime`Price`Volume, [SYMBOL, TIMESTAMP, DOUBLE, LONG])
```

mock 数据必须与 source schema 保持：

- 列数一致。
- 列顺序一致。
- 类型一致。
- 向量长度一致。

### 7.3 map 规则

不要写 JavaScript 风格匿名函数：

```dolphindb
.map(function(t) { ... })  // 禁止
```

可以使用命名函数：

```dolphindb
def calcAmount(msg) {
    return select *, Price * Volume as TradeAmount from msg
}

g.source(...)
    .map(calcAmount)
```

或在确认支持时使用 DolphinDB lambda 写法：

```dolphindb
.map(msg -> select *, Price * Volume as TradeAmount from msg)
```

更稳妥的默认写法是：**先定义命名函数，再传入 map**。

### 7.4 map 闭包限制

不要在 `map` 或普通 DStream 自定义函数中直接引用外部变量、外部字典或外部可变状态。

错误倾向：

```dolphindb
industryDict = dict(...)
def addIndustry(msg) {
    return select *, industryDict[SecurityID] as Industry from msg
}
```

推荐：

- 维表映射使用 `lookupJoinEngine`。
- 需要状态持久化和副作用时，考虑 `udfEngine`，并按官方共享变量机制配置。
- 不确定时不要强写闭包。

### 7.5 fork 规则

一条输入流需要同时进入多个任务时，使用 `fork`，不要重复创建多个相同 source。

结构示意：

```text
source
  ├── branch A: map -> timeSeriesEngine -> sink
  └── branch B: map -> filter/map -> sink
```

输出任何 ASCII 流图时，必须用代码块包裹，避免 Markdown 折叠空格。

### 7.6 buffer / sink 规则

- 中间结果可用 `buffer`。
- 最终结果可用 `sink` 或 `buffer`，按官方接口和当前示例风格选择。
- 如果后续需要 SQL 查询，输出应是 Orca 公共流表，并用：

```dolphindb
select * from <catalog>.orca_table.<tableName>
```

查询。

---

## 14. mock 数据生成规则

### 14.1 必须能触发结果

告警类示例必须人为构造能触发告警的数据，不能只依赖随机数。

例如价格偏离均线告警：

```dolphindb
// 构造正常价格后，插入明显跳变价格，确保触发 abs(deviation) > 0.01
```

### 14.2 所有列长度一致

在构造 table 前，必须保证向量长度一致。对于复杂 mock 数据，建议显式检查：

```dolphindb
print(size(SecurityID), size(TradeTime), size(Price), size(Volume))
```

### 14.3 时间分布要覆盖窗口触发

窗口聚合必须跨窗口：

```text
错误：所有数据都在 09:30:00 - 09:30:59
正确：数据覆盖 09:30、09:31、09:32，至少有一条数据触发前一窗口关闭
```

### 14.4 多输入流要保证能 join

多输入流 join 示例必须保证：

- join key 能匹配。
- 时间关系合理。
- 左右流数据都写入。
- 写入顺序符合 join 引擎语义。

### 14.5 不要使用不可复现随机数据作为唯一验证

可以使用 rand，但告警或验证结果必须通过确定性数据保证能出现。

---

## 15. 查询和验证规则

### 15.1 提交后等待或检查

提交流图后，不要立刻写入和查询。至少：

```dolphindb
g.submit()
sleep(3000)
getStreamGraphMeta("<graphName>")
```

如果写状态轮询，要确保语法正确；简单示例中优先使用 `sleep` + `getStreamGraphMeta`。

### 15.2 查询路径

查询 Orca 流表可用：

```dolphindb
select * from orca_table.<tableName>
```

或：

```dolphindb
select * from <catalog>.orca_table.<tableName>
```

不要错误使用：

```dolphindb
loadTable("<catalog>.orca_table.<tableName>")
```

若需要 loadTable，必须使用正确参数形式，并确认文档支持。通常示例中直接 SQL 查询更清晰。

### 15.3 查询顺序

建议查询：

1. 输入 source。
2. 中间 buffer。
3. 最终输出表。

例如：

```dolphindb
select * from demo.orca_table.tradeStream
select * from demo.orca_table.windowStats
select * from demo.orca_table.alertResult
```

### 15.4 结果为空排查

结果为空时优先检查：

- 流图是否 running。
- source 是否真的写入数据。
- timeSeriesEngine 窗口是否关闭。
- mock 数据是否触发告警条件。
- metrics 是否引用正确字段。
- sink / buffer 是否已创建。
- 是否查询了正确 catalog 和表名。
- 是否 sleep 等待了引擎处理。

---

## 16. 常见错误与修复规则

### 16.1 `existsStreamGraph` 不存在

不要使用：

```dolphindb
existsStreamGraph(...)
```

使用：

```dolphindb
try {
    dropStreamGraph("<graphName>", true)
} catch(ex) {
}
```

### 16.2 `catch` 未声明变量

错误：

```dolphindb
catch {
}
```

正确：

```dolphindb
catch(ex) {
}
```

### 16.3 `function(t){}` 报错

错误：

```dolphindb
.map(function(t) { ... })
```

正确：

```dolphindb
def calc(msg) {
    return select ... from msg
}
.map(calc)
```

或在确认可用时：

```dolphindb
.map(msg -> select ... from msg)
```

### 16.4 `count()` 参数缺失

错误：

```dolphindb
<count() as tradeCount>
```

正确：

```dolphindb
<count(TradeID) as tradeCount>
```

### 16.5 schema 不一致

报错类似：

```text
streamTable already exists, schema is not consistent
```

处理：

- 使用独立 catalog。
- 清理旧流图：

```dolphindb
try { dropStreamGraph("<graphName>", true) } catch(ex) {}
```

- 不要复用旧 source 名导致 schema 冲突。

### 16.6 结果重复 / 行数翻倍

原因通常是旧公共流表保留旧数据，或旧流图重新消费遗留数据。

处理：

```dolphindb
try { dropStreamGraph("<graphName>", true) } catch(ex) {}
```

调试环境每次从干净状态启动。

### 16.7 窗口未触发

处理：

- mock 数据跨越窗口边界。
- 写入窗口结束后的新数据。
- sleep 等待。
- 查询 source 验证数据已写入。

### 16.8 map 中引用外部字典失败

不要在 map 中引用外部字典。使用 lookupJoinEngine 关联映射表。

### 16.9 crossSectionalEngine 输出缺字段

在 metrics 中显式列出需要输出的字段。

### 16.10 `first` 等状态函数在 reactiveStateEngine 中报错

不要假设所有序列函数都支持。确认支持后再使用。若只是比较基准值，优先把基准字段作为输入列。

### 16.11 查询列名想当然

不要默认输出表一定有 `time` 列。先 `select top 5 *` 查看结果表 schema。

---

## 17. 代码风格规范

- 脚本注释使用中文或英文均可，推荐关键步骤用分段注释。
- 变量名应与业务一致，避免 `t1`、`tmp2` 过多。
- graph、source、result 表名应清晰：
  - `priceDeviationGraph`
  - `tradeStream`
  - `priceDeviationAlert`
- catalog 名称应避免与生产 catalog 冲突。
- 示例代码不应过度抽象，优先可读、可复制执行。
- 自定义函数不要嵌套定义函数。
- 不要在一个函数中混合太多无关逻辑。
- 输出 ASCII 流图、拓扑图时必须用 fenced code block 包裹。

---


### 17.1 链式调用换行规则

DolphinDB 中多行链式调用不要让下一行以 `.` 开头，否则可能报：

```text
. is not a unary operator
```

高风险写法：

```dolphindb
g.source(...)
    .map(...)
    .timeSeriesEngine(...)
```

更稳妥的写法是使用中间变量逐步承接：

```dolphindb
src = g.source(...)
mapped = src.map(calcFunc)
agg = mapped.timeSeriesEngine(...)
result = agg.map(calcRatio)
result.sink("resultTable")
```

如果必须保留链式写法，应把 `.` 放在上一行行尾，而不是新行行首。生成复杂流图时，优先使用中间变量，既避免语法坑，也方便逐段定位问题。

## 18. 禁止项

禁止生成以下内容：

1. 用普通 SQL 批处理替代 Orca DStream API。
2. 使用不存在或未确认的 API，例如 `existsStreamGraph`。
3. 在 map 中直接引用外部可变变量或外部字典。
4. 使用 JavaScript 风格 `function(t){}`。
5. `count()` 不带参数。
6. source schema 与 mock 数据不一致。
7. mock 数据不能触发任何输出。
8. timeSeriesEngine 测试数据不跨窗口，却声称结果应产生。
9. 未 submit 就 append 数据。
10. 未 appendOrcaStreamTable 就查询结果。
11. 盲目查询 `time` 列。
12. 直接删除生产流图或生产流表。
13. 照搬官方 K 线、EMA、MACD、KDJ、逐单资金流、持仓损益等示例作为用户新需求代码。
14. 输出不完整代码却声称“完整可运行”。
15. 使用 shell、Python 或其他外部命令完成 DolphinDB 内部逻辑。
16. 在成交关联最近盘口快照这类 as-of 需求中误用 `lookupJoinEngine`。
17. 在聚合前错误计算主动买入占比、撤单率等需要聚合后计算的比值。
18. 多行链式调用时让新行以 `.` 开头。

---

## 19. 官方示例使用边界

官方 Orca 文档和教程只作为以下内容来源：

- API 名称。
- 参数模式。
- 完整脚本组织方式。
- mock 数据写入方式。
- 查询结果方式。
- 清理流图方式。
- DStream API 链式结构。

不得直接复用以下官方业务逻辑作为用户的新示例：

- 1 分钟 K 线。
- EMA、MACD、KDJ。
- 实时计算日累计逐单资金流。
- 过去 5 分钟主动成交量占比。
- 账户持仓损益实时监控。

如果用户明确要求复现官方示例，可以按官方文档生成；否则必须基于用户的新业务需求重新设计字段、流图和 mock 数据。

---
