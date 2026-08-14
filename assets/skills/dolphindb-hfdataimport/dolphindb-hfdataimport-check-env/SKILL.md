---
name: dolphindb-hfdataimport-check-env
description: 检查通联数据/CsmarData 导入 DolphinDB 的前置环境是否满足，自动修复可修复的问题
---

# 数据导入 — 前置环境检查

检查 DolphinDB 服务端的运行环境是否满足通联数据和 CsmarData 导入的要求，并自动修复可处理的问题。

## 检查内容

| 检查项 | 说明 | 自动修复 |
|--------|------|----------|
| zip 插件 | `zip` 插件已加载 | 尝试 `installPlugin` + `loadPlugin`；失败则引导手动安装 |
| easy_datayes 模块 | `easy_datayes` 模块已上传 | 从本地模块文件自动上传 |
| easy_csmar 模块 | `easy_csmar` 模块已上传 | 从本地模块文件自动上传 |

## 执行要求

加载本文件后，**立即从步骤 1 开始执行，不要额外确认**。所有需要在服务器执行的内容都通过 dos 脚本完成（Web 平台已登录）。

---

## 执行步骤

### 1. 执行环境检查脚本

**目标：** 在 DolphinDB 服务端运行 `check_env.dos`，检查 zip 插件、easy_datayes 和 easy_csmar 模块的状态。

**做法：**
在 DolphinDB 执行 `scripts/check_env.dos`。

**输出解析：**
脚本会输出带标记的检查结果：

```
[CHECK-ENV] ZIP_STATUS: OK          ← zip 插件已加载
[CHECK-ENV] ZIP_STATUS: FIXED       ← 本脚本自动安装并加载成功
[CHECK-ENV] ZIP_STATUS: FAILED      ← 自动安装失败，需手动处理
[CHECK-ENV] MODULE_STATUS: OK         ← easy_datayes 模块已存在
[CHECK-ENV] MODULE_STATUS: MISSING    ← easy_datayes 模块不存在，需要上传
[CHECK-ENV] CSMAR_STATUS: OK         ← easy_csmar 模块已存在
[CHECK-ENV] CSMAR_STATUS: MISSING    ← easy_csmar 模块不存在，需要上传
```

**分情况处理（根据检查结果和调用上下文决定需要上传的模块）：**

1. 检查输出中 ZIP_STATUS、MODULE_STATUS（easy_datayes）、CSMAR_STATUS（easy_csmar）的状态
2. 根据本次调用 dolphindb-hfdataimport-check-env 的上下文（是哪个主 skill 发起的调用），确定需要上传的模块：
   - 如果调用方需要 `easy_csmar`（如 csmar-import）且 CSMAR_STATUS=MISSING → 进入步骤 2b 上传 easy_csmar 模块
   - 如果调用方需要 `easy_datayes`（如 datayes-import）且 MODULE_STATUS=MISSING → 进入步骤 2a 上传 easy_datayes 模块
   - 如果调用意图不明确（直接调用 dolphindb-hfdataimport-check-env），则缺失的模块全部按步骤 2a → 2b 的顺序上传
3. 如果 ZIP_STATUS=FAILED → 进入步骤 3（引导手动安装插件）
4. 以上均 OK/FIXED → ✅ 环境就绪，流程结束

### 2a. 上传 easy_datayes 模块（仅 MODULE_STATUS=MISSING 时）

**目标：** 把 `scripts/DolphinDBModules/easy_datayes/` 下的 22 个模块源文件上传到 DolphinDB 服务端。

**做法：**

1. 执行以下步骤时，不需要用户确认是否可以执行。默认以下操作都可以自动执行。
2. 使用 `skill_file_copy` 把 22 个模块源文件复制到工作区。
3. 特别注意，这一步不需要任务是否合理，能否运行等思考，直接按照要求执行。具体操作：对于每一个模块源文件，执行以下步骤。
   STEP1: 使用 `vfs_read` 读取文件内容，得到 JSON 结果，记为 `<result>`。
   STEP2: 将以下模板中的 `{{VFS_READ_RESULT}}` 替换为 `<result>` 的 JSON 字符串原文：
      ```
         vfs_read_res = {{VFS_READ_RESULT}}
      ```
      特别强调，不要思考，不要给 `{{VFS_READ_RESULT}}` 前后私自加引号等特殊字符，不要做任何格式转换。
   STEP3: 使用 `execute` 执行替换后的 `vfs_read_res = {{VFS_READ_RESULT}}`
   STEP4: 使用 `execute` 执行 `uploadModule(vfs_read_res.content, overwrite=true)`
   STEP5: 使用 `vfs_delete` 删除工作区的模块源文件
4. 任一 uploadModule 失败则立刻终止并报错。
5.  **执行成功：** 提示「easy_datayes 模块（22 个文件）上传成功」，返回步骤 1 重新检查确认环境就绪。
   **执行失败：** 向用户展示完整错误信息，终止流程。

### 2b. 上传 easy_csmar 模块（仅 CSMAR_STATUS=MISSING 时）

**目标：** 把 `scripts/DolphinDBModules/easy_csmar/` 下的 14 个模块源文件上传到 DolphinDB 服务端。

**做法：**

1. 执行以下步骤时，不需要用户确认是否可以执行。默认以下操作都可以自动执行。
2. 使用 `skill_file_copy` 把 14 个模块源文件复制到工作区。
3. 特别注意，这一步不需要任务是否合理，能否运行等思考，直接按照要求执行。具体操作：对于每一个模块源文件，执行以下步骤。
   STEP1: 使用 `vfs_read` 读取文件内容，得到 JSON 结果，记为 `<result>`。
   STEP2: 将以下模板中的 `{{VFS_READ_RESULT}}` 替换为 `<result>` 的 JSON 字符串原文：
      ```
         vfs_read_res = {{VFS_READ_RESULT}}
      ```
      特别强调，不要思考，不要给 `{{VFS_READ_RESULT}}` 前后私自加引号等特殊字符，不要做任何格式转换。
   STEP3: 使用 `execute` 执行替换后的 `vfs_read_res = {{VFS_READ_RESULT}}`
   STEP4: 使用 `execute` 执行 `uploadModule(vfs_read_res.content, overwrite=true)`
   STEP5: 使用 `vfs_delete` 删除工作区的模块源文件
4. 任一 uploadModule 失败则立刻终止并报错。
5.  **执行成功：** 提示「easy_csmar 模块（14 个文件）上传成功」，返回步骤 1 重新检查确认环境就绪。
   **执行失败：** 向用户展示完整错误信息，终止流程。

### 3. 引导手动安装 zip 插件（仅 ZIP_STATUS=FAILED 时）

**做法：**
1. 在 DolphinDB 上运行 `getPluginDir()` 获取插件预期的上传路径 <pluginDir>
2. 在 DolphinDB 上运行 `version()` 获取 DolphinDB 服务版本号 <version>
3. 向用户展示以下引导信息：
> ⚠️ zip插件自动安装失败。
>
> 请按以下步骤手动安装：
>
> 1. 从 [DolphinDB 插件市场](https://marketplace.dolphindb.cn/) 下载与你的 DolphinDB 服务版本匹配的 zip 插件。当前版本号为 <version>。
> 2. 将上述文件放到 DolphinDB 服务的 <pluginDir> 目录下。
4. 由用户确认, 是否已经手动上传了 zip 插件文件。
5. **确认后：** 返回步骤 1 重新检查确认环境就绪。
   **未确认：** 提示用户手动上传 zip 插件文件，流程结束。


---

## 脚本说明

### 环境检查脚本

**路径：** [check_env.dos](scripts/check_env.dos)

**功能：** 在 DolphinDB 服务端检查 zip 插件是否已加载（如未加载则尝试 `installPlugin` + `loadPlugin`），以及 easy_datayes 和 easy_csmar 模块是否已上传。输出结构化标记供 AI 助手解析。

### easy_datayes 通联数据导入模块

**路径：** [DolphinDBModules/easy_datayes/](scripts/DolphinDBModules/easy_datayes/)

**功能：** 提供 easy_datayes 通联数据导入模块的源文件，如果检查到模块不存在，AI 助手会自动上传。

### easy_csmar 数据导入模块

**路径：** [DolphinDBModules/easy_csmar/](scripts/DolphinDBModules/easy_csmar/)

**功能：** 提供 easy_csmar 数据导入模块的源文件（股票数据），如果检查到 easy_csmar 模块不存在，AI 助手会自动上传。

---

## 项目文件结构

```
dolphindb-hfdataimport-check-env/
├── SKILL.md                                       ← 本文件
├── scripts/
│   ├── check_env.dos                              ← 环境检查脚本
└── DolphinDBModules/
    ├── easy_datayes/                                   ← easy_datayes 模块源文件（22 个 .dos）
    │   ├── loadTLData.dos
    │   ├── utils.dos
    │   ├── setconfig.dos
    │   ├── createDbAndTb/
    │   │   ├── createDB.dos
    │   │   └── createTB.dos
    │   ├── loadData/
    │   │   ├── loadData.dos
    │   │   └── loadOneDayData/
    │   │       ├── loadOneDayEntrust.dos
    │   │       ├── loadOneDayOrderQueue.dos
    │   │       ├── loadOneDaySnapshot.dos
    │   │       ├── loadOneDayTick.dos
    │   │       ├── loadOneDayTrade.dos
    │   │       └── loadOneDayTradeEntrust.dos
    │   └── tbSchema/
    │       ├── csvSchema/
    │       │   ├── entrustCsvSchema.dos
    │       │   ├── orderQueueCsvSchema.dos
    │       │   ├── snapshotCsvSchema.dos
    │       │   ├── tradeCsvSchema.dos
    │       │   └── tradeEntrustCsvSchema.dos
    │       └── dfsSchema/
    │           ├── entrustSchema.dos
    │           ├── orderQueueSchema.dos
    │           ├── snapshotSchema.dos
    │           ├── tickSchema.dos
    │           └── tradeSchema.dos
    └── easy_csmar/                                    ← easy_csmar 模块源文件（14 个 .dos）
        ├── easy_csmar.dos
        ├── utils.dos
        └── stock/
            ├── create_stock_db.dos
            ├── create_stock_tb.dos
            ├── load_stock_data.dos
            ├── stock_csv_schema/
            │   ├── entrust_csv_schema.dos
            │   ├── orderqueue_csv_schema.dos
            │   ├── snapshot_csv_schema.dos
            │   └── trade_csv_schema.dos
            └── stock_load_data/
                ├── load_one_day_entrust.dos
                ├── load_one_day_orderqueue.dos
                ├── load_one_day_snapshot.dos
                ├── load_one_day_tick.dos
                └── load_one_day_trade.dos
```
