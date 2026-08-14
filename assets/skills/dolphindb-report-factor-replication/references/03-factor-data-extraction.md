---
name: factor-data-extraction
description: Use when generating fieldCheck JSON for DolphinDB factor input fields or generating data inputs from one or more data sources. Handles field sufficiency checks, required field mapping, direct/derived/missing status, time range selection, multi-source join planning, fieldCheck JSON generation, and optional data extraction scripts.
---

# 因子数据源抽取

## 使用目标

当需要为某个因子准备计算输入数据时，使用本 Skill。产物只包含：

- fieldCheck JSON 加 `extractData(args, "string")` 生成的取数 SQL 字符串 `dataSql`；或
- fieldCheck JSON 加 `dataSql`，以及一个可执行 DolphinDB 数据抽取脚本，脚本执行后得到 `data`。

本 Skill 不生成因子计算函数，不计算因子值，不生成最终因子结果表。

调用方应提供或由 Agent 获取：

- 因子公式与描述，用于识别计算所需原子字段。
- 数据源列表，包括 `dbName`、`tbName`、字段定义 `coldefs`、频率。
- 样例数据或可用日期范围，用于确认字段口径和 `timeRange/sourceTimeRange`。

## 字段审计规则

根据因子公式和描述，提取计算所需字段，并对每个字段标记状态：

- `direct`：数据源中存在真实列，可直接映射。
- `derived`：目标字段不存在，但可由同一份抽取数据中的真实列可靠推导；抽取脚本仍只抽取真实列。
- `missing`：数据源不能直接提供，也不能可靠推导。

必须遵守：

- 只使用 `coldefs` 中真实存在的源字段。
- 口径不确定时标记为 `missing`。
- 必须包含结构字段：证券代码、输出时间、必要连接字段。
- 多数据源时必须说明主表、连接字段和连接方式。
- 对 `derived` 字段，说明推导所需真实字段，但不要在数据抽取脚本中写因子计算逻辑。

字段不足时，明确输出缺失字段和原因，不生成取数脚本，不调用 `extractData`。

## 字段确认模式选择

字段审计阶段不可跳过。即使字段看起来足够，或用户已经给出字段映射，也必须基于 `coldefs`、`testsql` 或样例数据完成字段真实性确认，并生成 fieldCheck JSON。所有字段足够且进入代码生成的场景，都必须调用 `extractData(args, "string")` 产出 `dataSql`；快速通道和完整通道的差异只在于是否额外生成可执行取数脚本。

### 快速 fieldCheck JSON 通道

适用于字段已经能直接对齐的简单场景：

- 只涉及 1 到 2 张表。
- 所需字段在 `coldefs`、`testsql` 或样例数据中直接存在。
- 不需要复杂多表 join。
- 不需要字段口径转换、跨频率聚合或时间范围交集规划。
- 不需要单独生成可执行取数脚本，只需要进入后续代码生成。

快速通道必须输出 fieldCheck JSON，并调用 `extractData(args, "string")` 生成 `dataSql`；快速通道不生成额外取数脚本，也不直接调用 `extractData(args, "data")`。fieldCheck JSON 结构仍参考 `references/data-extraction/example.json`，但 `joinPlan.steps` 可为空或只描述单表来源。

快速通道通过条件：

- 所有必要输入字段和结构字段均为 `direct` 或可可靠说明的 `derived`。
- 输出时间列、证券代码列和后续计算需要的分组字段已经确认。
- fieldCheck JSON 中已列出后续 `calcFactor` 或 panel 因子函数需要的所有 `requiredFields`。
- 已产出 `dataSql = extractData(args, "string")["result"]`，供 05/06 读取 `rawData` 或构造 `sqlDS`。
- 不存在口径不确定、字段缺失或需要补充数据源的项目。

通过后可以进入 `04-mr-execute-mode-selection.md`、`05-execute-code-generation.md` 或 `06-mr-code-generation.md`。如果任一必要字段为 `missing`，或字段口径不确定，不得进入代码生成。

### 完整取数通道

适用于需要形成可执行取数脚本的复杂场景：

- 涉及多表 join 或主表选择。
- 需要连接字段、连接粒度、时间范围交集或输出频率规划。
- 字段需要由真实列可靠推导。
- 需要生成 fieldCheck JSON 供平台执行。
- 需要通过 `extractData` 产出统一取数 SQL 或 `data` 表。

完整通道继续生成 fieldCheck JSON，并读取 `references/data-extraction/extractData.dos`。fieldCheck JSON 整理完成后，必须先调用 `extractData(args, "string")` 获取取数 SQL 字符串：

```dos
dataSql = extractData(args, "string")["result"]
```

后续 05/06 代码生成必须基于 `dataSql` 取数或构造 `sqlDS`，不得绕过 fieldCheck JSON 重新手写取数 SQL。只有需要实际预览或执行取数时，才进一步执行 `runSQL(dataSql)` 或调用 `extractData(args, "data")`。

## fieldCheck JSON

字段足够时，必须生成 fieldCheck JSON。结构参考 `references/data-extraction/example.json`，主体必须包含：

- `data`：数据源、字段映射、`requiredFields`、`joinFields`。
- `timeRange`：本次抽取时间范围。
- `joinPlan`：单源或多源连接计划。
- `output`：最终数据频率、时间列和分组字段。

`data[*].requiredFields[*]` 是后续 `calcFactor` 或 panel 因子函数字段入参的唯一字段映射依据：

- `name`：代码生成中使用的标准字段参数名或标准列名。
- `sourceColumns`：真实数据源列名，必须来自 `coldefs`、`testsql` 或样例数据。
- `status`：只能是 `direct`、`derived` 或 `missing`。
- `reason`：说明字段口径、用途或推导依据。

当任一必要字段为 `missing`，或 `derived` 字段无法可靠说明推导依据时，不得进入 `04`、`05` 或 `06`。

公式窗口、lag、平滑周期、阈值等不是数据源字段，不应放入 `requiredFields`。这些参数应在 02 阶段从公式中记录，并在 05/06 的核心函数签名中作为带默认值的普通参数，例如 `window=20`、`lag=1`、`threshold=0.02`。默认值优先来自研报；若研报未给出，必须在注释中说明是待确认默认值。

多数据源规则：

- `baseTb` 选择最终输出频率对应的主表；分钟因子优先选择分钟表。
- `joinFields` 用于统一连接字段，例如 `date(DateTime) as joinDate`。
- `joinPlan.steps` 描述连接顺序。
- 默认使用 `left` join,如有特殊需求才能使用其他连接方式。

时间范围规则：

- `timeRange` 必须落在所有相关数据源 `sourceTimeRange` 的交集内。
- 获取样例数据时，同时探测每张表的实际日期范围，并据此填写 `sourceTimeRange` 和 `timeRange`。
- 避免因时间范围超出数据源范围导致 0 行或取数失败。

## 数据抽取 SQL 与脚本

字段足够且需要进入代码生成时，必须先生成 `dataSql`。如用户需要可执行脚本，或场景选择完整取数通道，再生成一个 DolphinDB 脚本。脚本结构参考 `references/data-extraction/example.dos` 的 Part A-C：

```dos
// Part A: 取数函数 extractData
def extractData(args, returnType = "string") {
    ...
}

// Part B: fieldCheck JSON 参数
jsonStr = "..."
args = fromStdJson(jsonStr)

// Part C: 调用取数函数获取取数 SQL 字符串
dataSql = extractData(args, "string")["result"]

// Part D: 需要真实取数时再执行 SQL 得到原始计算数据
data = runSQL(dataSql)
```

脚本要求：

- `extractData` 函数内容来自 `references/data-extraction/extractData.dos`。
- 不修改 `references/data-extraction/extractData.dos` 的实现细节; `temporalParse` 写法如果报错可以进行调整。
- 使用 `fromStdJson(jsonStr)` 将 fieldCheck JSON 转为 `args`。
- 必须包含固定调用：

```dos
dataSql = extractData(args, "string")["result"]
```

- 如果需要生成 `data`，应基于 `dataSql` 执行 `data = runSQL(dataSql)`；也可以用 `extractData(args, "data")["result"]` 做执行校验，但交付给后续代码生成的取数依据仍是 `dataSql`。
- 脚本到生成 `dataSql` 或 `data` 为止；可以预览 `select top 10 * from data`，但不得包含因子计算函数或因子结果计算。
- 顶层注释使用 DolphinDB 单行注释 `//`，只说明模块作用。

## 平台适配约束

目标运行环境只支持读取 Skill 包内资料、查询文档，以及执行 DolphinDB 脚本。使用本 Skill 时遵守：

- 不运行 Python、shell、Node.js、npm、pip 或本地 runner。
- 不要求执行 `run.py`、`execute.py`、`test.sh`。
- 不依赖 `result.log`、临时日志或本机任意路径输出。
- 不读取或写入 `/home/...`、`/tmp/...`、`C:\...` 等本机绝对路径。
- 不生成硬编码账号、密码、token、服务器 IP、内部系统地址或默认登录信息。
- 如需输出结构参考，读取 `references/data-extraction/example.json`。
- 如需取数函数，读取 `references/data-extraction/extractData.dos`，并将函数内容合并进主脚本。
- 所有进入代码生成的通道都必须使用 `extractData(args, "string")` 生成取数 SQL 字符串，不要手写等价 SQL 替代。
- 当平台不支持 `run`、`include`、`readTextFile` 时，生成单文件脚本。
- 使用 `fromStdJson()`，不要使用 `parseJson()`。
- 使用 `isValid()`，不要使用 `isFinite()`。
