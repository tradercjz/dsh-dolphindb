# DolphinDB Backtest Script Review Checklist

## 需求一致性

- [ ] 策略理解覆盖用户的买入、卖出、调仓和风控要求。
- [ ] 缺失信息已列入假设或待确认项。
- [ ] 资产类型、频率、日期范围和交易逻辑一致。
- [ ] 使用的 `strategyGroup` 和 `dataType` 能在 manifests 中找到，或已明确标注为假设。
- [ ] 已读取对应 `refs/config_complete/<assetCategory>.jsonl`，并按该品种的 required 字段判断配置是否完整。

## Stage contract

- [ ] config complete artifact 包含 `status`、`config`、`missing_required_fields`、`question`。
- [ ] datasource table selection artifact 包含 `status`、`required_fields`、`signal_fields`、`selected_tables`、`reason`。
- [ ] datasource generation artifact 包含 `status`、`signal_schema`、`used_functions`、`datasource_constraints`、`script`、`reason`、`question`。
- [ ] initialize planning artifact 包含 `status`、`reason`、`functions`、`signals`、`indicator_graph`、`output_indicators`、`question`。
- [ ] initialize generation artifact 包含 `status`、`reason`、`context`、`datasource_signals`、`initialize_indicators`、`initialize_code`、`question`。
- [ ] callback planning artifact 包含 `status`、`reason`、`callbacks`、`question`。
- [ ] callback generation artifact 包含 `status`、`reason`、`callbacks`、`question`、`dependency_gap`。
- [ ] 所有 stage status 合法；若存在 `need_more_info`、`unsupported` 或 `blocked_by_upstream`，没有继续组装最终脚本。

## 数据源

- [ ] `data` 包含 `symbol`、`tradeTime`、`open`、`low`、`high`、`close`、`volume`、`amount`、`upLimitPrice`、`downLimitPrice`、`prevClosePrice`。
- [ ] 使用的库、表和字段来自 refs 或明确标注为假设。
- [ ] 额外 `signal` 字段确实是策略需要且不能由基础字段直接推导。
- [ ] `signal_schema.size` 与 `signal_schema.columns` 数量一致。
- [ ] `signal_schema.columns[*].index` 从 0 开始连续递增。
- [ ] 股票代码后缀转换为 `.XSHG` / `.XSHE`。
- [ ] 需要前复权时已处理复权。
- [ ] `used_functions` 中每个函数都有 bundled ref 和函数体。
- [ ] 使用 `gen_bk_singal` 时，`bk_map_dict_reverse` 已作为 datasource constraint 保留。

## Initialize / Callback 依赖

- [ ] callback 读取的 `msg[symbol]["signal"][i]` 与 datasource `signal_schema` 对齐。
- [ ] callback 读取的 signal `access_path` 与 signal index 完全一致。
- [ ] callback 读取的 `indicator[symbol]["key"]` 由 `initialize_indicators` 显式生成。
- [ ] callback 读取的 indicator `access_path` 与 indicator key 完全一致。
- [ ] callback 使用的 `context` key 已初始化或绑定。
- [ ] 不读取未声明的 `msg`、`indicator` 或 `context` 字段。
- [ ] 若 callback 缺 initialize 指标，已输出 `blocked_by_upstream` 和 `dependency_gap.missing_initialize_indicators`，并先修订 initialize。
- [ ] 不在 callback 中临时发明 initialize 应产出的指标。

## DolphinDB 语法

- [ ] 未混入 Python、pandas、JavaScript、SQLAlchemy 或 shell 语法。
- [ ] 表非空判断使用 `count(table) != 0`。
- [ ] 非表空值判断使用 `isNull(value).any()`。
- [ ] 字典或向量非空判断使用 `size(value) != 0`。
- [ ] LONG 字面量使用 `l` 后缀。
- [ ] 未使用不存在或未说明的高抽象 DolphinDB 函数。
- [ ] callback 未对 `msg`、`indicator` 等整层嵌套字典做布尔判断。
- [ ] 涉及交易时间时，必要处过滤早于 `config["startDate"]` 的数据。

## 最终脚本结构

- [ ] helper functions 在 datasource 前定义，且只包含实际使用的函数。
- [ ] datasource 在 config/initialize/callback 前生成 `data`。
- [ ] `config = dict(STRING, ANY)` 已定义。
- [ ] `config["context"] = dict(STRING, ANY)` 已定义。
- [ ] datasource constraints 需要的 context bindings 已写入 `config["context"]`。
- [ ] `initialize` 已加入 `callbacks` 字典。
- [ ] 所有生成的 callbacks 已加入 `callbacks` 字典。
- [ ] 创建回测引擎前处理同名 engine。
- [ ] `strategyGroup=securityCreditAccount` 时，datasource 已生成 `securityReference`，且 createBacktester 使用需要 `securityReference` 的签名。
- [ ] 调用 `Backtest::appendQuotationMsg(engine, data)`。
- [ ] 调用 `Backtest::appendEndMarker(engine)`。
- [ ] 调用 `Backtest::getReturnSummary(engine)`。

## 可续写状态

- [ ] 多轮 refinement 时，已有 compact intermediate state 可说明 config、datasource、initialize、callback、dependency gaps 和 revision history。
- [ ] 上游 artifact 变化后，已视作下游 artifact 失效并重新推导。

## 可移植性

- [ ] 不依赖 Python、uv、FastAPI、OpenAI SDK 或原仓库绝对路径。
- [ ] 只引用 `${SKILL_DIR}` 下的 skill 资源。
- [ ] 未要求用户安装或运行本项目依赖。
