# 阶段与脚本块索引

本索引用于把 ML 工作流中的判断步骤映射到 `scripts/` 下的一次性 DolphinDB 脚本块。脚本是参考模块，不是固定流水线；只复制当前阶段需要的块，并按真实库表、列名和用户目标替换占位变量。

## 总原则

- 先读对应 reference，再选脚本块。
- 任何脚本块执行前都要确认输入变量已由前序块或平台工具产生。
- 不要整文件运行脚本；不要定义或调用自定义 `web*` 函数。
- 脚本块输出用于形成可审计证据，最终聊天回答还需要解释选择理由、风险和下一步。

## 数据源发现与预览

参考：

- `references/query-guidance.md`
- `scripts/query_reference.dos`

常用脚本块：

- 块 1-5：发现 DFS 数据库和表。
- 块 6-8：校验库表、读取 schema、行数和预览。
- 块 9-10：schema 类型统计和字段关键词搜索。
- 块 17-20：物理画像、整库候选表画像、时间列和状态/标签列摘要。
- 块 23：查询 SQL 摘要。

## 原始建模数据选择

参考：

- `references/raw-data-selection-guide.md`
- `references/query-guidance.md`
- `references/role-policy.md`

常用脚本块：

- `query_reference.dos` 块 11-16：有界过滤、时间范围预览、聚合、join 质量检查、分页和结果摘要。
- `query_reference.dos` 块 21-22：月度聚合和 lag 示例，可作为时间聚合建模基础表参考。
- `role_reference.dos` 块 1-9、13：角色候选、实体/时间/标签分布、未来窗口必要条件和下游角色包摘要。

## 字段角色推断

参考：

- `references/role-policy.md`
- `scripts/role_reference.dos`

常用脚本块：

- 块 1-2：基础角色候选和评分表。
- 块 3-5：实体、时间、标签 profile。
- 块 6-8：领域适配、监督学习适配、未来窗口检查。
- 块 9-13：角色结论、工业语义角色、source mode、确认清单和下游角色包。

## 数据清洗

参考：

- `references/cleaning-guidance.md`
- `scripts/cleaning_reference.dos`

常用脚本块：

- 块 1-3：清洗前基线、缺失率、常量列。
- 块 4-7：重复行、业务 key、空标签、非法枚举。
- 块 8-13、18：数值填充、异常标记、winsorize 和填充标记。
- 块 15-17：业务 key 去重和行列缺失阈值决策。
- 块 19-22：质量码、单位、时间间隔和信号异常。
- 块 14、23-24：清洗摘要、标签编码映射、风险和警告。

## 特征工程

参考：

- `references/feature-guidance.md`
- `scripts/feature_reference.dos`

常用脚本块：

- 块 1、10-12：候选特征、排除原因、紧凑摘要和对齐检查。
- 块 2-6：缺失指示、缩放、日历和布尔标记。
- 块 7-9、22：lag、rolling 和变化量。
- 块 13-16：winsorize+zscore、top-N、月度/周期索引和聚类预处理表。
- 块 17-23：特征选择报告、批量扩展、周期编码、one-hot、交互和宽特征摘要。

## 分类

参考：

- `references/model-selection-guide.md`
- `references/classification-model-catalog.md`
- `scripts/classification_reference.dos`

常用脚本块：

- 块 1、24：标签分布和标签编码。
- 块 11-12：模型函数可用性和候选模型表。
- 块 13-14：train/val/test 切分和空切分检查。
- 块 23：训练集欠采样，仅用于类别不均衡且只作用于训练集。
- 块 15-22：候选模型训练、网格结果、最佳候选、风险报告、test 评估和模型选择摘要。
- 块 4-10：快速 baseline 训练、预测、指标、混淆矩阵、当前样本打分和结果摘要。

## 回归

参考：

- `references/model-selection-guide.md`
- `references/regression-model-catalog.md`
- `scripts/regression_reference.dos`

常用脚本块：

- 块 1：目标分布。
- 块 11-12：模型函数可用性和候选模型表。
- 块 13-14：train/val/test 切分和空切分检查。
- 块 15-22：候选模型训练、网格结果、最佳候选、风险报告、test 评估和模型选择摘要。
- 块 2-10：快速 baseline 切分、随机森林、预测、指标、残差、误差样本、当前样本打分和结果摘要。

## 聚类

参考：

- `references/model-selection-guide.md`
- `references/clustering-model-catalog.md`
- `scripts/clustering_reference.dos`

常用脚本块：

- 块 1-3：聚类特征表、缺失检查和 k 规模检查。
- 块 11-12：模型函数可用性和候选模型表。
- 块 13-16：winsorize+zscore、PCA+kmeans 候选、中心距离和近似 silhouette。
- 块 17-23：候选结果、最佳候选、风险报告、轻量搜索、最终分配和模型选择摘要。
- 块 4-10：快速 kmeans 训练、分配、簇规模、画像、代表样本和摘要。
