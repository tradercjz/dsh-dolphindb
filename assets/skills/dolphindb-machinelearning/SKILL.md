---
name: dolphindb-machinelearning
description: "DolphinDB Web 侧机器学习数据工作流技能。用于数据清洗、特征工程、分类、回归和聚类的机器学习任务。"
---

# 用途

将本技能作为 DolphinDB Web 侧 ML 链路的唯一入口。它覆盖从数据源发现、原始建模数据选择、角色推断、清洗、特征工程到分类、回归和聚类的一次性聊天交付。

本技能提供的是“决策规则 + 脚本块参考”，不是硬编码流水线。Agent 应根据用户目标、schema、样本和当前平台能力选择必要模块；脚本块用于提供可执行写法和审计证据，不能替代业务判断。


# 约束

- DOS 资源是一次性脚本块，不是函数库。复制脚本块并替换占位变量；不要整文件运行，不要定义或调用自定义函数。若平台已有等价工具或执行器，可以复用工具实现，但必须遵守 reference 中的阶段约束和输出说明。
- 查询必须有界并经过 schema 校验；不要编造数据库名、表名或列名。
- 原始建模数据选择必须在清洗前完成。涉及未来窗口标签时，标签应在原始数据阶段物化；不要把“未来标签稍后在特征工程中构建”作为默认方案。
- 角色推断时，用户显式选择优先于启发式规则。监督学习标签有歧义时，必须请求确认。
- 清洗和特征工程是默认强制确认点。清洗结果出来后必须汇报清洗方案、行列影响、填充/删除/标记数量、跳过步骤和警告，并等待用户确认；特征工程结束后必须汇报特征构建方案、特征族、数量、排除原因、泄漏检查和对齐结果，并等待用户确认。
- 分类和回归训练必须先用 `sqlDS(<select * from webTrain>)` 构造训练数据源；预测输入必须是 table。聚类必须先把动态特征列构造成 table，再调用 `kmeans` 或 `predict`。同一类 ML API 连续失败 2 次后，先跑最小 API 验证，不要扩大脚本继续猜。
- 分类标签必须使用从 0 开始的整数编码列。原始标签是字符串、SYMBOL、yes/no 或非连续编码时，先运行分类标签编码块，再用编码列作为 `webLabelCol`。
- 分类任务遇到明显类别不均衡时，只把欠采样作为默认内置处理方式；欠采样只能作用于训练数据，不能改变验证集和测试集的原始类别分布。

# 路由

先判断请求类型，再按对应模块链路执行。每个链路都先读取本文件和 `dolphindb-machinelearning/references/stage-script-map.md`，再只读取当前任务需要的 reference 和 DOS 文件。

- 查询、预览、过滤、聚合、join、schema 发现：使用 query 模块。读取 `dolphindb-machinelearning/references/query-guidance.md`，需要脚本时读取 `dolphindb-machinelearning/scripts/query_reference.dos`。
- 字段角色推断：使用 role 模块。读取 `dolphindb-machinelearning/references/role-policy.md`，需要脚本时读取 `dolphindb-machinelearning/scripts/role_reference.dos`。
- 原始建模数据选择：执行 query -> role -> raw-data selection。读取 `dolphindb-machinelearning/references/raw-data-selection-guide.md`，并按需参考 `query_reference.dos` 与 `role_reference.dos` 的聚合、join、未来窗口和角色摘要块。
- 数据清洗：执行 query -> role -> raw-data selection -> cleaning。读取 `dolphindb-machinelearning/references/cleaning-guidance.md` 和 `dolphindb-machinelearning/scripts/cleaning_reference.dos`。
- 特征工程：执行 query -> role -> raw-data selection -> cleaning -> feature。读取 `dolphindb-machinelearning/references/feature-guidance.md` 和 `dolphindb-machinelearning/scripts/feature_reference.dos`。
- 分类：执行 query -> role -> raw-data selection -> cleaning -> feature -> classification。先读取 `dolphindb-machinelearning/references/model-selection-guide.md`，再读取 `dolphindb-machinelearning/references/classification-model-catalog.md` 和 `dolphindb-machinelearning/scripts/classification_reference.dos`。
- 回归：执行 query -> role -> raw-data selection -> cleaning -> feature -> regression。先读取 `dolphindb-machinelearning/references/model-selection-guide.md`，再读取 `dolphindb-machinelearning/references/regression-model-catalog.md` 和 `dolphindb-machinelearning/scripts/regression_reference.dos`。
- 聚类：执行 query -> role -> raw-data selection -> cleaning -> feature -> clustering。先读取 `dolphindb-machinelearning/references/model-selection-guide.md`，再读取 `dolphindb-machinelearning/references/clustering-model-catalog.md` 和 `dolphindb-machinelearning/scripts/clustering_reference.dos`。

上述链路是默认推荐顺序。若用户已经提供可验证的中间结果，可以从最晚的已验证阶段继续，不要机械重跑 query、role、cleaning 或 feature。

# 快速路径

- 只有查询、预览、过滤、聚合、join 或 schema 发现时，执行 query 模块即可。
- 已有 `webFeatures`、`webFeatureCols` 和明确标签/目标列时，可做最小 schema、角色和泄漏检查后直接进入分类或回归。
- 已有 `webFeatures`、`webFeatureCols` 和明确聚类粒度时，可做最小连续数值特征检查后直接进入聚类。
- 已有用户确认的字段角色时，优先沿用该结论；只在 schema 变化、列缺失或角色冲突时重新推断。
- 用户明确要求快速 baseline 时，可只执行必要的数据检查、候选模型可用性、切分、训练和评估；将跳过的清洗、特征或网格步骤写入聊天说明。

# 确认策略

- 阶段强制确认：清洗阶段结束后必须停止确认；特征工程阶段结束后必须停止确认。即使当前方案低风险，也要先把方案和结果发给用户，询问是否继续进入下一阶段。
- 原始建模数据选择不是默认强制确认点，但必须在进入清洗前说明目标列、预测窗口、选表/字段理由、标签来源和泄漏排除。若标签、实体、时间粒度、未来窗口或字段泄漏边界不清楚，必须请求用户确认。
- 其他必须停止确认：标签/正类/未来窗口规则不明确，字段角色有多个合理选择，业务 key 压缩或去重规则会改变事件语义，大量删除行或过滤质量码，特征存在泄漏风险，高风险模型结论需要业务解释。
- 可以继续但要说明：只读画像、缺失率统计、异常标记、标准化/归一化、缺失指示、日历特征、候选模型可用性检查、低风险网格候选比较；但一旦完成 cleaning 或 feature 阶段，仍必须按阶段强制确认停止。
- 用户要求逐步确认时，每个阶段都输出方案和结果并等待确认。

# 流程

1. 识别任务类型：是分类、回归或聚类，还是单纯数据清洗，特征工程
2. 如果数据源未知，使用 query 模块的元数据块发现可见 DFS 数据库和表，按领域关键词筛选候选项，校验 `existsDatabase`、`existsTable`、schema、行数和样本。
3. 使用 role 模块推断或确认实体列、时间列、标签列、候选特征、工业语义角色和 source mode；用户显式选择覆盖启发式规则。
4. 在清洗前完成原始建模数据选择：说明选表、选字段、聚合或 join 口径、目标列、预测窗口、标签来源字段、特征时间截止点和泄漏排除项。涉及未来窗口标签时，先物化未来标签再进入清洗。
5. 进入清洗时，按“诊断/画像 -> 决策表 -> 执行块 -> 摘要块”组合必要脚本，输出清洗方案、行数影响、填充/删除/标记数量、跳过步骤和警告；停止并询问用户是否确认该清洗结果并继续。
6. 用户确认清洗结果后，再进入特征工程。
7. 进入特征工程时，默认尽量多构造安全候选特征：数值变换、缺失/状态标记、低基数 one-hot、日历/周期、交互、滞后、滚动和变化量；随后做泄漏审计、对齐检查和模型相关筛选，输出特征构建方案、来源列、特征族、数量、排除原因和泄漏风险；停止并询问用户是否确认该特征结果并继续。
8. 用户确认特征结果后，再进入分类、回归或聚类。
9. 进入分类时，确认标签或未来窗口标签来源，只使用预测时点及之前可获得的特征，先确认 `sqlDS -> train -> predict(table)` 最小链路可用；若类别明显不均衡，在 train/val/test 后运行训练集欠采样块，再按“模型可用性 -> 候选模型表 -> train/val/test -> 可选训练集欠采样 -> 网格计划 -> 网格候选评估 -> 最佳候选 -> test 评估 -> 风险报告 -> 聊天摘要”选择脚本块。
10. 进入回归时，确认数值目标，先确认 `sqlDS -> train -> predict(table)` 最小链路可用，再按“模型可用性 -> 候选模型表 -> train/val/test -> 网格计划 -> 网格候选评估 -> 最佳候选 -> test 评估 -> 风险报告 -> 聊天摘要”选择脚本块。
11. 进入聚类时，确认分析粒度和连续数值特征，不要求标签，先确认 `select feature table -> kmeans -> predict(table)` 最小链路可用，再按“模型可用性 -> 候选模型表 -> 预处理 -> 网格计划 -> k/preprocess/model 候选评估 -> 最佳候选 -> 簇画像 -> 风险报告 -> 聊天摘要”选择脚本块。
12. 最终聊天输出必须说明数据源、过滤和样本范围、字段角色、原始建模数据口径、清洗和特征方案、模型或聚类方法、关键指标或画像、局限和下一步最小动作。

# 停止条件

- 数据源未知，且目录/schema 发现无法识别合理候选表。
- 请求的数据库、表或列不存在，或 Web 运行时不可见。
- 必需的过滤条件、连接键、指标定义、实体列、时间列或分析粒度不明确，且无法从 schema 或样本行推断。
- 分类没有历史标签、事件表、状态字段或用户确认的规则来派生标签。
- 回归无法推断或确认数值目标标签。
- 聚类在清洗和角色排除后没有可用的连续数值特征候选。
- 清洗阶段已经产出清洗结果但用户尚未确认。
- 特征工程阶段已经产出特征结果但用户尚未确认。
- 清洗方案、特征方案、标签规则或高风险选择按确认策略必须用户确认。
- 请求需要无界全表输出、共享业务数据或隐藏 DDL。

# 包内文件

- `dolphindb-machinelearning/SKILL.md`：单技能入口文档，定义用途、约束、路由、流程、停止条件和包内文件清单。
- `dolphindb-machinelearning/references/query-guidance.md`：查询规则指南，说明数据源发现、SQL 约束和聊天输出要求。
- `dolphindb-machinelearning/references/role-policy.md`：字段角色推断策略，说明实体、时间、标签、特征和工业语义角色的确认规则。
- `dolphindb-machinelearning/references/raw-data-selection-guide.md`：原始建模数据选择指南，说明未来窗口标签、泄漏排除、字段保留和原始确认内容。
- `dolphindb-machinelearning/references/stage-script-map.md`：阶段到脚本块的索引，说明每个阶段应参考哪些 reference 和脚本块。
- `dolphindb-machinelearning/references/cleaning-guidance.md`：数据清洗指南，说明缺失、重复、异常、质量码、单位和工业清洗策略。
- `dolphindb-machinelearning/references/feature-guidance.md`：特征工程指南，说明特征族选择、血缘、泄漏控制、预处理和特征筛选策略。
- `dolphindb-machinelearning/references/model-selection-guide.md`：统一模型选择教程，说明分类、回归和聚类如何选择候选模型、指标、网格搜索边界和最佳候选解释。
- `dolphindb-machinelearning/references/classification-model-catalog.md`：分类模型目录，说明默认模型顺序、指标、网格搜索和模型选择输出。
- `dolphindb-machinelearning/references/regression-model-catalog.md`：回归模型目录，说明默认模型顺序、评估指标、网格搜索和模型选择输出。
- `dolphindb-machinelearning/references/clustering-model-catalog.md`：聚类模型目录，说明默认 k-means 模型、聚类数候选和输出要求。
- `dolphindb-machinelearning/scripts/query_reference.dos`：查询和元数据发现的一次性 DolphinDB 脚本块参考，覆盖数据库/表发现、schema 检查、表画像、字段搜索、有界过滤、聚合、join 校验、月度聚合、分页采样和结果摘要。
- `dolphindb-machinelearning/scripts/role_reference.dos`：字段角色推断的一次性 DolphinDB 脚本块参考，覆盖角色候选评分、实体/时间/标签质量检查、工业语义角色、source mode、监督学习适配、未来窗口检查和角色摘要。
- `dolphindb-machinelearning/scripts/cleaning_reference.dos`：数据清洗的一次性 DolphinDB 脚本块参考，覆盖缺失率、常量列、重复 key、非法值、填充、异常标记、winsorize、质量码、单位标准化、stuck/spike/jump 检测、标签编码和清洗摘要。
- `dolphindb-machinelearning/scripts/feature_reference.dos`：特征工程的一次性 DolphinDB 脚本块参考，覆盖标准化、归一化、缺失指示、布尔标记、日历/周期特征、批量数值扩展、低基数 one-hot、数值交互、lag、rolling、变化量、月度/周期索引、特征对齐、筛选和摘要。
- `dolphindb-machinelearning/scripts/classification_reference.dos`：分类训练、预测、评估和风险打分的一次性 DolphinDB 脚本块参考，覆盖标签分布、训练集欠采样、模型可用性、候选模型、切分、随机森林/logistic/朴素贝叶斯/GLM/AdaBoost、预测、accuracy、混淆矩阵、precision/recall/F1、网格计划、轻量网格搜索、最佳候选 test 评估、风险报告和摘要。
- `dolphindb-machinelearning/scripts/regression_reference.dos`：回归训练、预测、评估和当前特征打分的一次性 DolphinDB 脚本块参考，覆盖目标分布、模型可用性、候选模型、切分、随机森林/ridge/lasso/elastic net/GLM/AdaBoost、预测、MAE/RMSE/R2/MAPE、残差、误差样本、网格计划、轻量网格搜索、最佳候选 test 评估、风险报告和摘要。
- `dolphindb-machinelearning/scripts/clustering_reference.dos`：聚类训练、分配和画像统计的一次性 DolphinDB 脚本块参考，覆盖聚类特征表、缺失检查、winsorize+zscore、k 值规模检查、kmeans/PCA+kmeans、簇规模、画像、中心距离、近似 silhouette、代表样本、网格计划、候选搜索、风险报告和摘要。
