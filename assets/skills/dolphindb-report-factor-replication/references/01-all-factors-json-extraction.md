# 全量因子 JSON 提取

## Skill 介绍

本 Skill 用于创建研报分析任务前的“解析因子”阶段。从整篇研报中提取全部候选因子，并返回前端可直接解析的 JSON。该 JSON 会被转换为因子列表，供用户勾选后创建后续复现任务。

本 Skill 面向整篇研报的因子发现，不负责单个因子的公式精修、数据源字段探查或 DolphinDB 代码生成。

## 适用输入

- 研报全文。
- 研报标题。
- 用户补充的关注范围或排除范围。
- 可选的资料或文档检索结果。

## 输出格式

必须返回纯 JSON 对象：

```json
{
  "summary": "Main research approach summary",
  "factors": {
    "factor_name_1": "Factor calculation description",
    "factor_name_2": "Factor calculation description"
  }
}
```

字段含义：

- `summary`：概括整篇研报的主要研究方法、资产范围、因子构造思路和评价目标。
- `factors`：对象类型。键为英文因子名，值为该因子的计算描述。

如果研报没有可复现因子，返回：

```json
{
  "summary": "No reproducible factor is identified from this report",
  "factors": {}
}
```

## 因子提取规则

1. 提取所有可复现的候选因子，不只提取正文显式标题中的因子。
2. 重点检查表格、公式、附录、变量定义、回归变量、组合构造说明和策略信号说明。
3. 因子名必须使用英文，不能包含空格，使用下划线连接单词。
4. 因子名应简洁稳定，优先根据研报原文缩写、英文变量名或公式变量命名。
5. 因子描述必须说明计算过程，至少包含主要输入变量、窗口或聚合方式。
6. 如果多个因子只是同一因子的不同窗口版本，可保留为不同名称，例如 `momentum_20d` 和 `momentum_60d`。
7. 如果一个因子包含多个步骤，描述中按计算顺序写清楚。
8. 不要把纯评价指标、收益标签、回归目标变量或无法复现的观点当作因子。

## 命名建议

- 使用小写英文和下划线，例如 `volume_price_divergence`。
- 原文已有大写缩写时可保留语义后转为下划线形式，例如 `ARBR` 可写为 `arbr`。
- 窗口信息可放在结尾，例如 `return_volatility_ratio_20d`。
- 方向或处理方式可放在结尾，例如 `momentum_rank_zscore`。

## JSON 约束

- 只返回 JSON，不添加解释文字。
- 不使用代码块标记。
- `factors` 必须是对象，不是数组。
- 每个因子描述必须是字符串。
- 不重复输出同义因子；如确有重复，合并描述。

## 检查清单

- 是否提取了表格和附录中的因子。
- 是否过滤了不可复现的纯结论或评价指标。
- 因子名是否都是英文、无空格、下划线连接。
- JSON 是否能被直接解析为 `{ summary: string, factors: Record<string, string> }`。
