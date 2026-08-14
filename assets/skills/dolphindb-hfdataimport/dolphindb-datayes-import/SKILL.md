---
name: dolphindb-datayes-import
description: 将通联历史数据文件自动导入 DolphinDB 数据库（DolphinX 版，运行于 DolphinDB Web 平台，全 dos 流程）
---

# 通联历史数据导入 — DolphinX 版

将通联（DataYes）高频历史行情数据文件自动导入 DolphinDB 分布式数据库。本 skill 运行于 **DolphinDB Web 平台**，全部操作通过 `.dos` 脚本在服务端完成。支持 CSV 及 ZIP 格式的数据文件。

## 执行要求

加载本文件后，**立即从步骤 1 开始执行，不要额外确认**。每个步骤的结果直接驱动下一步。所有需要在服务器执行的内容都通过 dos 脚本完成，无需收集连接信息（Web 平台已登录）。

## 执行步骤

### 1. 环境检查与前置准备

**必须先调用 `check-env` 技能**完成以下工作：

1. **zip 插件检查**：检查 DolphinDB 是否已加载 zip 插件，未加载则自动安装并加载
2. **easy_datayes 模块上传**：将 `scripts/DolphinDBModules/easy_datayes/` 下的 22 个模块源文件通过 `uploadModule()` 写入 DolphinDB 服务端

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

使用 `AskUserQuestion` 向用户询问：

- **文件路径**：CSV 或 ZIP 文件存储的绝对路径（示例：`/hdd/hdd1/feb2023_csv`）
- **数据类型**：`tl_snapshot`（快照）/ `tl_trade`（成交）/ `tl_entrust`（委托）/ `tl_tick`（TICK合并）/ `tl_order_queue`（委托队列）
- **起始日期**：DATE 格式（示例：`2023.02.01`）
- **结束日期**：DATE 格式（示例：`2023.02.01`）
- **数据库名称**：DolphinDB 数据库路径（默认值：`dfs://TL_Level2`）
- **数据表名称**：各数据类型对应的表名，按 `数据类型=表名` 格式填写，多个用分号隔开（默认值：`tl_snapshot=snapshot;tl_trade=trade;tl_entrust=entrust;tl_tick=tick;tl_order_queue=order_queue`）

### 4. 确认参数

向用户展示汇总信息并使用 `AskUserQuestion` 确认：

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
- 数据表名称：{tableName}

确认无误后将提交任务到 DolphinDB 后台运行。
```

提供以下选项：
- **使用推荐并行度**：继续执行步骤 5
- **自定义并行度**：用户输入自定义值后继续执行步骤 5
- **重新填写参数**：回到步骤 3 重新收集数据导入参数
- **取消**：终止流程

### 5. 修改并执行批量导入脚本

根据用户确认的参数，修改 `scripts/import_data.dos`：

- 第 3 行 `fileDir = ` 改为用户输入的文件路径
- 第 4 行 `dataSource = ` 改为用户选择的数据类型（数组格式，如 `["tl_snapshot"]`）
- 第 5 行 `dbName = ` 改为用户确认的数据库名称
- 第 7 行 `startDate = ` 改为用户输入的起始日期（DATE 格式，如 `2023.02.01`）
- 第 8 行 `endDate = ` 改为用户输入的结束日期（DATE 格式，如 `2023.02.01`）
- 第 9 行 `parallel = ` 改为用户确认的并行度值

修改完成后，在 DolphinDB Web 平台执行整个 `scripts/import_data.dos`。脚本会直接调用 `autoLoadTongLianData` 提交导入任务到后台，并从输出中匹配 `JOBID=` 行提取 jobid。

执行成功后，向用户展示任务提交确认和完整的任务信息：

```
任务已提交到 DolphinDB 后台运行！

服务器：{Web 平台地址 + 可通过执行 print(version()) 获取的版本信息}
数据类型：{dataSource}
日期范围：{startDate} ~ {endDate}
文件路径：{targetDir}
并行度：{parallel}
数据库名称：{dbName}
数据表名称：{tableName}
```

**任务进度查询（用户追问时执行）：**

如果用户看到提交成功信息后追问任务进度，在 DolphinDB Web 平台执行以下 dos 脚本查询（把其中的库名、表名、日期替换为实际值，AI 根据用户确认的参数灵活调整）：

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
snapCnt = exec count(*) from loadTable("dfs://TL_Level2", "snapshot") where trade_date = 2023.02.01
tradeCnt = exec count(*) from loadTable("dfs://TL_Level2", "trade") where trade_date = 2023.02.01
entrustCnt = exec count(*) from loadTable("dfs://TL_Level2", "entrust") where trade_date = 2023.02.01
tickCnt = exec count(*) from loadTable("dfs://TL_Level2", "tick") where trade_date = 2023.02.01
orderQueueCnt = exec count(*) from loadTable("dfs://TL_Level2", "order_queue") where trade_date = 2023.02.01
```

以便于业务老师阅读的方式返回结果，不要直接展示代码原始输出：
- **运行中**：说明进度，如"任务运行中，已处理 {finished}/{children 总数} 个数据日期"
- **已完成**：展示各表的数据落地情况，如"快照表 {snapCnt} 条、成交表 {tradeCnt} 条、委托表 {entrustCnt} 条、TICK合并表 {tickCnt} 条、委托队列表 {orderQueueCnt} 条"
- **报错**：展示错误信息，用通俗语言解释原因，指出需要检查的方向（如文件路径、数据格式、磁盘空间、权限等）
- **保持简洁**，避免输出过多技术细节

## 注意事项

- 本 skill 必须在 DolphinDB Web 平台中以已登录用户身份执行（依赖 Web 平台执行 dos 脚本的能力）
- 确保用户对 `targetDir` 指向的目录有读取权限，且 DolphinDB 服务进程能访问该路径
- 日期格式为 DATE 类型（如 `2023.02.01`），与 dos 脚本中的 DolphinDB DATE 字面量格式一致
- 数据类型必须是五个选项中的一个或多个：tl_snapshot\tl_entrust\tl_trade\tl_tick\tl_order_queue
- 确保用户有足够的权限调用 `submitJob()`
