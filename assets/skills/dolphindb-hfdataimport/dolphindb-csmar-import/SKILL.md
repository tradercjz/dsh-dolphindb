---
name: dolphindb-csmar-import
description: 将CSMAR历史数据文件自动导入DolphinDB数据库，支持csv及zip格式的数据文件
---

# CSMAR 历史数据导入 — DolphinX 版

将 CSMAR（国泰安）高频历史行情数据文件自动导入 DolphinDB 分布式数据库。本 skill 运行于 **DolphinDB Web 平台**，全部操作通过 `.dos` 脚本在服务端完成。

## 执行要求

加载本文件后，**立即从步骤 1 开始执行，不要额外确认**。每个步骤的结果直接驱动下一步。所有需要在服务器执行的内容都通过 dos 脚本完成，无需收集连接信息（Web 平台已登录）。

## 执行步骤

### 1. 环境检查与前置准备

先调用 `check-env` 技能完成以下工作：

1. **zip 插件检查**：检查 DolphinDB 是否已加载 zip 插件，未加载则自动安装并加载
2. **easy_csmar 模块上传**：将 `scripts/DolphinDBModules/easy_csmar/` 下的模块源文件通过 `uploadModule()` 写入 DolphinDB 服务端

**判断逻辑：**
- **check-env 执行成功**：继续下一步
- **check-env 执行失败**：终止流程，向用户展示 check-env 输出的错误信息

### 2. 收集机器信息并推荐并行度

在 DolphinDB Web 平台执行：`scripts/machine_info_collection.dos`

脚本行为：
- 读取 `maxMemSize` / `license()['maxMemoryPerNode']` / `maxBatchJobWorker` / `license()['maxCoresPerNode']`
- 按以下逻辑计算推荐并行度：
  - 内存约束：`min(maxMemSize, maxMemoryPerNode) / 2 / 8`（安全内存的一半，按 8GB/任务）
  - 并发约束：`min(maxBatchJobWorker, maxCoresPerNode)`
  - 最终推荐：取两者较小值（最小为 1）
- 输出形如 `RECOMMENDED_PARALLEL=<数值>` 的标识行

**从执行结果中匹配 `RECOMMENDED_PARALLEL=` 行提取数值**，作为下一步的推荐并行度。

### 3. 收集数据导入参数

向用户询问以下信息：

- **文件路径**：CSV 或 ZIP 文件存储的绝对路径（示例：`/hdd/hdd4/csmar/`）
- **数据类型**：`snapshot`（快照）/ `entrust`（委托）/ `trade`（成交）/ `tick`（TICK合并）/ `orderqueue`（委托队列）
- **起始日期**：格式 YYYYMMDD（示例：`20260429`）
- **结束日期**：格式 YYYYMMDD（示例：`20260429`）
- **数据库名称**：DolphinDB 数据库路径（默认值：`dfs://level2_stock_db`）

> 表名固定为 `snapshot`、`entrust`、`trade`、`tick`、`orderqueue`，无需用户填写。

### 4. 确认参数

向用户展示汇总信息并确认：

```
请确认以下导入参数：

推荐并行度：
- 推荐值：{recommended_parallel}
  （基于服务器内存和并发能力计算）
- 如需修改，请选择"自定义并行度"

数据导入参数：
- 数据类型：{dataSource}
- 日期范围：{startDate} ~ {endDate}
- 文件路径：{targetDir}
- 数据库名称：{dbName}

确认无误后将提交任务到 DolphinDB 后台运行。
```

提供以下选项：
- **使用推荐并行度**：继续执行步骤 5
- **自定义并行度**：用户输入自定义值后继续执行步骤 5
- **重新填写参数**：回到步骤 3 重新收集数据导入参数
- **取消**：终止流程

### 5. 修改并执行批量导入脚本

根据用户确认的参数，修改 `scripts/import_data.dos`：

- 第 4 行 `file_dir = ` 改为用户输入的文件路径
- 第 5 行 `db_name = ` 改为用户确认的数据库名称
- 第 6 行 `start_date = ` 改为用户输入的起始日期
- 第 7 行 `end_date = ` 改为用户输入的结束日期
- 第 8 行 `parallel = ` 改为用户确认的并行度值
- 第 10 行 `data_types = ` 改为用户选择的数据类型（单个类型如 `"snapshot"`，或多个类型如 `["snapshot","trade"]`）

修改完成后，在 DolphinDB Web 平台执行整个 `scripts/import_data.dos`。脚本会自动调用 `auto_load_csmar_stock_data`（内部通过 `submitJob` 提交导入任务到后台），并从输出中匹配 `JOBID=` 行提取 jobid。

执行成功后，向用户展示任务提交确认和完整的任务信息：

```
任务已提交到 DolphinDB 后台运行！

服务器：{Web 平台地址 + 可通过执行 print(version()) 获取的版本信息}
数据类型：{dataSource}
日期范围：{startDate} ~ {endDate}
文件路径：{targetDir}
并行度：{parallel}
数据库名称：{dbName}
```

**任务进度查询（用户追问时执行）：**

如果用户看到提交成功信息后追问任务进度，在 DolphinDB Web 平台执行以下 dos 脚本查询（把其中的 UUID、库名、表名、日期替换为实际值，AI 根据用户确认的参数灵活调整）：

```
//任务进度查询
tb = loadTable("dfs://job_info", "job_info")

select 
    count(*) as total_tasks,
    sum(iif(job_status=="completed", 1, 0)) as completed_tasks,
    sum(iif(job_status=="failed", 1, 0)) as failed_tasks,
    sum(iif(job_status=="progress", 1, 0)) as running_tasks,
    sum(iif(job_status=="waiting", 1, 0)) as waiting_tasks,
    string(sum(iif(job_status=="completed", 1, 0)) \ count(*) * 100) + "%" as progress_pct
from tb

// 数据落地验证（最终兜底）
snapCnt = exec count(*) from loadTable("dfs://level2_stock_db", "snapshot") where trade_date = 2023.02.01
tradeCnt = exec count(*) from loadTable("dfs://level2_stock_db", "trade") where trade_date = 2023.02.01
entrustCnt = exec count(*) from loadTable("dfs://level2_stock_db", "entrust") where trade_date = 2023.02.01
tickCnt = exec count(*) from loadTable("dfs://level2_stock_db", "tick") where trade_date = 2023.02.01
orderQueueCnt = exec count(*) from loadTable("dfs://level2_stock_db", "orderqueue") where trade_date = 2023.02.01
```

以便于业务老师阅读的方式返回结果，不要直接展示代码原始输出：
- **运行中**：说明进度，如"任务运行中，已处理 {finished}/{children 总数} 个数据日期"
- **已完成**：展示各表的数据落地情况，如"快照表 {snapCnt} 条、成交表 {tradeCnt} 条、委托表 {entrustCnt} 条、TICK合并表 {tickCnt} 条、委托队列表 {orderQueueCnt} 条"
- **报错**：展示错误信息，用通俗语言解释原因，指出需要检查的方向（如文件路径、数据格式、磁盘空间、权限等）
- **保持简洁**，避免输出过多技术细节

## 注意事项

- 本 skill 必须在 DolphinDB Web 平台中以已登录用户身份执行（依赖 Web 平台执行 dos 脚本的能力）
- 确保用户对 `targetDir` 指向的目录有读取权限，且 DolphinDB 服务进程能访问该路径
- 日期格式必须为 8 位数字：YYYYMMDD
- 数据类型必须是五个选项之一：snapshot、entrust、trade、tick、orderqueue，支持单个或多个类型（数组格式）
- 确保用户有足够的权限调用 `submitJob()`
