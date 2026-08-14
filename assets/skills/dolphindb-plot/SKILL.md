---
name: dolphindb-plot
description: "Generate DolphinDB plot() calls when the user needs to plot or visualize data in DolphinDB Web. Use for visualizing vectors, tuples, matrices, tables, query results, comparisons, proportions, trends, correlations, or surface-style numeric matrices."
metadata:
  display_name: DolphinDB Plot 图表生成
  tags: [DolphinDB, plot, 图表, 可视化]
  version: "1.0"
---

# DolphinDB plot 图表生成

## 用途

将用户的可视化需求转换为 DolphinDB `plot()` 调用，并在当前运行环境支持时执行 DolphinDB 脚本以生成可渲染图表。

## 约束

- 当用户需要绘图、图表或可视化数据时，使用 `plot()`。
- 只使用 DolphinDB 脚本和 `plot(data, [labels], [title], [chartType=LINE], [stacking=false], [extras])`。
- 不依赖 Python、shell、Node.js、本地临时文件、绝对路径或硬编码连接信息。
- 不编造数据库、表、列或变量名；数据来源不清楚时，先要求用户提供对象名、查询结果或字段说明。
- 用户已经给出表或查询结果时，优先直接对表、列向量、矩阵或元组绘图，不额外落盘。
- 生成折线图时显式传入 `extras={multiYAxes: true}` 或 `extras={multiYAxes: false}`。用户未要求多 Y 轴时默认 `false`。
- 当用户需要多量纲、多数量级同图对比时，设置 `multiYAxes: true`。
- `extras` 必须是字符串 key 的字典；不要添加未确认的扩展属性。
- `stacking` 只在 `chartType` 为 `LINE` 或 `BAR` 时有效。
- `SURFACE` 用于三维曲面图，且数据必须是数值矩阵；矩阵的行标签和列标签会作为 X/Y 轴刻度，不要同时传 `labels`、`stacking` 或 `extras`。

## 数据映射

- 向量：单系列图；向量名作为系列名。
- 元组：每个同长度向量作为一个系列；向量名作为系列名。
- 矩阵：每列作为一个系列；列标签作为系列名；行标签可作为数据点标签。
- 表：每列作为一个系列；列名作为系列名。需要选择部分列时，优先用 ``t[`col1`col2]`` 或列向量元组表达。
- `labels` 表示所有系列共享的数据点标签；有时间、日期、分类或 x 轴向量时应优先提供。
- `title` 优先使用可读标题；需要轴标题时使用字符串向量，例如 `["成交金额趋势", "日期", "金额"]`。

## 图表选择

- 趋势、时间序列：`LINE`。
- 排名、横向比较：`BAR`。
- 类别数值比较：`COLUMN`。
- 构成占比：`PIE`。
- 面积趋势：`AREA`。
- 两个数值变量的关系：`SCATTER`。
- 数值矩阵的三维曲面：`SURFACE`，仅在目标环境支持时使用。

## 工作流程

1. 确认数据对象、字段、标签列和用户的图表意图。
2. 选择最小可读的 `plot()` 调用，避免无关数据转换。
3. 根据图表类型补齐 `labels`、`title`、`chartType`、`stacking` 和 `extras`。
4. 当前环境可执行 DolphinDB 脚本时，执行并验证图表对象可生成；无法执行时，说明未验证并给出可复制脚本。
5. 最终回复包含 DolphinDB 代码、图表类型选择理由，以及未验证或待确认项。

## 参考文件

- `references/plot-examples.md`：常见 `plot()` 调用示例。
