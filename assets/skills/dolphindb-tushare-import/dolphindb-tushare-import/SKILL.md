---
name: dolphindb-tushare-import
description: 将 Tushare Pro API 数据导入 DolphinDB，支持 stock/index/fund/bond/futures/options/etf/spot/fx/llm 多数据域导入。
---

# Tushare 数据导入 - DolphinX 版

将 Tushare Pro API 数据自动导入 DolphinDB 分布式数据库。本 skill 在 DolphinDB Web 平台中运行，全程使用 `.dos` 脚本。

## 执行要求
1. 加载本文件后，立即从步骤 1 开始执行，且必须按照指定流程执行。
2. 除非缺少必要参数或用户需要确认导入范围，不要额外中断流程。
3. 如果按流程执行报错，直接返回即可，不要做额外尝试。
4. 所有需要在服务端执行的内容均通过 DolphinDB Web 平台完成。

## 执行步骤

### 1. 收集导入参数

向用户确认或收集以下参数：

| 参数 | 是否必填 | 说明 |
| --- | --- | --- |
| `token` | 是 | Tushare Pro API token |
| `dataDomains` | 是 | 一个或多个数据域，例如 `["stock", "index"]` |
| `startDate` | 是 | 起始日期，转换为 DolphinDB `DATE`，例如 `2026.01.01` |
| `endDate` | 是 | 结束日期，转换为 DolphinDB `DATE`，例如 `2026.01.02` |
| `tableNamesByDomain` | 否 | 按数据域指定表名映射；空映射表示每个数据域导入全部表 |

若用户已在请求中提供所有必要参数，可直接使用，不要重复询问。若缺少必要参数，只询问缺失项。

### 2. 环境检查与模块准备

使用步骤 1 收集到的 `dataDomains` 调用 `dolphindb-tushare-check-env` skill，完成：

1. `httpClient` 插件检查和加载。
2. 只检查并上传本次导入需要的模块：`easy_tushare::ts_init`，以及每个数据域对应的 `*_init`、`*_create_table`、`*_load_data`、`*_schedulejob` 4 个模块。
3. `py` 插件检查；仅在用户需要依赖 `py` 插件的接口时必须安装。

判断逻辑：

- `dolphindb-tushare-check-env` 成功：继续步骤 3。
- `dolphindb-tushare-check-env` 失败：终止流程，并向用户展示 `dolphindb-tushare-check-env` 输出的错误信息。

### 3. 展示参数确认

执行前向用户展示：

```text
请确认以下 Tushare 导入参数：

- 数据域：{dataDomains}
- 日期范围：{startDate} ~ {endDate}
- 表名映射：{tableNamesByDomain 或 全部}

确认后将在 DolphinDB Web 平台执行导入脚本。
```

提供选项：

- 使用以上参数继续执行。
- 修改表名或日期范围。
- 取消。

### 4. 修改并执行导入脚本

根据确认参数修改：

```text
scripts/import_data.dos
```

需要改动的用户参数区：

```dos
token = "YOUR_TUSHARE_TOKEN"
dataDomains = ["stock"]
startDate = 2026.01.01
endDate = 2026.01.02
tableNamesByDomain = dict(STRING, ANY)
```

多数据域指定表名示例：

```dos
dataDomains = ["stock", "index"]
tableNamesByDomain = dict(STRING, ANY)
tableNamesByDomain["stock"] = ["stock_basic", "daily"]
tableNamesByDomain["index"] = ["index_basic", "index_daily"]
```

执行整个 `scripts/import_data.dos`。脚本会：

1. 加载 `easy_tushare::ts_init` 和所选数据域的 init 模块，不加载未选择资产域的模块。
2. 调用 `create_db()` 初始化默认数据库。
3. 根据每个数据域调用对应的 `*_init_tables` 初始化库表，并调用 `*_history_data_load` 导入历史数据。
4. 输出 `[TUSHARE-IMPORT] STATUS=SUBMITTED` 标记。

### 5. 进度查询

当用户追问任务进度时，在 DolphinDB Web 平台执行查询，并以业务可读方式总结，不要直接贴原始表格。

可用查询思路：假设 `table_names` 为根据本次用户参数得到的所有需要导入的表名字符串向量，执行：

```dos
jobs = getRecentJobs()
select * from jobs where split(jobDesc, "_")[1] in table_names order by startTime desc
```

根据用户参数进一步核验目标表，例如：

```dos
select count(*) from loadTable("dfs://tushare_basic_db", "stock_basic")
```

返回时按以下风格说明：

- 运行中：说明已启动的任务数量、完成数量、仍在运行的任务。
- 已完成：说明目标库表和行数。
- 报错：用通俗语言解释错误，并指出排查方向，例如 token 权限、API 频控、网络访问、表不存在或日期范围无数据。

### 6. 数据导入定时任务设置

当用户请求提交增量数据定时导入任务时，先判断当前上下文是否已经明确满足以下前置条件：

1. 用户已提供 `token`、`dataDomains` 和可选的 `tableNamesByDomain`。
2. 本次数据域和表名对应的库表已经初始化。
3. 如果用户需要历史数据，历史批量导入任务已经完成。

必须遵循以下分支处理：

- 如果当前上下文已经明确完成步骤 4 的历史导入脚本执行，并且步骤 5 或用户反馈已确认相关任务完成，可以继续提交增量定时任务。
- 如果当前上下文明确显示尚未初始化库表，或用户明确说“没有初始化库表 / 没有导入历史数据”，不要直接提交定时任务。先提示用户定时任务依赖目标库表，并建议先执行步骤 4 完成库表初始化和历史导入。
- 如果当前上下文无法判断库表是否初始化、历史导入是否完成、是否存在运行中的同范围历史导入任务，**不要做额外尝试**。不要主动执行 `import_data.dos`，不要主动执行库表初始化，不要主动查询表结构或任务状态，不要重新运行环境检查；只向用户做显式确认。

上下文不明确时，向用户展示以下确认文案，并等待用户回复后再继续：

```text
当前请求是提交 Tushare 增量数据定时任务。

我无法从当前上下文确认以下前置条件是否已经满足：
- 目标数据域和表名对应的库表已经初始化。
- 如需历史数据，历史批量导入任务已经完成。
- 当前没有同一批数据域和表名的历史导入任务仍在运行。

请确认是否继续提交增量定时任务：
1. 已确认库表已初始化，且历史导入已完成或不需要历史导入，继续提交定时任务。
2. 暂不提交定时任务，先执行历史导入流程完成库表初始化和历史数据导入。

说明：Tushare 数据接口有访问频次限制。如果历史批量导入任务和增量定时任务同时运行，可能导致接口限频、任务失败或部分表未更新；如果库表尚未初始化，定时任务可能因目标表不存在而失败。
```

用户回复后的处理规则：

- 用户选择继续提交：开始提交增量数据定时任务。
- 用户选择先执行历史导入：回到步骤 1 到步骤 4，先完成参数收集、环境检查、参数确认和历史导入脚本执行。
- 用户回复不明确：继续要求用户确认，不要执行任何脚本。

提交定时任务时，无需再次检查环境，直接使用步骤 3 已确认的任务参数；如果用户是直接请求设置定时任务且没有经过步骤 3，则仅收集 `token`、`dataDomains` 和可选的 `tableNamesByDomain`，不要收集历史导入日期范围。

```text
scripts/schedule_data.dos
```

需要改动的用户参数区：

```dos
token = "YOUR_TUSHARE_TOKEN"
dataDomains = ["stock"]
tableNamesByDomain = dict(STRING, ANY)
```

多数据域指定表名示例：

```dos
dataDomains = ["stock", "index"]
tableNamesByDomain = dict(STRING, ANY)
tableNamesByDomain["stock"] = ["stock_basic", "daily"]
tableNamesByDomain["index"] = ["index_basic", "index_daily"]
```

执行整个 `scripts/schedule_data.dos`。脚本会：

1. 根据 `dataDomains` 动态加载对应的 `easy_tushare::*_schedulejob` 模块。
2. 对每个数据域调用 `scheduleJob_*_data_daily(token, tableNames)`。
3. 输出 `[TUSHARE-SCHEDULE] STATUS=SCHEDULED` 标记。

各资产域已有模块中的定时任务时间由对应 `*_schedulejob.dos` 内部决定，例如多数资产域为每日 `20:00`，`stock` 为每日 `21:00`。若用户需要修改定时执行时间，需要先修改对应资产域的 `*_schedulejob.dos` 模块实现，再重新上传模块。

提交后可在 DolphinDB Web 平台中执行以下查询确认定时任务：

```dos
getScheduledJobs()
```

返回时按以下风格说明：

- 已提交：说明数据域、表名范围和定时任务名称。
- 已存在/重复：提示用户检查是否已有同名定时任务，避免重复提交。
- 报错：用通俗语言解释错误，并指出排查方向，例如模块未上传、token 未填写、表名不存在、权限不足或任务名冲突。

## 数据域和函数映射

| 数据域 | 初始化函数 | 历史导入函数 | 增量数据导入函数 |
| --- | --- | --- | --- |
| `stock` | `stock_init_tables` | `stock_history_data_load` | `scheduleJob_stock_data_daily` |
| `index` | `index_init_tables` | `index_history_data_load` | `scheduleJob_index_data_daily` |
| `fund` | `fund_init_tables` | `fund_history_data_load` | `scheduleJob_fund_data_daily` |
| `bond` | `bond_init_tables` | `bond_history_data_load` | `scheduleJob_bond_data_daily` |
| `futures` | `futures_init_tables` | `futures_history_data_load` | `scheduleJob_futures_data_daily` |
| `options` | `options_init_tables` | `options_history_data_load` | `scheduleJob_options_data_daily` |
| `etf` | `etf_init_tables` | `etf_history_data_load` | `scheduleJob_etf_data_daily` |
| `spot` | `spot_init_tables` | `spot_history_data_load` | `scheduleJob_spot_data_daily` |
| `fx` | `fx_init_tables` | `fx_history_data_load` | `scheduleJob_fx_data_daily` |
| `llm` | `llm_init_tables` | `llm_history_data_load` | `scheduleJob_llm_data_daily` |

## 注意事项

- 必须在 DolphinDB Web 平台中以已登录用户身份执行。
- `token` 不要写入公开仓库或提交到版本控制。
- Tushare API 的接口权限、积分和频控由 Tushare 账号决定。
- `tableNamesByDomain={}` 会导入所选数据域下所有已实现表。
- 日期使用 DolphinDB `DATE` 字面量，不是字符串，例如 `2026.01.01`。
