---
kind: category
---

# 元数据损坏 / 副本异常诊断

> 触发: 副本异常、chunk 不一致、分区 RECOVERING、No available replica、Version Conflict、数据库 has been dropped


## 规则

### Controller 元数据丢失
条件: `has been dropped` 但物理数据仍存在
处置: 备份 raft/dfsMeta 目录 → 停集群 → 清除 DFSMetaLog → 启动后从数据节点恢复控制节点元数据 → 触发节点重新上报状态

### 版本不一致（Controller vs DataNode）
条件: 元数据异常日志出现 `Version Conflict`
处置: 停写入 → 查询版本差异分区 → 强制按最高版本副本修正 chunk 版本

### 副本缺失（replicaCount 不足）
须知：不用查询具体问题分区，直接调用函数即可
条件: 分区状态概览中 replicaCount < 预期副本数
处置: 检查是否有节点离线 → 触发节点重新上报状态 → 仍缺失则从源节点复制副本到目标节点补齐

### 副本数据不一致
条件: 相同查询每次结果不同
处置: 缩小分区范围 → 对比两副本的 tablet 元数据行数 → 删除异常副本 → 系统自动恢复

### 垃圾分区残留
条件: 同 dfsPath 出现多个 chunkId
处置: 以 controller 为准保留有效 chunk → 删除冗余副本元数据 → 触发 chunk checkpoint 持久化

### Stale Report 循环
条件: controller 持续刷 `stale report` 日志，leader 长期 not ready
处置: 停全集群 → 清除所有 controller 的 raft/dfsMeta → 从数据节点恢复控制节点元数据

### Domain 文件损坏/丢失/不一致
条件: 
1. 日志出现 `domain path does not exist` 或 `Failed to read data from domain` 
2. 不同节点 domian 里面的 schema 不一致
处置: 从其他副本拷回 domain 文件；不可恢复时需重建或清理元数据

## 重要操作提示
- 从数据节点恢复控制节点元数据前，确认所有 datanode 在线，且 dfsMetaDir 目录为空
- 强制按副本修正版本会强制对齐，执行前先停写入
- 复制/删除副本操作会直接改动副本与元数据，执行前确认影响范围
- 所有元数据修改操作前**必须备份** raft/dfsMeta 目录

## 验证
- 所有分区状态为 COMPLETE
- replicaCount 一致
- 无未完成的 recovery 任务
- 业务查询结果一致性验证

## 已知案例

### Controller 元数据损坏

#### Controller 元数据异常（domain 丢失/版本错乱）
- **现象**: `The database [dfs://xxx] has been dropped` / `Version Conflict`
- **触发**: checkpoint 序列化异常或 SID/CID 错乱
- **修复**: 定位丢失 domain → 对比 controller/datanode 元数据 → 从数据节点恢复控制节点元数据或手工补齐

#### Stale Report 循环刷日志
- **现象**: controller 持续刷 `stale report ... will let datanode report again`
- **触发**: 事务状态不一致导致无限循环上报
- **修复**: 停全集群 → 清除所有 controller raft/dfsMeta → 从数据节点恢复控制节点元数据 → 强制按副本修正版本差异

#### 基于备份恢复 Controller 元数据
- **现象**: 版本回退后 controller 与 datanode 不匹配
- **修复**: 停集群 → 用备份 dfsMeta/raft 替换 → 启动后清理垃圾分区 + 修版本

#### 元数据备份到同目录导致重复回放
- **现象**: 集群启动后事务被重复回放
- **触发**: 将 DFSMetaLog.log 备份到同目录
- **修复**: 移走同目录备份文件 → 触发 master checkpoint → 一致性校验

### Datanode 元数据损坏
- **现象**: 数据节点元数据不可读
- **修复**: 停集群 → 清空故障节点全部数据 → 启动后从其他节点复制副本补回（**仅限双副本**）

### 版本不一致

#### Controller/DataNode Chunk 版本不一致
- **报错**: `No available replica for the chunk FileBlock XXX.domain`
- **修复**: 停写入 → 查版本差异 chunkId → 强制按最高版本副本修正

#### 版本不一致通用诊断
- **报错**: `Cannot find any replica information about this partition FileBlock`
- **修复**: 按 chunkId 查询控制节点和数据节点的分区状态 → 对比 version/versionList → 选修复方案

### 副本缺失与异常

#### 副本记录丢失（触发节点上报修复）
- **报错**: `Cannot find any replica information ... on the controller`
- **触发**: controller 异常（如 license 过期宕机）导致副本记录丢失
- **修复**: 按节点触发重新上报状态

#### replicaCount=0（节点未上报）
- **触发**: 资源压力大 / urgentWorkerNum 不足 → controller 误判掉线
- **修复**: 批量触发节点重新上报 → 调大 controller urgentWorkerNum

#### 副本缺失批量修复
- **现象**: 分区长期 RECOVERING
- **修复**: 停写入 → 批量从源节点复制副本到目标节点

#### 单副本变双副本
- **修复**: 全节点在线 + chunk 正常 + 无进行中事务 → 批量复制副本 → 修改副本数配置 → 触发 master checkpoint

#### 相同查询结果不一致
- **触发**: 宕机/断电导致双副本数据不一致
- **修复**: 缩小分区范围 → 对比两副本行数 → 删除异常副本

#### Symbol 列超限导致副本决议失败
- **报错**: `One symbase's size can't exceed 2097152`
- **修复**: 备份 → 删异常副本和分区 → Symbol 改 String 重建表

#### 配置路径误改导致副本缺失
- **触发**: 升级时误改 volumes/dfsmeta/chunkmeta 路径
- **修复**: 对比启动日志历史参数 → 恢复原路径 → 重启

#### Domain chunk 无可用副本
- **报错**: `No available replica for the chunk FileBlock XXX.domain`
- **修复**: 遍历所有 DFS 数据库定位异常库 → 强制按副本修正版本

### Domain 文件异常

#### Domain 文件缺失
- **报错**: `getFileBlocksMeta on path '/xxx/domain' failed, reason: path does not exist`
- **修复**: 从可用副本拷回 domain；不可恢复 → 删除数据节点上的副本 → 清理控制节点元数据

#### Domain 文件不一致
- **现象**: 不同数据节点读取库表 schema 时不一致（大部分情况出现在值分区不一致）
- **修复**: 从确认哪个domain为主，删除另一个 domain 副本，从该副本拷回 domain；然后通过 clearCachedDatabase 清理保存在内存中的缓存

### 垃圾分区清理

#### 垃圾分区扫描与删除
- **现象**: 同 dfsPath 出现多个 chunkId
- **修复**: 按 dfsPath 分组扫描重复 chunk → 以 controller 为准保留有效 chunk → 删除冗余副本元数据

#### 删除垃圾分区报 Can't find database
- **触发**: controller 已无该库元数据，datanode 残留
- **修复**: 临时在数据节点建库缓存 → 删除副本元数据 → 清理临时库缓存

#### Status=1 垃圾分区无法删除
- **修复**: 将数据节点上该 chunk 版本号改为 -1 恢复状态 → 删除数据节点上的副本

#### 重复 dfsPath 导致 meta 冲突
- **报错**: `One table meta file should have only one block`
- **修复**: 按 dfsPath 分组 → 保留 cid 较大且版本合理的 chunk → 删冗余 → 触发 chunk checkpoint

### Volumes 路径异常
- **触发**: web bug 导致 volumes 目录迁移错位
- **修复**: 将历史 chunkMeta 挂到单节点比对 → 从集群复制副本补回
