# Orca Skill 工作流程、输入信息与输出模板

本文件由原 `SKILL.md` 中的细则拆分而来，供 coding agent 在需要相关细节时按路径读取。

适用场景：需要确认生成流程、输入信息、脚本骨架、输出模板或最终自检时读取本文件。

## 0. 运行环境约束

- 本 skill 运行在只能读取 skill 包内资料、查询文档、执行 DolphinDB 脚本的受限环境中。
- 不要假设可以执行 Python、shell、Node.js、npm、pip 等本地命令。
- 不要假设可以读取或写入本机任意路径。若用户只提供外部文件路径，需要用户粘贴文件内容，或说明需要平台提供文件读取能力。
- 不要依赖本地日志文件、临时文件或外部系统写入能力。
- 只生成 DolphinDB / Orca 相关脚本、说明和检查清单。
- 不要生成与 DolphinDB 无关的基础设施脚本。
- 若需要引用 DolphinDB 版本特性，必须说明“需用户确认当前环境版本支持该 API”。

---

## 1. 能力范围

### 1.1 你能做的

- 根据用户业务需求生成完整 Orca DStream API `.dos` 脚本。
- 生成包含 source、map、fork、buffer、sink、submit、mock 数据、appendOrcaStreamTable、查询结果的完整示例。
- 生成或修复以下类型流图：
  - 单输入流过滤 / 派生字段 / 窗口聚合。
  - timeSeriesEngine 时间窗口聚合。
  - reactiveStateEngine 响应式状态计算。
  - lookupJoinEngine / asofJoinEngine / equalJoinEngine / windowJoinEngine / snapshotJoinEngine 等流式关联。
  - crossSectionalEngine 横截面计算。
  - sessionWindowEngine 会话窗口。
  - ruleEngine 规则告警。
  - timerEngine 定时触发任务。
  - fork 分叉多分支流图。
  - keyedBuffer / latestKeyedBuffer / keyedSink / latestKeySink 等 keyed 输出场景。
- 审查用户已有 Orca DStream API 脚本，指出：
  - API 是否不存在或写错。
  - source schema 和 mock 数据是否一致。
  - metrics 是否引用了不存在字段。
  - timeColumn / keyColumn 是否存在且类型合适。
  - 窗口数据是否能触发输出。
  - 是否存在旧流图 / 旧流表残留风险。
  - 是否错误使用普通 SQL 替代 DStream。
- 修复 coding agent 生成 Orca 代码时的常见错误。
- 为用户总结 Orca DStream API 脚本开发经验、规则和模板。

### 1.2 你不做的

- 不生成非 DolphinDB 代码。
- 不用普通 SQL 批处理逻辑冒充 Orca 流图。
- 不在没有文档依据时编造 Orca 函数、参数名或配置项。
- 不默认删除生产流图、生产流表、生产数据库。
- 不默认连接真实外部系统、Webhook 或生产数据源。
- 不照搬官方示例中的业务场景作为用户的新示例。
- 不输出“仅供参考伪代码”作为最终代码，除非用户明确要求伪代码。

---

## 2. 参考资料优先级

生成 Orca 代码时，按以下顺序确认依据：

1. 用户提供的明确代码、报错、业务字段和目标输出。
2. 当前 skill 包内 references 中的 Orca 官方文档。
3. 当前 skill 包内 examples 中经过验证的 `.dos` 脚本。
4. 用户上传的 coding agent 问题汇总。
5. 官方文档中的示例结构和 API 调用方式。

不要从训练记忆中猜测不存在的 API。对于未能在 references 或 examples 中确认的函数、参数、配置项，必须标注：

```text
⚠️ 当前资料中未确认该 API / 参数，请先在目标 DolphinDB 版本中验证。
```

---

## 3. 输入信息要求

生成完整 Orca DStream API 脚本前，尽量确认以下信息。

### 3.1 必要信息

- 业务目标：要实时计算什么。
- 输入流表字段：
  - 字段名。
  - 字段类型。
  - 时间列。
  - 分组列。
- 输出结果：
  - 输出表名。
  - 输出字段。
  - 是否只输出异常，还是全量输出。
- 需要使用的引擎或计算模式：
  - 普通过滤。
  - timeSeriesEngine。
  - reactiveStateEngine。
  - joinEngine。
  - crossSectionalEngine。
  - sessionWindowEngine。
  - ruleEngine。
  - timerEngine。
  - fork 多分支。
- 是否要求完整 mock 数据。
- 是否要求脚本可重复运行。

### 3.2 信息不足时的处理

若信息不足，但可以合理补全一个教学 / demo 场景，则直接给出脚本，并在脚本前说明采用的假设。

若缺失信息会导致代码无法唯一确定，先追问。常见必须追问项：

- 多输入流 join 时，没有指定关联键。
- 窗口聚合时，没有指定时间列。
- 状态计算时，没有指定分组键。
- 告警条件引用历史基准，但未说明基准来自哪里。
- 需要接入生产表，但没有说明是否允许创建 / 清理 / 写入。

---

## 4. 标准工作流程

### Step 1：识别用户意图

| 用户表达 | 行动 |
|---|---|
| “写一个 Orca DStream API 代码” | 生成完整 Orca 脚本 |
| “帮我修这个 Orca 报错” | 审查脚本和报错，给出修复版 |
| “帮我看看 coding agent 写得对不对” | 做代码审查和自检 |
| “给我几个例子” | 设计非官方重复场景，给出提示词或脚本 |
| “只讲概念” | 用中文解释，不强制生成代码 |
| “写普通 SQL” | 不触发 Orca 规则，按 SQL 需求处理 |
| 模糊需求 | 追问或给出可选方案 |

### Step 2：选择流图结构

根据业务需求选择 DStream 结构：

| 需求 | 推荐结构 |
|---|---|
| 只过滤异常记录 | source -> map/filter -> sink |
| 派生字段后输出 | source -> map -> sink |
| 固定时间窗口统计 | source -> map -> timeSeriesEngine -> sink/buffer |
| 当前值依赖历史状态 | source -> reactiveStateEngine -> sink |
| 多输入流实时关联 | sourceA + sourceB -> joinEngine -> map -> sink |
| 维表映射 | 优先 lookupJoinEngine，不要在 map 中引用外部字典 |
| 全市场/板块排名 | timeSeriesEngine -> crossSectionalEngine -> sink |
| 会话切分 | source -> sessionWindowEngine -> sink |
| 连续 N 次条件触发 | reactiveStateEngine 或 ruleEngine |
| 定时输出快照 | source -> 状态维护 -> timerEngine -> sink |
| 一条流多个任务 | source -> fork -> 多个分支 |

### Step 3：生成完整脚本

默认完整脚本必须包含：

1. 说明注释。
2. 创建 / 切换 catalog。
3. 清理旧流图。
4. 创建 StreamGraph。
5. 定义所有 source schema。
6. 定义必要的 map / udf 函数。
7. 定义 DStream API 链式流图。
8. submit。
9. 等待或检查流图状态。
10. 构造 mock 数据。
11. appendOrcaStreamTable 写入数据。
12. sleep 等待计算。
13. 查询源表、中间表、结果表。
14. 可选清理说明。

### Step 4：验证脚本逻辑

输出前必须做自检：

- source schema 与 mock 数据列数、列顺序、类型是否一致。
- mock 数据向量长度是否一致。
- 时间列是否覆盖窗口触发条件。
- 告警场景是否有数据能触发输出。
- metrics 中引用的字段是否存在于当前上游 schema。
- count 是否带参数。
- map 是否引用外部变量。
- join 是否有明确关联键。
- crossSectionalEngine 是否显式输出需要保留的分组列。
- reactiveStateEngine 是否使用支持的状态函数。
- 是否 submit。
- 是否 appendOrcaStreamTable。
- 查询路径是否使用 `<catalog>.orca_table.<tableName>` 或 `orca_table.<tableName>`。
- 是否避免照搬官方示例。

### Step 5：输出说明

输出代码后，简要说明：

- 这个脚本的流图结构。
- mock 数据如何触发结果。
- 需要注意的环境条件。
- 生产环境与调试环境的清理差异。

---

## 5. Orca 脚本标准骨架

生成完整脚本时，默认参考以下骨架。

```dolphindb
// ============================================================
// Orca DStream API Demo: <业务名称>
// 功能：
// 1. <功能1>
// 2. <功能2>
// ============================================================

// -------------------------
// 1. Catalog
// -------------------------
if (!existsCatalog("<catalogName>")) {
    createCatalog("<catalogName>")
}
go
use catalog <catalogName>

// -------------------------
// 2. Clean old graph for demo/test
// -------------------------
try {
    dropStreamGraph("<graphName>", true)
} catch(ex) {
}

// -------------------------
// 3. Define helper functions if needed
// -------------------------
def <funcName>(msg) {
    return select ... from msg
}

// -------------------------
// 4. Build stream graph
// -------------------------
g = createStreamGraph("<graphName>")

g.source("<sourceName>", `col1`col2`col3, [TYPE1, TYPE2, TYPE3])
    .map(<funcName>)
    .timeSeriesEngine(...)
    .sink("<resultTable>")

g.submit()

// -------------------------
// 5. Wait / check status
// -------------------------
sleep(3000)
getStreamGraphMeta("<graphName>")

// -------------------------
// 6. Mock data
// -------------------------
t = table(...)

// Optional: check vector size before table construction
// print(size(col1), size(col2), size(col3))

appendOrcaStreamTable("<sourceName>", t)

// -------------------------
// 7. Wait and query
// -------------------------
sleep(3000)

select * from <catalogName>.orca_table.<sourceName>
select * from <catalogName>.orca_table.<resultTable>
```

注意：

- `dropStreamGraph("<graphName>", true)` 用于测试脚本中彻底清理旧流图及其关联流表。
- 生产环境不应默认删除上游真实流表。
- 不要使用不存在的 `existsStreamGraph`。
- `catch` 中必须声明异常变量，例如 `catch(ex) {}`。

---

## 20. 输出模板

### 20.1 生成完整脚本时

```markdown
下面给出一个完整可运行的 Orca DStream API 示例脚本。

### 流图结构

```text
<source>
  -> <engine/map>
  -> <sink/result>
```

### 完整脚本

```dolphindb
<完整脚本>
```

### 说明

- 输入流表：
- 输出结果表：
- mock 数据触发逻辑：
- 重复运行清理逻辑：
- 生产环境注意：
```

### 20.2 修复用户脚本时

```markdown
### 问题定位

1. <问题>
2. <原因>
3. <影响>

### 修复原则

<说明修复方式>

### 修复后的完整脚本

```dolphindb
<完整脚本>
```

### 关键修改点

- 修改 1：
- 修改 2：
- 修改 3：
```

### 20.3 只生成提示词时

```markdown
你可以把下面提示词发给 coding agent：

```text
<完整提示词>
```
```

---

## 21. 生成前自检清单

每次输出 Orca DStream API 完整脚本前，逐项检查：

1. ☐ 是否使用 `createStreamGraph` 创建流图？
2. ☐ 是否使用 DStream API 链式写法，而不是普通 SQL 替代？
3. ☐ 是否包含 `submit()`？
4. ☐ 是否包含 source schema？
5. ☐ source schema 与 mock 数据列数是否一致？
6. ☐ source schema 与 mock 数据类型是否一致？
7. ☐ mock 数据所有向量长度是否一致？
8. ☐ 是否清理旧流图，避免重复运行污染？
9. ☐ 清理逻辑是否使用 `try { dropStreamGraph(name, true) } catch(ex) {}`？
10. ☐ 是否避免使用不存在的 `existsStreamGraph`？
11. ☐ 是否避免 `function(t){}`？
12. ☐ map 是否未引用外部字典或外部变量？
13. ☐ timeColumn 是否存在且是时间类型？
14. ☐ keyColumn 是否存在？
15. ☐ metrics 中所有字段是否来自当前上游 schema？
16. ☐ `count` 是否带参数？
17. ☐ 时间窗口 mock 数据是否跨越窗口边界？
18. ☐ 告警类数据是否一定能触发输出？
19. ☐ join 类代码是否明确左右流、关联键和输出字段？
20. ☐ 如果是成交关联最近盘口快照，是否使用 as-of 语义引擎而不是误用 lookup？
21. ☐ 比值 / 占比类指标是否在聚合后计算？
22. ☐ 如果需要末尾窗口输出，是否正确考虑 forceTriggerTime 或补充触发数据？
23. ☐ 是否避免行首点号续行导致 `. is not a unary operator`？
24. ☐ crossSectionalEngine 是否显式输出需要保留的分组字段？
25. ☐ reactiveStateEngine 是否没有使用未确认支持的序列敏感函数？
26. ☐ 查询路径是否正确？
27. ☐ 是否查询了结果表？
28. ☐ 是否说明生产环境不要随意清理上游流表？
29. ☐ 是否避免照搬官方示例？

若任一项为“否”，不得声称脚本是完整可运行版本。

---

## 22. 内容地图

### references/

建议包含：

| 文件 | 内容 |
|---|---|
| `references/orca/orca.md` | Orca 实时计算平台主文档 |
| `references/orca/orca_finance.md` | Orca 金融案例：日累计逐单资金流 |
| `references/orca/orca_finance_position.md` | Orca 金融案例：账户持仓损益实时监控 |
| `references/orca/coding_agent_orca_issues.md` | coding agent 写 Orca 代码问题汇总 |

### examples/

建议包含：

| 文件 | 内容 |
|---|---|
| `examples/trade_anomaly_monitor.dos` | map + timeSeriesEngine + 异常窗口输出 |
| `examples/net_buy_amount_monitor.dos` | 条件聚合 + 窗口告警 |
| `examples/price_deviation_ma5_alert.dos` | reactiveStateEngine + 状态告警 |
| `examples/order_trade_slippage_monitor.dos` | 多输入流 join + 滑点统计 |
| `examples/trade_aggressiveness_monitor.dos` | asofJoinEngine + 盘口快照关联 + 聚合后占比计算 |
| `examples/industry_amount_rank.dos` | lookupJoinEngine + crossSectionalEngine |
| `examples/abnormal_spread_alert.dos` | 连续状态异常告警 |
| `examples/market_overview_timer.dos` | 状态维护 + timerEngine |

---

## 23. 结果说明

每次输出最终结果时，应说明：

- 是否生成了完整 Orca DStream API 脚本。
- 是否包含 mock 数据。
- 是否包含结果查询。
- 是否包含重复运行清理逻辑。
- 是否有未确认 API 或需用户根据版本验证的地方。
- 是否使用了官方文档作为 API 依据。
- 是否仅参考官方结构而没有照搬官方业务示例。

---

## 24. 外部系统操作

当前运行环境不支持创建外部系统页面，也不支持执行本地脚本上传内容。

如果用户要求生成文件，只输出可复制的 Markdown 或 DolphinDB 脚本内容；只有平台明确提供文件写入能力时，才可以按用户指定位置生成文件。

---
