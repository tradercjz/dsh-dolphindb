---
kind: category
---

# OOM 内存溢出诊断

> 触发: DolphinDB 进程被 kill (exit 137/9)、"Out of memory"、"bad_alloc"、"ChunkCacheEngine is out of memory"、内存持续增长

## 规则

### 大共享表
条件: 内存统计显示 `__SharedTable__` 占用内存异常高
处置:
1. 查看共享变量内存占用，找到占用内存大的共享表名字
2. 释放不需要的共享表
3. 清理后确认内存是否回落
根因: 共享表数据量过大；创建了过多共享表未及时释放

### 大会话变量
条件: 内存统计显示某个非共享会话 memSize 异常高
处置:
1. 确认该会话是否有运行中的大查询
2. 如果会话空闲但占用内存高，关闭该会话
3. 清理后确认内存是否回落
根因: 会话中创建了大变量未及时释放；查询结果赋值给变量未释放

### 维度表内存占用过高
条件: 内存统计显示 `__DimensionalTable__` 占用内存异常高
处置:
1. 检查维度表大小和数据量
2. 2.00.11/1.30.23+ 版本会自动回收（通过 warningMemSize 触发）
3. 低版本需要手动释放或升级版本
根因: 维度表全量加载到内存；维度表数据量过大；旧版本无自动回收机制

### OLAP 缓存引擎内存不足
条件: 内存统计显示 `__OLAPCacheEngine__` 占用内存接近或超过配置上限
处置:
1. 查看 OLAP 缓存使用率
2. 刷新 OLAP 缓存到磁盘
3. 调整 chunkCacheEngineMemSize 配置（建议 maxMemSize 的 10%-30%）
根因: 缓存配置过小；大量分区数据加载到缓存；缓存未及时淘汰

### TSDB 缓存引擎内存不足
条件: 内存统计显示 `__TSDBCacheEngine__` 占用内存异常高
处置:
1. 查看 TSDB 缓存状态
2. 刷新 TSDB 缓存到磁盘
3. 调整 TSDBCacheEngineSize 配置
根因: TSDB 缓存配置不合理；写入压力大导致缓存积压

### LevelFileIndex 缓存饱和
条件: 缓存引擎状态显示 LevelFileIndex 缓存使用率接近 100%，或日志出现 `LevelFileIndexCacheInvalidPercent` 高占比
处置:
1. 使 LevelFile 索引缓存失效（临时）
2. 调大 TSDBLevelFileIndexCacheSize（建议翻倍，如从 5% 调至 10%）
3. 重启节点使配置生效
根因: 大时间窗口查询导致缓存置换频繁；LevelFile 数量过多；缓存配置过小

### 流数据队列内存占用过高
条件: 内存统计显示 `__StreamingPubQueue__` 或 `__StreamingSubQueue__` 占用内存异常高
处置:
1. 查看流订阅队列深度
2. 查看流引擎内存占用
3. 参考 `stream-delay` category 深入排查
根因: 流表 capacity 设置过大；订阅处理速度慢导致队列积压；发布速度过快


### 会话泄漏
条件: 内存统计显示大量 session lastActiveTime 远早于当前时间
处置:
1. 查看各会话内存占用和最后活跃时间
2. 逐个关闭泄漏会话（lastActiveTime 远早于当前）
3. 设置 sessionTimeout 参数自动清理空闲会话
根因: 客户端未正常关闭连接；会话超时未配置；会话中有大变量未释放

### 配置超限 - maxMemSize 超过 License
条件: 内存限制检查显示 config_exceeds_license 为 true
处置:
1. 调整 maxMemSize 不超过 License 限制
2. 如需更大内存，联系 DolphinDB 技术支持升级 License
3. 修改配置文件后重启节点
根因: 配置文件 maxMemSize 超过 License 限制

### 配置超限 - maxMemSize 超过物理内存
条件: 内存限制检查显示 config_exceeds_physical 为 true
处置:
1. 调整 maxMemSize 到物理内存的 80%-90%
2. 考虑 maxBatchJobWorker 并发参数对内存的影响
3. 修改配置文件后重启节点
根因: maxMemSize 配置过大，超过物理内存安全水位

### 单次查询内存超限
条件: 日志出现 `Out of memory` 且错误信息包含查询语句
处置:
1. 查看查询结果内存限制配置
2. 优化查询语句：添加分区过滤条件、只查询需要的列、避免 select *
3. 如确需更大查询结果，调整查询结果内存限制
根因: 查询结果集过大；未使用分区过滤；查询了不必要的列

### 大事务写入占用内存
条件: 写入任务执行时内存持续增长，日志出现 `ChunkCacheEngine is out of memory`
处置:
1. 避免一次性写入大量数据
2. 使用批量写入接口代替手动分批
3. API 端使用自动分批写入工具
4. 将大数据切分为多批次写入
根因: 大事务写入长时间占用内存无法释放；写入数据量超过缓存引擎容量

### 插件内存泄漏
条件: 日志出现 `[xx plugin], Out of memory`
处置:
1. 搜索插件相关错误日志
2. 如果是官方插件，联系 DolphinDB 技术支持
3. 如果是自定义插件，检查插件代码的内存管理，重新编译加载
根因: 插件设计不佳，内存管理不当；插件缓存大量外部数据到内存


## 验证
- 确认内存占用趋势回落
- 确认没有新的内存大户会话
- 确认缓存使用率正常
- 系统可用内存稳定在安全水位

## 缓存类型说明

| 缓存类型             | 含义                 | 影响因素                                                 | 释放方式                        | 自动回收     |
| -------------------- | -------------------- | -------------------------------------------------------- | ------------------------------- | ------------ |
| DimensionalTable     | 维度表缓存           | 维度表大小和数据量                                       | 无（2.00.11/1.30.23+ 自动回收） | 是（新版本） |
| SharedTable          | 共享表缓存           | 共享表大小和数据量                                       | 释放指定共享变量                | 否           |
| OLAPTablet           | OLAP 引擎表缓存      | OLAP 数据缓存大小（MB 级）                               | 清除所有数据缓存                | 是           |
| OLAPCacheEngine      | OLAP 缓存引擎        | chunkCacheEngineMemSize 配置                             | 刷新 OLAP 缓存到磁盘            | 是           |
| OLAPCachedSymbolBase | OLAP SYMBOL 字典编码 | SYMBOL 数据类型大小（MB 级）                             | 无需释放                        | 是           |
| DFSMetadata          | 分布式元数据         | 分布式库数量和大小（MB 级）                              | 无需释放                        | 是           |
| TSDBCacheEngine      | TSDB 缓存引擎        | TSDBCacheEngineSize 配置                                 | 刷新 TSDB 缓存到磁盘            | 是           |
| TSDBLevelFileIndex   | TSDB LevelFile 索引  | TSDBLevelFileIndexCacheSize 配置（默认 5% * maxMemSize） | 使 LevelFile 索引缓存失效       | 是           |
| TSDBCachedSymbolBase | TSDB SYMBOL 字典编码 | SYMBOL 数据类型大小（MB 级）                             | 无需释放                        | 是           |
| StreamingPubQueue    | 流数据发布队列       | maxPubQueueDepthPerSite 配置                             | 管理订阅和引擎                  | 是           |
| StreamingSubQueue    | 流数据订阅队列       | 流数据队列大小、引擎数量、订阅数据量                     | 管理订阅和引擎                  | 是           |

## 外部限制排查

### License 限制
- 查看 License 最大内存限制
- 对比 License 和配置
- 如需更大内存，联系 DolphinDB 技术支持

### 配置文件限制
- 查看 maxMemSize 配置
- 单节点模式修改 dolphindb.cfg，集群模式修改 cluster.cfg
- 建议设置为物理内存的 80%-90%
- 考虑 maxBatchJobWorker 并发参数的影响

### 查询结果限制
- 查看查询结果内存限制配置
- 调整查询结果内存限制
- 不应超过 maxMemSize

### 操作系统限制
- 查看 ulimit 限制
- 查看内核日志中的 OOM Killer 记录
- 查看系统内存和其他进程占用

## 规避建议

### 1. 优化服务器和数据库配置

**合理配置 maxMemSize**：
- 如果 License 限制 ≥ 服务器 80%-90% 内存，则 maxMemSize = 服务器内存 × 80%-90%
- 如果 License 限制 < 服务器 80%-90% 内存，则 maxMemSize = License 限制
- 考虑 maxBatchJobWorker 并发参数对内存的影响

**自定义插件内存管理**：
- 插件使用 C++ 编写，需要正确管理内存
- 避免内存泄漏，及时释放不需要的内存

### 2. 合理分区和正确使用 SQL

**合理均匀分区**：
- DolphinDB 以分区为单位加载数据，分区大小对内存影响巨大
- 每个分区压缩前的数据量在 100 MB 到 1 GB 之间为宜
- 参考官方文档《分区注意事项》

**数据查询使用分区过滤条件**：
- 不加分区过滤条件会扫描所有数据，数据量大时内存很快耗尽
- 将包含分区列的过滤条件前置

**只查询需要的列**：
- 谨慎使用 select *，会把该分区所有列加载到内存
- 明确写出所有查询的列，避免内存浪费

### 3. 合理配置流数据缓存区

**合理配置流表 capacity**：
- 流表 capacity 直接影响发布节点的内存占用
- capacity 设置为 1000 万条时，内存中会保留约 500 万条
- 根据发布节点的最大内存，合理设计流表 capacity
- 多张发布表时更需谨慎设计

### 4. 及时管理 session 变量

**及时释放大变量**：
- 大变量会在 session 中占用大量内存
- 查询结果赋值给变量也会占用内存
- 使用 undef 函数释放变量，或关闭 session

**配置 session 超时**：
- 设置 sessionTimeout 参数自动清理空闲会话
- 避免会话泄漏导致内存无法释放

### 5. 分批次写入数据

**避免大事务写入**：
- 批量写入大数据会长时间占用内存
- 使用批量写入接口代替手动分批
- API 端使用自动分批写入工具
- 注意：分批写入无法保证原子性

## 排查流程

### 1. 确认 OOM 类型
- 查看内核日志，确认是否被 OOM Killer 杀掉
- 查看日志中的错误信息（bad_alloc、Out of memory、Java heap space 等）

### 2. 检查外部限制
- 检查 License、配置、查询结果限制
- 检查操作系统 ulimit 限制
- 检查系统内存和其他进程占用

### 3. 检查内部组件
- 查看各组件内存占用
- 查看共享变量
- 查看缓存引擎状态
- 查看正在执行的查询
- 查看批处理作业

### 4. 检查外部组件
- 搜索插件相关错误
- 检查 GUI 客户端是否执行了大查询

### 5. 采取处置措施
- 根据诊断结果，清理内存
- 调整配置参数，重启节点
- 优化查询和写入方式

## 注意事项

1. **短时异常无需处理**：偶尔出现的 OOM 是正常的短时异常，无需特别处理
2. **持续 OOM 需排查**：多个连接上多次发生且持续数秒以上，需要诊断和解决
3. **配置需重启生效**：maxMemSize、缓存引擎大小等配置修改后需要重启节点
4. **分批写入无原子性**：使用分批写入接口无法保证一批大数据的原子性
5. **维度表自动回收**：2.00.11/1.30.23+ 版本支持维度表自动回收（通过 warningMemSize 触发）
6. **保存诊断信息**：如果确定是系统或插件问题，保存节点日志、操作系统日志和复现脚本，联系 DolphinDB 工程师
