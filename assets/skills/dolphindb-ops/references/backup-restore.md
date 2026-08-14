---
kind: operation
---

# 备份与恢复操作指南

> 触发: 数据备份、恢复、迁移、backup/restore 函数选型

## 快速定位


| 函数          | 用途                         | 方式           |
| ------------- | ---------------------------- | -------------- |
| `backup`      | 最灵活，支持整库/表/条件分区 | 文件拷贝或 SQL |
| `backupDB`    | 一键备份某库所有表           | 仅文件拷贝     |
| `backupTable` | 一键备份某库单表             | 仅文件拷贝     |

## 恢复函数选型

| 函数           | 用途                         | 方式     |
| -------------- | ---------------------------- | -------- |
| `migrate`      | 恢复到目标库表（可自动建库） | 文件/SQL |
| `restore`      | 恢复单表全部或部分分区       | 文件/SQL |
| `restoreDB`    | 恢复某库所有表               | 仅文件   |
| `restoreTable` | 恢复某库单表                 | 仅文件   |

## 辅助函数

- `getBackupList` — 查看有哪些备份
- `getBackupMeta` — 查看分区备份元数据
- `loadBackup` — 加载某分区备份数据
- `checkBackup` — 校验备份完整性
- `getBackupStatus` — 查看备份/恢复任务状态

## 标准操作流程

### 备份
1. 确定范围：整库/表/条件分区
2. 选择函数和方式
3. 执行备份
4. 校验备份完整性

### 恢复
1. 确定目标：原库回填/新库迁移
2. 选择恢复函数
3. 执行恢复
4. 校验行数、分区完整性

## 规则

### restoreDB 跨版本兼容性失败
条件: 报错 `Meta file corrupted, failed to read sortKeyMappingFunction` 或 `Invalid backup meta entry type 5`
根因: 高版本（3.00.x）备份在低版本（2.00.x）恢复
处置: 在同版本间执行 restore；跨大版本使用 Parquet 插件导出/导入迁移

### 恢复成功但表为空
条件: `restoreDB` / `restoreTable` 无报错，但恢复后仅有表结构、数据为空
处置: 检查备份目录中 `_metadata` 文件大小。若 `_metadata` 为 0 且存在 `_metadata.tmp` → 重命名 `_metadata.tmp` 为 `_metadata` → 重新恢复。`_metadata` 为 0 且无 `.tmp` 时需联系技术支持

### 注意事项
restore 2.00.13/3.00.1 版本以前 snapshot 默认值为 true ，如果 partition="%",若恢复文件没有其他分区文件会导致目标表存在的分区被删除。 
## 验证
- 校验行数、分区完整性
- 确认目标库表结构与分区方案正确
