---
name: dolphindb-report-factor-replication
description: Use when handling DolphinDB report factor analysis and replication tasks, including extracting candidate factors from research reports, extracting a single factor's logic and formula, auditing data-source fields, generating extraction JSON/scripts, choosing MR versus Execute mode, generating DolphinDB factor code, reusing built-in indicator modules, applying common factor replication patterns, and checking for look-ahead leakage or output-contract violations.
---

# DolphinDB 研报因子复现

## 使用目标

将研报因子复现任务统一处理为一条可审计流水线：因子发现、单因子逻辑抽取、字段审计与取数、MR/Execute 判定、DolphinDB 代码生成、内置指标复用和复现原则检查。

不要一次性加载所有参考文档。先判断用户请求处于哪个阶段，再读取对应 `references/` 文件。只有用户要求完整端到端复现时，才按流程逐步读取多个阶段文档。

## 阶段路由

| 用户意图 | 读取文件 | 产物 |
|----------|----------|------|
| 从整篇研报提取所有候选因子 | `references/01-all-factors-json-extraction.md` | `summary + factors` 纯 JSON |
| 抽取单个因子的定义、经济含义、变量解释和公式 | `references/02-report-factor-logic-extraction.md` | `function=pre-result` JSON |
| 把因子公式映射到真实数据源字段，判断字段是否足够，生成取数 SQL 或取数脚本 | `references/03-factor-data-extraction.md` and `references/data-extraction/` | fieldCheck JSON；`extractData(args, "string")` 生成的 `dataSql`；完整通道额外产出取数脚本 |
| 字段已给出或看似已确认，需要直接写单因子代码 | `references/03-factor-data-extraction.md` | 快速 fieldCheck JSON + `dataSql`；通过后进入 `05` 或 `06` |
| 判断因子走 MR 还是 Execute | `references/04-mr-execute-mode-selection.md` | `MREligible` 参数与最终模式 |
| 生成普通 Execute 因子脚本 | `references/05-execute-code-generation.md` | 四列 `result` 表脚本 |
| 生成 MR 因子脚本 | `references/06-mr-code-generation.md` | `mapFuncString`, `dbName`, `tbName`, `dataSql` 与完整脚本 |
| 复用内置技术指标、Alpha、盘口或逐笔函数 | `references/indicator-cookbook.md` | 模块加载与 `module::function` 调用 |
| 需要常见 DolphinDB 因子计算写法 | `references/replication-patterns.md` | 稳定代码片段与计算模式 |
| 检查未来数据泄露、字段幻觉、样本口径和输出结构 | `references/replication-principles.md` | 风险检查与修正建议 |

## 端到端流程

当用户要求“复现研报因子”“从研报生成 DolphinDB 因子代码”或类似端到端任务时，按以下顺序执行：

1. 读取 `01-all-factors-json-extraction.md`，从整篇研报提取候选因子，除非用户已经指定单个因子。
2. 读取 `02-report-factor-logic-extraction.md`，整理目标因子的经济含义、变量、窗口、公式和输出频率。
3. 读取 `03-factor-data-extraction.md`，只基于 `coldefs`、`testsql` 和样例数据做字段审计并生成 fieldCheck JSON。字段审计和 fieldCheck JSON 不可跳过；所有进入代码生成的场景都必须调用 `extractData(args, "string")` 生成 `dataSql`，快速通道只省略额外取数脚本。
4. 读取 `replication-principles.md`，检查字段、时间边界、样本口径和未来数据泄露风险。
5. 读取 `04-mr-execute-mode-selection.md`，准备并调用 `starfish::facplfRun::MREligible`。最终模式以该函数返回为准。
6. 根据模式读取 `05-execute-code-generation.md` 或 `06-mr-code-generation.md` 生成代码。
7. 生成代码时按需读取 `indicator-cookbook.md` 和 `replication-patterns.md`，优先复用内置函数和稳定向量化模式。

如果任一阶段缺少必要输入，先说明缺口；不要编造字段、数据源、函数签名或研报未给出的公式。

## 全局硬约束

1. 只使用研报原文、用户输入、`coldefs`、`testsql`、样例数据或已确认文档中出现的信息。
2. 不得凭常见字段名创造数据源字段。
3. 因子在 `tradeTime = t` 的值只能依赖 `t` 或之前可获得的数据。
4. 未来收益、评价标签、IC、IR、t-stat、分组收益等只能用于评价，不能进入因子值计算。
5. 时间序列计算前必须按证券和时间排序。
6. 横截面标准化、排名、中性化必须在同一时点内完成。
7. 生成 DolphinDB 因子结果时，最终输出列必须严格为 `tradeTime`, `securityId`, `factorname`, `value`。
8. 多返回值内置指标函数必须显式拆包。
9. MR 模式必须经过 `starfish::facplfRun::MREligible` 判定；经验规则只能用于准备参数，不能替代返回结果。
10. 字段不足时，明确输出缺失字段和原因，不生成虚假的可执行因子代码。
11. 即使字段看起来足够或用户已经给出字段映射，也必须读取 `03-factor-data-extraction.md`，并基于 `coldefs`、`testsql` 或样例数据生成 fieldCheck JSON 后再进入代码生成。
12. 最终因子计算逻辑必须封装为单一核心函数；字段入参和表入参模式使用 `def calcFactor(...) {}`，Panel 模式使用可被 `panel_call` 调用的 panel 因子函数。函数入参必须来自 fieldCheck JSON 的字段映射。
13. 05/06 不得重新手写取数 SQL；必须先在 03 中用 `extractData(args, "string")["result"]` 得到 `dataSql`，后续代码基于该字符串取数或构造 `sqlDS`。快速通道也要产出 `dataSql`，只是不用额外生成取数脚本。
14. 公式窗口、lag、rank 窗口、平滑周期、阈值等非字段参数必须从 fieldCheck 字段入参中分离，作为核心函数的普通参数，并提供默认值；默认值优先来自研报公式，若研报未给出则在注释中标明为待确认默认值。

## 代码生成策略

生成 DolphinDB 代码时：

1. 优先选择向量化写法，例如 `select`、`update`、`context by`、`group by`、滚动窗口函数。
2. 遇到 RSI、MACD、ATR、BOLL、Alpha101、Alpha191、盘口快照或逐笔成交类公式，先查 `indicator-cookbook.md`。
3. 遇到收益率、滚动窗口、横截面排名、中性化、缺失值处理、字段对齐或四列输出，先查 `replication-patterns.md`。
4. 代码必须定义并调用单一核心因子函数：字段入参和表入参使用 `calcFactor`，Panel 模式使用可被 `panel_call` 调用的 panel 因子函数。
5. 核心函数入参形态必须由因子计算依赖关系判断，不能由用户提示或测试用例名称直接决定。
6. 历史因子计算是主交付目标；流计算兼容性只作为函数边界设计参考，不替代 Execute/MR 历史脚本。
7. 单个计算层面使用 SQL 字段入参 `def calcFactor(field1, field2, ..., param=default)`：可对应普通逐行 `select`、保持原频的 `context by`，或降频聚合的 `group by`。
8. 同一层面同时包含时序计算与截面计算时使用 Panel 模式：因子函数形态为 `def FactorName(field1, field2, ..., window=20)`，字段参数语义是时间 x 证券矩阵，窗口等普通参数必须带默认值，由 `panel_call(rawdata, ...)` 负责长表转 panel、调用函数、再转回四列表。
9. 多个计算层面或多阶段中间结果使用 `def calcFactor(tb, param=default)`，例如先分钟聚合到日频、再做 20 日滚动，或需要多个不同粒度/分组阶段。
10. 非规则分组、行业中性化、复杂聚合、非规则对齐等如果无法表达为单层 SQL 字段入参，也使用 `def calcFactor(tb, param=default)`。
11. WorldQuant/Alpha 风格函数如果本身以 panel 矩阵为字段入参并返回 panel 矩阵，优先使用 `panel_call` 历史计算模板，不要直接改写成 `calcFactor(tb)`；`panel_call` 的 `rawdata` 必须来自 03 阶段 `dataSql = extractData(args, "string")["result"]` 执行后的 `rawData`。
12. 脚本需要中文注释，说明金融逻辑、窗口、排序、分组、空值处理和输出整理目的。
13. 禁止 `try-catch` 掩盖错误。

### calcFactor 入参判定规则

判断依据是计算层级，不是表数量、频率数量或用户提示名称。

- 使用 SQL 字段入参 `def calcFactor(field1, field2, ..., param=default)`：只涉及单个计算层面。包括逐行公式、单次 `context by` 保持原频的时序滑动/聚合、单次 `group by` 降频聚合。
- 使用 Panel 模式 `def FactorName(field1, field2, ..., param=default) + panel_call(rawdata, ...)`：同一层面内同时存在时序计算和截面计算，或直接复用 WorldQuant/Alpha 风格矩阵函数；输入和输出保持时间 x 证券矩阵。
- 使用表入参 `def calcFactor(tb, param=default)`：涉及两个及以上计算层面、多个不同粒度/分组阶段、必须复用中间表，或无法表达为单层 SQL 字段入参。
- 多数据源或跨频率 join 本身不构成表入参条件；如果 join 后仍是单层逐行、单层 `context by` 或单层 `group by`，仍使用 SQL 字段入参。
- 只涉及时序滑动/滚动/滞后，不构成 Panel 条件；优先使用 SQL 字段入参，并在最终 SQL 中使用 `context by securityId`。
- 只涉及一次降频聚合，不构成 TB 条件；优先使用 SQL 字段入参，并在最终 SQL 中使用 `group by` 生成降频结果。
- 时序计算结果再做同一时点截面 rank/标准化时，使用 Panel 模式。
- 先做一个粒度的聚合，再在另一个粒度做窗口/聚合时，使用 TB 入参。
- panel 模式的 `rawdata` 应为 `runSQL(dataSql)` 的结果。
- 公式中的窗口、lag、阈值、平滑周期等是函数普通参数，不是 fieldCheck 字段；必须写成带默认值的参数，例如 `def RollingFactor(close, window=20)` 或 `def calcFactor(close, preClose, threshold=0.02)`。
- 如果无法确认是否存在跨行依赖，先在交付中说明不确定项；不要为了简化而强行使用字段入参。

## 输出选择

根据当前阶段输出对应格式：

- 因子发现阶段：只返回可解析 JSON，不加代码块。
- 单因子逻辑阶段：返回 `function=pre-result` JSON。
- 字段审计阶段：所有可继续的场景都必须输出 fieldCheck JSON 和 `dataSql = extractData(args, "string")["result"]` 生成的取数 SQL；复杂取数场景可按需额外输出单文件取数脚本；字段不足时输出缺失原因。
- 模式判定阶段：输出 `MREligible` 参数、调用结果和选择理由。
- 代码生成阶段：输出完整 DolphinDB 脚本，并保证最终结果表结构符合四列契约。
- 审查阶段：优先列出违反未来数据、字段真实性、模式选择或输出结构的具体问题。

## 参考文件

- `references/01-all-factors-json-extraction.md`：全量候选因子 JSON 提取。
- `references/02-report-factor-logic-extraction.md`：单因子研报逻辑与公式抽取。
- `references/03-factor-data-extraction.md`：快速 fieldCheck JSON、字段审计和可选取数脚本生成。
- `references/data-extraction/`：数据抽取脚本资源，包括 `extractData.dos`、`example.dos` 和 `example.json`。
- `references/04-mr-execute-mode-selection.md`：Starfish MR/Execute 判定。
- `references/05-execute-code-generation.md`：Execute 因子脚本规范。
- `references/06-mr-code-generation.md`：MR 因子脚本规范。
- `references/indicator-cookbook.md`：内置指标、Alpha、高频、盘口和逐笔模块调用。
- `references/replication-patterns.md`：常见 DolphinDB 因子复现代码模式。
- `references/replication-principles.md`：防未来数据泄露与复现边界原则。
