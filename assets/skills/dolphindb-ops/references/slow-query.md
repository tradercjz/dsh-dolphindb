---
kind: category
---

# 查询慢/执行慢排查

> 触发: 查询超时、执行时间异常长、写入慢、整体性能较差

## 规则

### 大查询全表扫描
条件: running_queries 中存在 elapsed > 5000ms 的查询
处置: 取消异常查询释放资源
根因: 添加分区列过滤条件；使用执行计划分析工具查看执行计划分析慢查询原因

### 资源竞争
条件: cluster_perf 显示 CPU/内存接近上限 + 多个大查询并发
处置: 取消次要查询释放资源

### 大表 Join
条件: 慢查询中包含 join 操作
处置: 建议改用 equi join；确保分区列对齐

### 分组基数过高
条件: 慢查询中 group by 字段基数百万级
处置: 预聚合降维或缩小查询范围

### 自定义函数慢
条件: 慢查询中使用了自定义循环函数
处置: 使用内置向量化函数替代（如滑动平均、滑动求和等）

### 内存压力
条件: session_memory_stat 中某会话占用过高 + 查询变慢
处置: 参考 `oom` 排查内存根因

### 分区设计不合理
条件: 查询执行时间与数据量不成比例（少量数据却很慢）
处置: 使用执行计划分析工具查看扫描的分区数
根因: 分区粒度过粗导致单分区数据量过大；查询未带分区列过滤条件导致全分区扫描；VALUE 分区出现数据倾斜

### 作业优先级过低
条件: 查询长时间排队等待，但系统资源未打满
处置:
1. 查看当前作业优先级
2. 提高用户的最高作业优先级
3. 对于批处理作业，提交时指定更高优先级
根因: 作业优先级低于其他并发作业；高优先级作业占用资源

### 作业并行度不足
条件: 作业有大量子任务但只有少量线程在执行
处置:
1. 查看批处理作业的并行度设置
2. 提交批处理作业时提高并行度（如设为 CPU 核数）
3. 注意并行度只是时间片单位，实际线程数由系统动态分配
根因: 批处理作业默认并行度为 2，对于子任务多的作业可能不足

### Worker 线程数不足
条件: 线程诊断显示 Worker 线程数量偏少，且查询大量排队
处置:
1. 查看 ZeroWorker、FirstWorker 数量和状态分布
2. 检查 workerNum 配置（默认为 CPU 核数）
3. 如果 CPU 未打满但查询慢，考虑适当增加 workerNum
4. 修改配置后重启节点
根因: workerNum 配置过小，无法充分利用 CPU 资源

### 动态线程耗尽
条件: 线程诊断显示 DynamicWorker 数量达到上限，且查询仍在排队
处置:
1. 查看 DynamicWorker 数量
2. 检查 maxDynamicWorker 配置（默认等于 workerNum）
3. 适当增加 maxDynamicWorker（如设为 workerNum 的 2 倍）
4. 修改配置后重启节点
根因: 并发任务过多，动态线程数量不足

### RemoteExecutor 不足
条件: 分布式查询慢，线程诊断显示 RemoteExecutor 数量偏少
处置:
1. 查看 RemoteExecutor 数量
2. 检查 remoteExecutors 配置（默认为节点数和 workerNum 的较小值）
3. 适当增加 remoteExecutors（建议设为节点数）
4. 修改配置后重启节点
根因: 远程任务发送线程不足，分布式查询性能受限

## 验证
- 慢查询数量趋势是否收敛
- 是否还有长时间运行的异常查询
- CPU 利用率是否回到正常水位

## 排查方法论

### 系统化排查框架（四维度）
1. **配置情况**: diskIOConcurrencyLevel、workerNum、TSDBAsyncSortingWorkerNum、redoLogDir/TSDBRedoLogDir
2. **查询方式**: 使用执行计划分析工具查看执行计划；SQL TRACE 分析剪枝；避免单条循环写入
3. **库表设计**: 分区粒度、sortKey/sortColumns、热分区/热点键；SYMBOL 字段去重 count < 1M


## 已知案例

### KEEP_LAST 重复数据导致 count 查询慢
- **现象**: count 结果为 0 或很小但耗时极长
- **诊断**: 查询 TSDB 元数据，按 ChunkPath 聚合检查 levelFile 数量，若存在大量 levelFile 则确认
- **根因**: KEEP_LAST 场景历史重复数据未充分合并，levelFile 过多
- **处置**: 方案一：刷新 TSDB 缓存 → 触发 TSDB 压缩整理；方案二：备份 → 删除分区 → 重写（⚠️高风险）

### KEEP_LAST triggerTSDBCompaction 未生效
- **现象**: 单日单因子查询 40s+；TSDB 元数据显示多个 levelFile
- **处置**: 手动写入少量数据到 level0 → 刷新 TSDB 缓存 → 再触发 TSDB 压缩整理；或备份数据 → 删除分区 → 重新写入（⚠️高风险）

### LevelFileIndexCache 过小导致查询写入都慢
- **现象**: 查询和写入同时变慢；CPU/磁盘/网络都没打满；任务队列堵塞
- **诊断**: 查询 LevelFile 索引缓存状态，若 levelFileIndex 长期接近打满并反复清理，确认缓存不足
- **处置**: 增大 TSDBLevelFileIndexCacheSize（如从默认 5% 调至 10%），重启节点

### 启动慢 — 频繁 login 导致 raft 回放变慢
- **现象**: 控制节点启动后 `DFSRaftBecomeLeader successfully` 延迟 1.5 小时+
- **根因**: 启动阶段回放 raft，频繁 login 写入新 raft 日志，回放与新增叠加
- **处置**: 升级到修复版本（C++ ≥ 3.00.2.4 / Python ≥ 3.0.4.0 / Go ≥ 3.0.3 / Java ≥ 3.00.2.6）；或逐台启动等回放完成

### 常见慢查询根因对照表
| 根因类型       | 表现                    | 检查方式         |
| -------------- | ----------------------- | ---------------- |
| CPU 打满       | 多个 pivot by 并发      | top / dstat      |
| LevelFile 多   | 查询耗时随数据膨胀      | 查询 TSDB 元数据 |
| 剪枝失效       | 时间函数不走 Block 剪枝 | 执行计划分析工具 |
| 分区过多       | 单查询扫描万级分区      | 执行计划         |
| sortKey 不合理 | TSDB 索引未命中         | schema 检查      |
