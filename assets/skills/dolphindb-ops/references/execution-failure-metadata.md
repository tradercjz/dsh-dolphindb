---
kind: category
---

# 分区/元数据/存储引擎错误案例

> 触发: 报错涉及分区、元数据、chunk、replica、事务目录、存储引擎

## 规则

### The database has been dropped
条件: 报错 `The database [dfs://xxxx] has been dropped.`
根因: 库被显式删除，或 Controller 元数据异常丢失了该库的 domain 记录
处置: 检查底层物理文件是否存在；用 `getClusterChunksStatus` 与 `getAllChunks` 对比 Controller/DataNode 元数据；若 Controller 丢失记录则停机打包 raft/meta 交研发合并恢复

### dropDatabase 报 no replica available
条件: 报错 `Can't drop partition Tablet[...] because no replica is available.`
根因: 写入中节点宕机/异常关机导致元数据不一致，常规 `dropDatabase` 无法执行
处置: 用 `imtUpdateChunkVersionOnDataNode` 对齐异常 chunk 版本；通过 `deleteReplicas` + `deleteChunkMetaOnMaster` 强制删除副本与控制节点元信息

### loadTable 路径不存在
条件: 报错 `.tbl path does not exist` 或 `domain path does not exist`
根因: 表名拼写错误；Controller 元信息未同步（HA 切主后新主缺失记录）；物理文件丢失
处置: 核对库表名；`getAllChunks` / `getClusterChunksStatus` 定位缺失层级；HA 切主引起则重启触发切回

### Failed to load column — 行数不一致
条件: 报错 `Failed to load column [xxx.col]. Expected xxx rows, but actually loaded xxx rows.`
根因: 同 DataNode 同分区事务发生交集，破坏 `TabletChunk` 状态（早期版本）
处置: 对比 Controller/DataNode 元数据版本 + 实际列行数 + 日志 cid/tid；升级到修复版本（≥1.30.21.3 / ≥2.00.9.3）

### 修改 volumes 后副本不可用
条件: 报错 `No available replica for the chunk`
根因: 缩减 `volumes` 路径时，被移除磁盘包含关键元数据
处置: 停机恢复旧 volume → `moveChunksAcrossVolume` 迁移 → 元数据独立到 `chunkMetaDir` → 重启

### 数据平衡缺粒度信息
条件: 报错 `[rebalanceChunksWithinDataNode] failed to find DB <dbName> in DB Granularity info`
根因: 表级分区场景下分区错位/元数据异常
处置: 确认库级/表级分区；表级分区执行 `restoreDislocatedTablet` 使同分区表回到同一节点

### TabletCache 行数不一致
条件: 报错 `[TabletCache::loadColum] available rows is less than the desired rows`
根因: 并发写入事务进行中执行查询，分区可读行数与元数据暂时不一致
处置: 等待写入事务完成后重试；若事务长时间未完成则转入阻塞排查

### mvccTable .iotransaction 损坏
条件: 报错 `The database didn't close normally or another transaction is in progress.`
根因: 创建 `mvccTable` 时 `.iotransaction` 文件损坏
处置: 备份后删除损坏的 `.iotransaction` 文件 → 重新执行；仍失败执行 `rollbackDatabase`

### TSDB 存储引擎未启用
条件: 报错 `The storage engine [TSDB] wasn't enabled`
根因: 在控制节点执行 TSDB 操作；或未配置 `TSDBCacheEngineSize` + `dataSync=1`
处置: 改为在数据节点执行；补充配置后重启


## 验证
- 重新执行报错操作确认成功
- 确认分区状态恢复正常
- 检查运行日志无新 ERROR
