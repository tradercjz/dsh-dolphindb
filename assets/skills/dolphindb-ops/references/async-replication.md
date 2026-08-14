---
kind: category
---

# 异步复制诊断

> 触发: 异步复制、主从同步、副本同步、slave/master replication、任务不消费、isTruncated

## 规则

### 从集群无法接收新任务
条件: 从集群复制状态长时间无新任务，主集群复制状态的 `isTruncated` 持续 false
根因: 主集群副本状态异常，导致从集群无法拉取新任务
处置: 按元数据修复流程修复主集群副本状态 → 验证 `isTruncated` 转为 true。不要只在从集群侧排查，必须修主集群

### 任务卡住 EXECUTING
条件: 从集群复制状态存在长期 EXECUTING 的任务
根因: 主从数据不一致（主有数据、从无对应数据），事务提交阶段异常
处置: grep 日志中对应 taskId，若重复出现 `task execute finished` 则确认为循环执行；记录 taskId 与日志证据后跳过卡住的复制任务；补做主从差异校验

### 从集群跳过任务（skip tasks after truncated）
条件: `controller.log` 频繁出现 `skip tasks [] after truncated`
处置: 优先查看主集群复制状态中的 taskId。若 taskId 从 1 开始（但集群已运行很久）→ controller 元数据丢失（raft/dfsMeta 被替换），用历史备份恢复。若 taskId 正常 → 查从集群日志 ERROR（如 No available replica），按元数据版本不一致修复


### 并发操作导致任务失败（dropTable + append）
条件: 从集群复制 append 任务报错"找不到库表"
根因: 主集群 DDL 与写入并发，任务顺序异常
处置: 跳过异常复制任务 → 重启复制。业务侧对 DDL 与写入做时序隔离

### 主集群 IP 迁移前收尾
条件: 计划变更主集群 IP 或做环境迁移
处置:
  1. 确保迁移期间无新写入
  2. 确认从集群复制状态全部 FINISH
  3. 禁用复制
  4. 强制汇报所有复制任务状态（≥2.00.15 版本支持）
  5. 确认主集群复制状态全部 `isTruncated=true`
  6. 触发 master checkpoint 持久化

### 主从一致性校验
条件: 需要校验主从集群分区是否一致
处置: 比对主从集群分区状态；输出 good（匹配）、absent（从集群缺失）、garbage（从集群多余）

### 副本修复
条件: 分区状态概览中 replicaCount < dfsReplicationFactor
处置: 确认异常分区 state 全部为 COMPLETE；遍历副本不足分区后从源节点复制副本到目标节点补齐；查看副本恢复进度

## 验证
- 复制状态无 EXECUTING/ERROR 任务
- 主集群 `isTruncated` 正常转化
- 从集群数据与主集群一致

## 已知案例

### 从集群无法接收新任务（副本状态异常）
- **现象**: 从集群复制状态长时间无新任务；主集群复制状态的 `isTruncated` 持续 false
- **根因**: 主集群副本状态异常，导致从集群无法拉取新任务。关键——问题在主集群而非从集群
- **处置**: 按元数据修复流程修复主集群副本状态 → 验证 `isTruncated` 转为 true → 确认从集群恢复接收新任务

### 任务卡住 EXECUTING（空分区操作导致循环执行）
- **现象**: 从集群复制状态显示任务长期 EXECUTING
- **诊断**: `grep <taskId> <nodeAlias>.log`，若重复出现 `task execute finished` 则为循环执行
- **根因**: 主从数据不一致，truncate/delete from/append 空分区时事务提交异常
- **处置**: 记录 taskId → 跳过卡住的复制任务 → 补做主从差异校验

### dropTable 与 append 并发导致任务失败
- **现象**: 从集群异步复制 append 任务报错"找不到库表"
- **根因**: 主集群 DDL 与写入并发执行，任务顺序异常
- **处置**: 跳过异常复制任务 → 重启复制
- **建议**: 业务侧对 DDL 与写入操作做时序隔离

### 从集群跳过任务（skip tasks after truncated）
- **现象**: `controller.log` 频繁出现 `skip tasks [] after truncated`
- **情况 A**: Controller 元数据丢失（raft/dfsMeta 曾被替换），taskId 从 1 重新开始 → 用历史备份恢复 raft/dfsMeta
- **情况 B**: Controller 与 DataNode 元数据版本不一致，伴随 `No available replica` → 按元数据版本不一致修复
- **注意**: 未确认主集群 taskId 状态前，不要直接在从集群侧做清理操作


### 主集群 IP 迁移前异步复制收尾
- **背景**: 主集群最后一个任务 `isTruncated=false` 是正常特性
- **流程**: 确保无新写入 → 确认从集群全部 FINISH → 禁用复制 → 强制汇报所有复制任务状态（≥2.00.15 版本支持，旧版需用内部接口）→ 确认全部 `isTruncated=true` → 触发 master checkpoint
- **注意**: 迁移窗口若仍有写入，可能导致任务缺口与数据丢失

### 主从一致性校验
- **场景**: 开启异步复制前后需要校验主从分区一致性
- **难点**: 主从 `chunkId` 不同，不可直接比较。需用 `file` 路径 + `listTables` 映射 `physicalIndex` 为 `tableName` 构造可比 ID
- **输出**: good（主从匹配）、absent（从集群缺失）、garbage（从集群多余）

### 副本修复（replicaCount 不足）
- **诊断**: 查询副本数量异常的分区（replicaCount != dfsReplicationFactor）
- **前置**: 确认异常分区 state 全部为 COMPLETE，否则需先修复状态
- **修复**: 遍历副本不足分区，从随机可用副本复制到目标节点补齐
- **进度**: 查看副本恢复任务状态统计

### 删除指定分区副本（测试/下线用）
- **前置**: 确认副本数 > 1，否则无冗余副本，**禁止操作**
- **⚠️ 危险操作**: 删除副本不可逆
- **验证**: 删除后检查 replicaCount 是否符合预期；可用副本修复流程恢复
