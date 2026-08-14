# DolphinDB Orca DStream API Skill 目录索引

本文件用于说明 `dolphindb-orca-dstream` skill 包内各类资料的用途、建议存放路径和使用优先级。coding agent 在生成 DolphinDB Orca 声明式 DStream API 脚本时，应优先阅读 `SKILL.md`，再根据需求查阅本目录索引中的参考文档和示例脚本。

## 1. 顶层文件

| 文件 | 作用 |
|---|---|
| `SKILL.md` | skill 的核心规则文件，定义触发条件、工作流程、代码生成规范、禁止项、自检清单和常见错误修复规则。 |
| `README.md` | 面向使用者的简介文件，说明本 skill 的适用场景、核心目标、目录结构和使用方式。 |
| `CATALOG.md` | 当前文件，用于索引 skill 包中的参考资料和示例脚本，帮助 coding agent 快速定位资料来源。 |

## 2. 建议目录结构

```text
.
├── SKILL.md
├── README.md
├── CATALOG.md
├── examples/
│   ├── trade_anomaly_monitor.dos
│   ├── net_buy_amount_monitor.dos
│   ├── price_deviation_ma5_alert.dos
│   ├── order_trade_slippage_monitor.dos
│   ├── trade_aggressiveness_monitor.dos
│   ├── industry_amount_rank.dos
│   ├── abnormal_spread_alert.dos
│   └── market_overview_timer.dos
└── references/
    └── orca/
        ├── rules_workflow.md
        ├── rules_codegen.md
        ├── rules_engines.md
        ├── rules_full_legacy.md
        ├── orca.md
        ├── orca_finance.md
        ├── orca_finance_position.md
        ├── orca_conversion_cases.md
        └── coding_agent_orca_issues.md
```

## 3. references/ 参考文档

`references/` 目录用于存放规则、官方文档和问题总结。coding agent 生成 Orca 代码前，应优先使用这里的资料确认 API、参数、调用方式和常见错误。

### 3.0 模块化规则文件

为降低 `SKILL.md` 常驻 token 消耗，原先集中在 `SKILL.md` 中的细节规则已经拆分为以下文件：

| 文件 | 用途 |
|---|---|
| `references/orca/rules_workflow.md` | 标准工作流程、输入信息要求、脚本骨架、输出模板、自检清单。 |
| `references/orca/rules_codegen.md` | 生命周期、DStream 通用写法、mock 数据、查询验证、常见错误、禁止项。 |
| `references/orca/rules_engines.md` | timeSeriesEngine、reactiveStateEngine、join、crossSectionalEngine、sessionWindowEngine、ruleEngine、timerEngine 和复杂案例转写规则。 |
| `references/orca/rules_full_legacy.md` | 优化前完整 SKILL 规则归档，仅在拆分文件不足时用于追溯。 |

### 3.1 Orca 官方文档

| 文件 | 来源 | 用途 |
|---|---|---|
| `references/orca/orca.md` | DolphinDB Orca 实时计算平台主文档 | 确认 Orca 基本概念、DStream API 分类、流图生命周期、source/buffer/sink、map/fork、parallelize/sync、各类引擎接口和运维函数。 |
| `references/orca/orca_finance.md` | Orca 金融场景教程 | 参考完整 Orca 金融示例的脚本组织方式、mock 数据写入方式、流图提交和查询方式。不得直接照搬官方业务逻辑。 |
| `references/orca/orca_finance_position.md` | Orca 持仓损益监控教程 | 参考复杂 DStream 流图、状态计算、持仓类实时计算的脚本结构。不得直接照搬官方持仓损益示例。 |

### 3.2 coding agent 问题汇总

| 文件 | 用途 |
|---|---|
| `references/orca/coding_agent_orca_issues.md` | 汇总 coding agent 编写 Orca DStream API 脚本过程中遇到的高频问题、报错原因和修复规则。生成代码或修复报错时必须优先参考。 |

该问题汇总应至少覆盖以下规则：

- 不要使用不存在的 `existsStreamGraph`。
- 测试脚本清理旧流图优先使用 `try { dropStreamGraph(name, true) } catch(ex) {}`。
- `catch` 必须声明异常变量，例如 `catch(ex) {}`。
- 不要写 JavaScript 风格的 `function(t) { ... }`。
- `map` 中不要直接引用外部字典或外部可变变量。
- 维表映射优先使用 `lookupJoinEngine`。
- 成交按时间关联最近盘口快照时，优先使用 `asofJoinEngine` / `snapshotJoinEngine`，不要误用 `lookupJoinEngine`。
- 比值、占比类指标应在聚合后计算。
- 链式调用拆行时不要让新行以 `.` 开头。
- `count()` 必须指定参数。
- source schema 必须和 mock 数据列数、列顺序、类型一致。
- `timeSeriesEngine` 的测试数据必须跨越窗口边界。
- `reactiveStateEngine` 中不要随意使用未确认支持的序列敏感函数。
- `crossSectionalEngine` 需要显式输出希望保留的分组列。
- 查询结果表前不要想当然使用 `time` 列，应先查看真实 schema。

## 4. examples/ 示例脚本

`examples/` 目录用于存放已经调试过的 `.dos` 示例脚本。这些脚本不是让 coding agent 机械复制，而是作为代码组织方式、清理逻辑、mock 数据构造、结果查询和常见引擎组合的参考。

| 文件 | 覆盖能力 | 适合参考的点 |
|---|---|---|
| `examples/trade_anomaly_monitor.dos` | `map` + `timeSeriesEngine` + 异常窗口输出 | 派生成交额、窗口聚合、异常窗口筛选、窗口触发数据构造。 |
| `examples/net_buy_amount_monitor.dos` | 条件聚合 + 窗口告警 | `iif` 条件聚合、buy/sell 分方向统计、净买入指标计算、告警输出。 |
| `examples/price_deviation_ma5_alert.dos` | `reactiveStateEngine` + 状态告警 | 最近 N 笔均值、偏离度计算、状态类告警、构造异常跳变数据。 |
| `examples/order_trade_slippage_monitor.dos` | 多输入流 join + 滑点统计 | 委托流和成交流关联、OrderID 匹配、买卖方向滑点计算、窗口汇总。 |
| `examples/trade_aggressiveness_monitor.dos` | `asofJoinEngine` + 盘口快照关联 + 窗口汇总 | 成交按事件时间关联最近盘口快照、主动买/卖判断、聚合后计算主动买入占比、`forceTriggerTime` 触发末尾窗口。 |
| `examples/industry_amount_rank.dos` | `lookupJoinEngine` + `crossSectionalEngine` | 实时流关联行业映射表、行业成交额统计、横截面排名、显式输出分组字段。 |
| `examples/abnormal_spread_alert.dos` | 连续状态异常告警 | 快照流、spreadRatio 计算、连续 N 次异常、告警输出。 |
| `examples/market_overview_timer.dos` | 状态维护 + `timerEngine` | 维护最新状态、累计指标、定时触发市场概览输出、分批 mock 数据写入。 |

## 5. 资料使用优先级

coding agent 在生成或修复 Orca DStream API 脚本时，应按以下顺序使用资料：

1. 用户当前提供的业务需求、字段定义、报错和已有代码。
2. `SKILL.md` 中的硬规则、禁止项和自检清单。
3. `references/orca/orca.md` 中的官方 API 和参数说明。
4. `references/orca/coding_agent_orca_issues.md` 中的已知问题和修复规则。
5. `examples/` 中相近场景的脚本结构。
6. 官方教程中的完整脚本组织方式。

若资料中没有确认某个 API、参数或配置项，不要凭记忆生成。应明确标注：

```text
⚠️ 当前资料中未确认该 API / 参数，请先在目标 DolphinDB 版本中验证。
```

## 6. 官方示例使用边界

官方 Orca 文档和教程可用于确认：

- API 名称。
- 参数模式。
- catalog 使用方式。
- source / buffer / sink 写法。
- DStream 链式调用结构。
- mock 数据写入方式。
- 查询 Orca 流表结果的方式。
- 清理流图和重复运行注意事项。

除非用户明确要求复现官方示例，否则不要直接复用以下官方业务案例作为新需求代码：

- 1 分钟 K 线。
- EMA、MACD、KDJ。
- 日累计逐单资金流。
- 过去 5 分钟主动成交量占比。
- 账户持仓损益实时监控。

生成新示例时，应基于用户需求重新设计：

- 输入流表字段。
- 输出表 schema。
- mock 数据。
- 流图结构。
- 引擎参数。
- 查询验证方式。

## 7. 常用能力到资料映射

| 用户需求类型 | 优先参考 |
|---|---|
| 单流过滤、派生字段 | `SKILL.md` 第 7 节、`examples/trade_anomaly_monitor.dos` |
| 固定时间窗口聚合 | `SKILL.md` 第 8 节、`examples/net_buy_amount_monitor.dos` |
| 状态类告警 | `SKILL.md` 第 9 节、`examples/price_deviation_ma5_alert.dos` |
| 多输入流关联 | `SKILL.md` 第 10 节、`examples/order_trade_slippage_monitor.dos` |
| 成交关联最近盘口快照 | `SKILL.md` 第 10 节、`examples/trade_aggressiveness_monitor.dos` |
| 维表映射 | `SKILL.md` 第 10 节、`examples/industry_amount_rank.dos` |
| 横截面排名 | `SKILL.md` 第 11 节、`examples/industry_amount_rank.dos` |
| 会话窗口 | `SKILL.md` 第 12 节、官方 Orca API 文档 |
| 连续 N 次异常 | `SKILL.md` 第 13 节、`examples/abnormal_spread_alert.dos` |
| 定时快照输出 | `SKILL.md` 第 13 节、`examples/market_overview_timer.dos` |
| 重复运行清理 | `SKILL.md` 第 6 节、`references/orca/coding_agent_orca_issues.md` |
| 结果为空排查 | `SKILL.md` 第 15 节、`references/orca/coding_agent_orca_issues.md` |

## 8. 生成前资料检查

在输出完整 Orca DStream API 脚本前，coding agent 应确认：

- 是否已经阅读 `SKILL.md` 中的脚本生成规范。
- 是否已经确认所用 DStream API 在 references 或 examples 中出现过。
- 是否已经检查用户需求是否和官方示例重复。
- 是否已经选择合适的示例脚本作为结构参考。
- 是否已经检查问题汇总中的高频错误。
- 是否已经准备 mock 数据触发预期输出。
- 是否已经加入结果查询语句。
- 是否已经说明生产环境不要随意清理上游真实流表。

## 9. 后续维护建议

当 coding agent 后续写出新的 Orca 示例并完成调试后，建议同步维护：

1. 将完整 `.dos` 脚本放入 `examples/`。
2. 将遇到的新问题追加到 `references/orca/coding_agent_orca_issues.md`。
3. 若发现新的稳定规则，更新 `SKILL.md` 的对应章节。
4. 若新增示例类型，更新本 `CATALOG.md` 的 examples 表格和能力映射表。


---

## 10. v1.2.0 新增案例索引

| 文件 | 来源案例 | 主要用途 |
|---|---|---|
| `examples/multi_source_asof_join_trade_cost.dos` | 多数据源流式实时关联处理 / Asof Join 交易成本 | 测试 asofJoinEngine 转写、delayedTime、查询路径 |
| `examples/future_position_indicator.dos` | 商品期货持仓指标定制化设计与扩展 | 测试持仓流 + 行情流 as-of 关联与指标计算 |
| `examples/l2_delayed_trade_factor.dos` | 处理 Level-2 行情数据实例 / 延时成交订单因子 | 测试 left semi join、状态函数、时间序列级联 |
| `examples/hf_money_flow_factor.dos` | 实时计算高频因子 / 资金净流入比例因子 | 测试 K 线聚合、buffer、fork、多窗口对齐 |
| `examples/avg_press_factor.dos` | 金融因子流式实现 / 移动平均买卖压力 | 测试 reactiveStateEngine、标量 helper、mavg |

新增参考资料：

| 文件 | 作用 |
|---|---|
| `references/orca/orca_conversion_cases.md` | 汇总官方复杂流计算案例转写为 Orca 的结构映射和稳定规则。 |
