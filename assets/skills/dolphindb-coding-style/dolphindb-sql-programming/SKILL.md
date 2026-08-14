---
name: dolphindb-sql-programming
description: >
  为 DolphinDB / DolphinScript SQL 编写、审查和优化提供规则集。
  Use when 用户需要编写、改写、审查或优化 DolphinDB SQL，包括 select/exec/update/delete、
  where 条件、group by/context by/cgroup by/pivot by、aj/wj/pwj、时间窗口、数组向量、
  SQL 元编程、分布式 SQL、执行计划和 SQL Trace。
---

# DolphinDB SQL 编程

## 使用流程

按以下流程使用本 skill：

1. 判断输入是否属于 DolphinDB / DolphinScript SQL。若不是，回复“请提供 DolphinDB SQL 或 DolphinScript 表查询代码。”
2. 明确任务意图：过滤与分区、时序关联与窗口、分组与组内计算、结果整形、SQL 元编程、执行语义或性能优化。
3. 明确输出形态：每组一行、明细等长、累计分组、二维透视、左表等长、数组向量、动态查询结果或更新删除结果。
4. 依据本文件规则选择 SQL 入口。需要案例时，阅读对应 `references/scene-*.md`。
5. 审查代码时，按各章节的反例和检查清单确认是否需要改写。若代码已符合规则，直接说明无需改写。

## 总规则

### 规则 01：DolphinDB SQL 不是标准 SQL 的简单扩展

DolphinDB SQL 与 DolphinScript 变量、函数、向量函数、时序连接、数组向量、元编程和分布式执行机制共同工作。不要用普通 SQL 惯性替代 `context by`、`cgroup by`、`pivot by`、`aj/wj/pwj` 等 DolphinDB 专用入口。

### 规则 02：数据已在表中时，优先保留 SQL 承载层

过滤、投影、分组、关联、窗口、透视、更新、删除和结果整形都可在 SQL 内完成。过早取出列向量、子表或中间表，会增加扫描、合并和重新分组成本。

### 规则 03：SQL 可直接衔接 DolphinScript 变量和函数

SQL 可引用脚本变量、表对象、自定义函数和内置函数，也可作为变量值、函数参数和返回值。未使用 catalog 时，分布式表应通过 `loadTable` 等函数取得表对象后查询。

### 规则 04：标准 SQL 写法可用，但写入方式需判断

DolphinDB 支持 `create table`、`insert into`、`select` 等标准 SQL 风格，也支持 catalog 访问分布式表。分布式表大量写入时，一般优先评估 `append!` 或 `tableInsert`，不要默认使用 `insert into`。

### 规则 05：先按输出形态选择分组入口

每组一行使用 `group by`；明细等长输出使用 `context by`；累计分组输出使用 `cgroup by`；二维透视使用 `pivot by`。入口选择应由输出形态决定，而不是只看是否存在分组键。

### 规则 06：过滤阶段优先缩小数据范围

能用键集合过滤时，优先 `exec key from dim where ...` 得到键向量，再用 `where key in keys` 过滤主表。仅为筛选主表而做 `join`，通常会引入不必要的连接成本。

### 规则 07：`where` 条件需要区分普通条件和序列条件

普通条件可使用逗号或 `and`，并优先放置高选择性条件。条件包含 `deltas`、`ratios`、`ffill`、`move`、`prev`、`cumsum` 等序列相关函数时，应使用 `and`，避免逗号的逐层过滤改变序列上下文。

### 规则 08：分布式查询必须检查分区剪枝

分布式查询应尽量使用分区列或系统可识别的分区表达式。不要对分区列使用字符串格式化、任意算术、链式比较，或使用非分区时间列期待分区剪枝。分布式查询的 `where` 子句不应使用 `sum`、`count` 等聚合函数。必要时使用 `sqlDS` 或 `[HINT_EXPLAIN]` 检查扫描分区。

### 规则 09：时间语义先于函数选择

最近历史匹配使用 `aj`；左表记录匹配右表时间范围并聚合使用 `wj` 或 `pwj`；固定时间粒度聚合使用 `bar`；需要补齐空桶使用 `interval`；按时间列滑动使用 `tmsum`、`tmavg` 或 `twindow`。

### 规则 10：时间窗口单位必须匹配时间列类型

涉及 `wj/pwj`、`interval`、`tm*`、`twindow` 时，应明确时间列类型、窗口方向、窗口单位、是否补齐空桶、是否使用交易日历。`DATETIME` 场景中 `0:4` 表示秒级范围，不表示 4 分钟，应写成 `0m:4m`。

### 规则 11：组内顺序是 SQL 结果语义的一部分

使用前值、差分、累计、滑窗、`limit`、`first`、`last` 等逻辑时，应明确组内顺序。需要排序时使用 `context by ... csort ...`，不要依赖未说明的原始顺序。

### 规则 12：`context by` 的执行顺序需要单独审查

`context by ... csort ... limit ... select ... order by` 的顺序为：分组、组内排序、组内限制行数、执行 `select`、最后全局排序。存在 `context by` 时，`limit` 先于 `order by`；不存在 `context by` 时，`limit` 在 `order by` 后执行。

### 规则 13：累计、连续段和区间统计使用专用入口

累计分组使用 `cgroup by` 并显式 `order by`；连续相同值或连续满足条件的数据段使用 `segment`；按金额、价格、指标值落入有序区间统计时使用 `asof(range, value)`；按累计成交量等阈值切分窗口时检查 `volumeBar` 或 `accumulate`；组内 TopN 后聚合优先检查 `aggrTopN`。

### 规则 14：结果整形优先使用 DolphinDB SQL 扩展

函数返回多列时使用复合字段命名；同构多档列使用 `fixedLengthArrayVector`；组内多行收集使用 `toArray`；长表转宽表和二维透视使用 `pivot by`；透视后按行计算使用 `rowSum` 等行函数。

### 规则 15：动态 SQL 先判断动态点

动态点可能是列名、列集合、函数名、窗口参数、过滤条件、分组字段、排序字段或批量查询模板。简单动态列名优先使用 `_$name`、`_$$name` 或字段序列；复杂表达式再使用 `sql`、`sqlCol`、`makeCall`、`expr` 等结构化元编程入口。

### 规则 16：结构化元编程优先于字符串拼接

运行期构造 SQL 时，优先使用 `sql`、`sqlCol`、`sqlColAlias`、`makeCall`、`makeUnifiedCall`、`expr`、`unifiedExpr`、`binaryExpr`。字符串拼接和 `parseExpr` 只适合边界简单且输入可信的表达式。

### 规则 17：动态更新、删除和解析表达式要检查上下文

动态 `update/delete` 使用 `sqlUpdate`、`sqlDelete`。删除条件中避免变量名与列名大小写冲突。`parseExpr` 不会自动查找函数体内局部变量，表达式依赖局部变量时，应通过字典传入上下文。

### 规则 18：分布式 SQL 优先直接查询源表

分布式表上的过滤、派生列、分组和聚合应尽量保留在同一条 SQL 中。先把分区数据合并为内存表再计算，会失去分布式并行能力并增加中间数据。

### 规则 19：确认分组不跨分区时可使用 `map`

若分区粒度大于分组粒度，并确认每个分组不会跨分区，可在 `group by` 后加 `map`，减少全局二次汇总。使用前必须确认分区方案与分组键关系。

### 规则 20：性能优化优先检查查询组织

多条 SQL 分步生成中间表、先连接后过滤、分组粒度过细、字符串转换过多、未命中分区列，均应优先审查。优化顺序应为减少扫描、合并查询、调整分组粒度、下推过滤，再考虑单个函数替换。

### 规则 21：执行计划和 Trace 用于验证查询行为

`[HINT_EXPLAIN]` 用于查看 SQL 执行计划，分布式查询重点观察 `map`、`merge`、扫描分区和行数。`[HINT_KEEPORDER]` 用于保留 `context by` 前的原始顺序。SQL Trace 使用 `setTraceMode`、`getTraces`、`viewTraceInfo` 分析复杂 SQL 内部耗时；`setTraceMode(true)` 必须单独执行，不能和待跟踪 SQL 放在同一段脚本中。

## 场景划分

### 场景 01：SQL 与 DolphinScript 衔接

SQL 中使用脚本变量、函数、表对象、catalog、标准 SQL 写法、动态更新删除和变量命名时，阅读 [references/scene-01-SQL与DolphinScript衔接.md](references/scene-01-SQL与DolphinScript衔接.md)。

### 场景 02：时序关联与时间窗口 SQL

任务涉及 `aj/wj/pwj`、`bar/interval`、`tm*`、`twindow`、交易日历窗口或累计量窗口时，阅读 [references/scene-02-时序关联与时间窗口SQL.md](references/scene-02-时序关联与时间窗口SQL.md)。

### 场景 03：分组、累计分组与组内排序

任务涉及 `group by/context by/cgroup by`、`csort`、`limit`、组内滑窗、连续段、区间统计或组内 TopN 聚合时，阅读 [references/scene-03-分组、累计分组与组内排序.md](references/scene-03-分组、累计分组与组内排序.md)。

### 场景 04：结果整形、复合字段与数组向量

任务涉及复合字段、数组向量、`toArray`、`pivot by`、字段序列、透视后行级计算时，阅读 [references/scene-04-结果整形、复合字段与数组向量.md](references/scene-04-结果整形、复合字段与数组向量.md)。

### 场景 05：SQL 元编程与动态字段

任务涉及动态 SQL、宏变量、字段序列、动态函数调用、`sqlUpdate/sqlDelete`、`parseExpr` 或批量相似查询时，阅读 [references/scene-05-SQL元编程与动态字段.md](references/scene-05-SQL元编程与动态字段.md)。

### 场景 06：SQL 执行语义与性能优化

任务涉及执行顺序、`where` 语义、分区剪枝、`where in`、`map`、执行计划、SQL Trace 或综合优化时，阅读 [references/scene-06-SQL执行语义与性能优化.md](references/scene-06-SQL执行语义与性能优化.md)。

## 参考文件

1. [references/SQL规则全集.md](references/SQL规则全集.md)  
   提供完整规则来源，用于制作或修订本 skill。

2. [references/SQL案例归类与规则补充.md](references/SQL案例归类与规则补充.md)  
   提供案例矩阵、反例素材和测试样本来源。

3. `references/scene-*.md`  
   提供各场景的规则、典型写法、反例、检查清单和可转测试样本。

## 输出要求

根据任务类型选择输出模式，保持简洁。

1. 路线判断  
   输出至少包含：任务类型、推荐 SQL 入口、选择理由、仍需确认的前提。

2. 代码改写  
   输出至少包含：当前写法的问题、推荐 SQL 入口、改写代码、需要注意的执行语义。

3. 审查与优化  
   输出至少包含：主要风险、证据、推荐改写方向、是否需要执行计划或 Trace 验证。若现有代码已符合 SQL 编程规范，直接输出：`代码符合 DolphinDB SQL 编程规范，无需改写。`

4. 信息不足  
   明确说明缺失信息；涉及性能判断时，说明是否需要表结构、分区方案、数据规模、排序列、执行计划或 Trace。
