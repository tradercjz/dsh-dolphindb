---
kind: category
---

# 分区版本不一致诊断与修复

> 触发: 分区状态不一致、chunk 版本不一致、副本版本不匹配、Controller 与 DataNode 状态不同步

## 背景知识

### 状态机制
DolphinDB 通过 Controller 和 Data Node 两层状态机制维护分区副本的一致性：

**Controller 状态**（控制节点视角）：
- `CONSTRUCTING`：正在创建副本
- `RECOVERING`：正在恢复副本
- `COMPLETE`：副本完整可用

**Data Node 状态**（数据节点视角）：
- `FIN(0)`：副本完整
- `BCOMM(1)`：开始提交
- `COMM(2)`：已提交
- `WRE(3)`：写恢复中
- `IRE(4)`：索引恢复中

### 版本号机制
- Controller 和 Data Node 各自维护 chunk 的版本号
- 正常情况下两者版本号应该一致
- 版本不一致通常由节点宕机、网络中断、磁盘故障等异常导致

## 诊断方法

### 快速诊断流程
1. 查询 Controller 上的异常 chunk（状态非 COMPLETE 或版本不一致）
2. 查询 Data Node 上的异常 chunk（状态非 FIN 或版本不匹配）
3. 对比 Controller 和 Data Node 的版本号差异
4. 根据场景选择修复方法

### 典型场景识别

**场景 A：Controller 状态正常，Data Node 状态异常**
- Controller：COMPLETE
- Data Node：某些副本状态非 FIN(0)
- 原因：数据节点写入未完成或恢复中断

**场景 B：Controller 状态异常，Data Node 状态正常**
- Controller：RECOVERING 或 CONSTRUCTING
- Data Node：所有副本 FIN(0)
- 原因：Controller 元数据未更新

**场景 C：版本号不一致**
- Controller 版本号 ≠ Data Node 版本号
- 原因：节点宕机导致版本同步失败

**场景 D：副本数量不足**
- 实际副本数 < 配置副本数
- 原因：副本丢失或创建失败

## 规则

### Controller 状态异常但副本完整
条件: Controller 显示 chunk 状态为 RECOVERING 或 CONSTRUCTING，但所有数据节点上副本状态均为 FIN(0)
处置:
  1. 查询 Controller 上异常 chunk 列表
  2. 查询对应 Data Node 上的副本状态，确认均为 FIN(0)
  3. 从数据节点恢复控制节点元数据
  4. 触发节点重新上报状态
  5. 验证 Controller 状态更新为 COMPLETE
根因: Controller 元数据未及时更新，但数据完整

### Data Node 状态异常但 Controller 正常
条件: Data Node 显示 chunk 状态非 FIN(0)，但 Controller 状态为 COMPLETE
处置:
  1. 查询 Data Node 上异常 chunk 列表
  2. 检查是否有正在进行的恢复任务
  3. 若无恢复任务，强制修正数据节点上的 chunk 版本
  4. 触发节点重新上报状态
根因: 数据节点状态未同步，但数据完整

### 版本号不一致（Controller > Data Node）
条件: Controller 版本号大于 Data Node 版本号
处置:
  1. 查询版本不一致的 chunk 列表
  2. 检查是否有其他副本版本正常
  3. 若有正常副本，从正常副本强制修正版本
  4. 若无正常副本，评估数据完整性后手动修正版本
  5. 验证版本号一致性
根因: 数据节点宕机或写入失败导致版本未更新

### 版本号不一致（Data Node > Controller）
条件: Data Node 版本号大于 Controller 版本号
处置:
  1. 查询版本不一致的 chunk 列表
  2. 触发 master checkpoint 同步 Controller 元数据
  3. 若仍不一致，从数据节点恢复控制节点元数据
  4. 验证版本号一致性
根因: Controller 元数据未及时持久化

### 副本数量不足
条件: 实际副本数小于配置的副本数
处置:
  1. 查询副本数量不足的 chunk 列表
  2. 检查是否有正在进行的副本创建任务
  3. 若无任务，手动触发副本复制
  4. 验证副本数量恢复正常
根因: 副本创建失败或副本丢失

### 副本版本不一致
条件: 同一 chunk 的不同副本版本号不同
处置:
  1. 查询版本不一致的副本列表
  2. 确定哪个副本版本正确（通常选择版本号最高且数据完整的）
  3. 从正确副本强制修正其他副本版本
  4. 验证所有副本版本一致
根因: 副本同步失败或节点宕机

### 孤立副本（Controller 无记录但 Data Node 存在）
条件: Data Node 上存在 chunk，但 Controller 无对应记录
处置:
  1. 查询所有数据节点上的 chunk 列表
  2. 对比 Controller 记录，找出孤立副本
  3. 评估孤立副本是否需要保留
  4. 若不需要，删除数据节点上的孤立副本元数据和数据
  5. 若需要，在 Controller 上补充元数据记录
根因: Controller 元数据丢失或副本创建异常

### 幽灵副本（Controller 有记录但 Data Node 不存在）
条件: Controller 记录显示副本存在，但 Data Node 上实际不存在
处置:
  1. 查询 Controller 上的副本记录
  2. 查询对应 Data Node，确认副本不存在
  3. 若其他副本正常，删除 Controller 上的幽灵副本记录
  4. 若副本数不足，触发副本复制
根因: 副本删除未同步或磁盘故障

## 验证

- Controller 上所有 chunk 状态为 COMPLETE
- Data Node 上所有 chunk 状态为 FIN(0)
- Controller 和 Data Node 版本号一致
- 所有 chunk 副本数量符合配置
- 同一 chunk 的所有副本版本号一致
- 无孤立副本和幽灵副本

## 注意事项

### 风险提示
- **修复操作风险极高**，可能导致数据丢失
- **必须先备份**关键数据和元数据
- **必须先确认**数据完整性再执行修复
- **强制修正版本**操作不可逆，谨慎使用

### 操作顺序
1. **先诊断**：全面了解不一致情况
2. **再备份**：备份元数据和关键数据
3. **后修复**：按场景选择修复方法
4. **最后验证**：确认修复效果

### 特殊情况
- 若涉及重要业务数据，建议联系技术支持
- 若不确定数据完整性，不要强制修正版本
- 若多个场景同时存在，优先修复 Controller 状态

## 已知案例

### 案例 1：节点宕机导致版本不一致
- **现象**：Controller 版本号 > Data Node 版本号，chunk 状态 RECOVERING
- **根因**：数据节点宕机，写入事务未完成
- **处置**：检查其他副本版本 → 从正常副本强制修正版本 → 验证一致性
- **结果**：版本号恢复一致，chunk 状态恢复 COMPLETE

### 案例 2：Controller 元数据未更新
- **现象**：Controller 状态 RECOVERING，但所有 Data Node 副本均为 FIN(0)
- **根因**：Controller 元数据持久化失败
- **处置**：从数据节点恢复控制节点元数据 → 触发节点上报 → 验证状态
- **结果**：Controller 状态更新为 COMPLETE

### 案例 3：磁盘故障导致孤立副本
- **现象**：Data Node 上存在 chunk，但 Controller 无记录
- **根因**：磁盘故障后更换磁盘，旧数据残留
- **处置**：确认孤立副本无用 → 删除数据节点上的副本元数据和数据
- **结果**：清理完成，无孤立副本

