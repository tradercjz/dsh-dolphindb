---
name: dolphindb-tushare-check-env
description: 检查 Tushare 数据导入 DolphinDB 的前置环境，确认 httpClient 插件和py插件（可选）以及 easy_tushare 模块可用。
---

# Tushare 数据导入 - 前置环境检查

检查 DolphinDB 服务端是否满足 Tushare 数据导入要求，并对可自动处理的问题执行修复或给出明确处理方式。

## 检查内容

| 检查项 | 说明 | 自动修复 |
| --- | --- | --- |
| `httpClient` 插件 | Tushare API 调用依赖 `httpClient::httpPost` | 尝试 `installPlugin` + `loadPlugin`；失败时引导手动安装 |
| `py` 插件 | Tushare API 部分数据调用（如pro_bar接口获取复权数据）依赖 `py::call`等 | 询问用户是否需要安装，如果需要直接引导用户手动安装 |
| `easy_tushare` 模块 | 按本次导入资产域检查 `easy_tushare::ts_init` 和对应资产域模块 | 缺失时只上传必需模块文件 |

## 执行要求

加载本文件后，立即从步骤 1 开始执行，不要额外确认。所有服务端操作都在 DolphinDB Web 平台中通过 `.dos` 脚本或模块上传完成。

## 执行步骤

### 1. 执行环境检查脚本

根据用户需要导入的资产域，先修改脚本顶部的 `dataDomains` 参数，再在 DolphinDB Web 平台执行：

```text
scripts/dolphindb-tushare-check-env.dos
```

示例：用户需要同时导入 `stock` 和 `index` 时：

```dos
dataDomains = ["stock", "index"]
```

脚本会输出结构化标记：

```text
[CHECK-ENV] HTTPCLIENT_STATUS: OK
[CHECK-ENV] HTTPCLIENT_STATUS: FIXED
[CHECK-ENV] HTTPCLIENT_STATUS: FAILED
[CHECK-ENV] PY_STATUS: OK
[CHECK-ENV] PY_STATUS: FAILED
[CHECK-ENV] MODULE_STATUS: OK
[CHECK-ENV] MODULE_STATUS: MISSING
[CHECK-ENV] REQUIRED_DOMAINS: [...]
[CHECK-ENV] REQUIRED_MODULES: [...]
[CHECK-ENV] ERROR: <详细错误信息>
```

处理规则：

1. `MODULE_STATUS=MISSING`：进入步骤 2 上传 `easy_tushare` 模块。
2. `HTTPCLIENT_STATUS=FAILED`：进入步骤 3 引导手动安装插件。
3. `PY_STATUS=FAILED`: 询问用户是否需要安装 py 插件，如有需要进入步骤 4 引导手动安装，且必须关注 4.1 注意事项部分内容。
4. 以上必需项状态均为 `OK` 或 `FIXED` 时环境就绪，结束流程。`PY_STATUS=FAILED` 且用户回复不需要 py 插件，也视为环境就绪，结束流程。

### 2. 上传 easy_tushare 模块
**目标：** 只把本次导入所需模块上传到 DolphinDB 服务端。所需模块由 `REQUIRED_MODULES` 输出决定，固定包含 `easy_tushare::ts_init`，并为每个资产域包含 4 个模块：`*_init`、`*_create_table`、`*_load_data`、`*_schedulejob`。

**做法：**

1. 执行以下步骤时，不需要用户确认是否可以执行。默认以下操作都可以自动执行。
2. 使用 `skill_file_copy` 只把 `REQUIRED_MODULES` 对应的模块源文件复制到工作区。多个资产域时，上传 `ts_init.dos` 加每个资产域目录下的 4 个 `.dos` 文件。
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
5.  **执行成功：** 提示「easy_tushare 必需模块上传成功」，返回步骤 1 重新检查确认环境就绪。
   **执行失败：** 向用户展示完整错误信息，终止流程。

资产域到模块文件的映射如下：

```text
scripts/DolphinDBModules/easy_tushare/
├── ts_init.dos                        # 所有导入都需要
├── stock/                             # dataDomain = stock
│   ├── stock_init.dos
│   ├── stock_create_table.dos
│   ├── stock_append_data.dos
│   └── stock_schedulejob.dos
├── etf/                               # dataDomain = etf
│   ├── etf_init.dos
│   ├── etf_create_table.dos
│   ├── etf_append_data.dos
│   └── etf_schedulejob.dos
├── fund/                              # dataDomain = fund
│   ├── fund_init.dos
│   ├── fund_create_table.dos
│   ├── fund_append_data.dos
│   └── fund_schedulejob.dos
├── futures/                           # dataDomain = futures
│   ├── futures_init.dos
│   ├── futures_create_table.dos
│   ├── futures_append_data.dos
│   └── futures_schedulejob.dos
├── bond/                              # dataDomain = bond
│   ├── bond_init.dos
│   ├── bond_create_table.dos
│   ├── bond_append_data.dos
│   └── bond_schedulejob.dos
├── index/                             # dataDomain = index
│   ├── index_init.dos
│   ├── index_create_table.dos
│   ├── index_append_data.dos
│   └── index_schedulejob.dos
├── options/                           # dataDomain = options
│   ├── options_init.dos
│   ├── options_create_table.dos
│   ├── options_append_data.dos
│   └── options_schedulejob.dos
├── foreign_exchangre/                 # dataDomain = fx
│   ├── fx_init.dos
│   ├── fx_create_table.dos
│   ├── fx_append_data.dos
│   └── fx_schedulejob.dos
├── spot/                              # dataDomain = spot
│   ├── spot_init.dos
│   ├── spot_create_table.dos
│   ├── spot_append_data.dos
│   └── spot_schedulejob.dos
└── llm/                               # dataDomain = llm
    ├── llm_init.dos
    ├── llm_create_table.dos
    ├── llm_append_data.dos
    └── llm_schedulejob.dos
```

### 3. 引导手动安装 httpClient 插件

仅当 `HTTPCLIENT_STATUS=FAILED` 时执行。

1. 在 DolphinDB 中运行 `getPluginDir()` 获取插件目录。
2. 在 DolphinDB 中运行 `version()` 获取服务端版本。
3. 提示用户从 DolphinDB 插件市场下载与版本匹配的 `httpClient` 插件，并放入 `getPluginDir()` 返回目录。
4. 用户确认安装完成后，返回步骤 1 重新检查。

### 4. 引导手动安装 Py 插件

仅当 `PY_STATUS=FAILED` 且用户需要 Py 插件时执行。
如果机器联网，请参考https://docs.dolphindb.cn/zh/plugins/py/py_3_9.html 文档，使用`installPlugin` + `loadPlugin` 安装，否则执行以下步骤：
1. 在 DolphinDB 中运行 `getPluginDir()` 获取插件目录。
2. 在 DolphinDB 中运行 `version()` 获取服务端版本。
3. 提示用户从 DolphinDB 插件市场下载与版本匹配的 `py` 插件，并放入 `getPluginDir()` 返回目录。
4. 用户确认安装完成后，返回步骤 1 重新检查。
#### 4.1 注意事项
1. py 插件必须在 cfg 配置文件中配置 `globalDynamicLib`参数
2. 不同版本的python插件名不同，如python 版本为3.9，则python插件名为`py39`,python版本为3.10，则python插件名为`py10`。
3. python 环境必须安装 `tushare`、`numpy`、`pandas`包，请显示和用户交互确认。

## 脚本说明

| 路径 | 作用 |
| --- | --- |
| `scripts/dolphindb-tushare-check-env.dos` | 检查 `httpClient`和`py` 插件和 `easy_tushare` 模块状态 |
| `scripts/DolphinDBModules/easy_tushare/` | Tushare 导入模块源码，缺模块时上传 |

