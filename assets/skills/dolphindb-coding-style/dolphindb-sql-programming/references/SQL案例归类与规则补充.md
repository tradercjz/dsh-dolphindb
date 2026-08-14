# SQL 案例归类与规则补充

资料来源：`参考文档/00_入门到精通/ddb_sql_cases.md`

本文件用于补充 `00-第六章SQL编程整理方案.md`。原第六章更适合作为语法与能力索引，本文件中的案例更适合作为 agent 编码、审查和测试样本。

## 一、规则补充

### 规则 A：能用键集合过滤时，不应先做表连接

如果任务只是根据另一张表中的键集合筛选主表，优先从右表取出键向量，再在主表中使用 `where key in keys`。`join` 更适合补充字段或构造宽结果；仅用于过滤时通常会引入额外连接成本。

### 规则 B：分布式查询的 `where` 子句应避免聚合函数

分布式查询需要先根据 `where` 条件确定涉及的分区。若 `where` 中出现 `sum`、`count` 等聚合函数，查询无法在过滤阶段完成分区范围判断。聚合条件应放入后续分组、`having` 或独立查询阶段。

### 规则 C：`where` 多条件写法必须区分序列相关条件

条件与序列无关时，逗号和 `and` 结果等价，过滤能力强的条件可放在更靠前的位置。条件包含 `deltas`、`ratios`、`ffill`、`move`、`prev`、`cumsum` 等序列相关函数时，应使用 `and`，避免逗号的逐层过滤改变序列上下文。

### 规则 D：分区列过滤必须保持可识别表达式

分布式表查询应尽量让 `where` 条件直接命中分区列或可被系统识别的分区表达式。不要对分区列套用字符串格式化、任意算术、链式比较，或使用非分区列期待分区剪枝。必要时使用 `sqlDS` 或 `[HINT_EXPLAIN]` 检查扫描范围。

### 规则 E：分布式表优先直接查询源表

对于分布式表，不宜先把分区数据合并成内存表再继续 `group by`。可直接写在分布式表上的过滤、派生列、分组和聚合，应尽量保留在同一条查询中，以利用分区并行和减少中间结果。

### 规则 F：分组结果不跨分区时可使用 `map`

若分区粒度大于分组粒度，并且每个分组的完整数据不会跨分区，可在 `group by` 后使用 `map`，减少全局二次汇总。使用前必须确认分区方案与分组键之间的包含关系。

### 规则 G：组内顺序计算优先使用 `context by`

每组内部需要保留明细长度，并使用 `mwavg`、`ratios`、`deltas`、`cumsum`、`limit`、前值或滑动窗口等顺序相关函数时，应优先使用 `context by`，并根据需要声明 `csort`。不要在脚本层逐个分组查询再合并。

### 规则 H：累计分组使用 `cgroup by`，并显式排序

需要按时间或其他有序字段逐步扩大聚合范围时，优先使用 `cgroup by`。`cgroup by` 必须与 `order by` 配合，并且只能使用受支持的聚合函数集合。

### 规则 I：连续区间分组优先使用 `segment`

根据连续相同值、连续满足条件的数据段进行分组时，优先使用 `segment` 生成组标识，再结合 `group by` 或 `context by`。不应手工维护分组编号和前后状态。

### 规则 J：数值区间归类优先检查 `asof`

当任务是把数值映射到一组有序区间，再按区间统计时，优先使用 `asof(range, value)`。相比手写多段 `iif` 或循环生成区间标签，`asof` 表达更直接，也更适合批量分组。

### 规则 K：二维重排和组合价值计算优先使用 `pivot by`

需要把长表按两个维度展开为宽结果，或先做透视后按行计算时，优先使用 `pivot by`，并结合 `last`、`avg`、`ffill`、`rowSum` 等函数。不要手工为每个类别生成列并逐行填值。

### 规则 L：多市场、多表归并应先过滤，后合并

多个分布式表参与同一结果时，优先在各自源表中完成日期、代码、因子等过滤，并尽量使用 `in` 下推键集合。只有在每侧结果已缩小后，再考虑 `merge`、`unionAll` 或矩阵合并。

### 规则 M：动态 SQL 优先使用结构化元编程入口

运行期生成 SQL 时，优先使用 `sql`、`sqlCol`、`sqlColAlias`、`makeCall`、`expr` 等结构化入口。字符串拼接和 `parseExpr` 只适合非常简单且边界明确的表达式。

### 规则 N：批量相似查询可封装为元编程函数

当每天需要执行一批结构相同、过滤值不同的查询时，可封装为生成查询列表的函数，再批量 `eval` 并合并结果。若需要在集群内长期复用，可注册为 function view。

## 二、案例归类矩阵

| 案例 | 来源小节 | 原写法或基准写法 | 推荐写法 | 提炼规则 | 目标场景 |
| --- | --- | --- | --- | --- | --- |
| 行业过滤 | 2.1 | `lj(t1, t2, \`SecurityID)` 后按行业过滤 | 先从 `t2` 取行业对应 `SecurityID`，再 `where SecurityID in SecurityIDs` | A | scene-06 SQL执行语义与性能优化 |
| 分组后过滤再聚合 | 2.2 | `context by having` 过滤后再外层 `group by` | `group by` 内使用 `aggrTopN(std, LastPx, Volume, 0.25, false)` | E, G | scene-03 分组、累计分组与组内排序 |
| 非序列条件过滤 | 2.3.1 | 多个普通条件使用逗号或 `and` | 两者结果一致；优先把高选择性条件放前 | C | scene-06 SQL执行语义与性能优化 |
| 序列条件过滤 | 2.3.2 | 逗号连接普通条件和 `ratios(qty)` | 使用 `and` 保持原表序列上下文 | C | scene-06 SQL执行语义与性能优化 |
| 分区剪枝 | 3.1 | `temporalFormat(DateTime, ...)` 后比较字符串 | `date(DateTime) between 2020.06.01 : 2020.06.02` | D | scene-06 SQL执行语义与性能优化 |
| 分布式 group by | 3.2 | 先查询到内存表 `tmp_t`，再分组 | 在分布式源表中直接派生 `Flag` 并 `group by` | E | scene-06 SQL执行语义与性能优化 |
| 分组查询使用 `map` | 3.3 | 普通 `group by SecurityID, bar(DateTime, 60)` | 在确认分组不跨分区后加 `map` | F | scene-06 SQL执行语义与性能优化 |
| 每组最新 N 条 | 4.1 | 对比 OLAP 与 TSDB 存储引擎 | `context by SecurityID csort DateTime limit -10`；时间点查询优先考虑 TSDB 排序列 | G | scene-03 分组、累计分组与组内排序 |
| 滑动 VWAP | 4.2 | 循环每只股票，反复 `exec` 再 `mwavg` | `select mwavg(price, volume, 4) from t context by symbol` | G | scene-03 分组、累计分组与组内排序 |
| 累积 VWAP | 4.3 | 逐步累计每分钟数据 | `group by SecurityID cgroup by minute(DateTime) order by SecurityID, Minute` | H | scene-03 分组、累计分组与组内排序 |
| 最近 N 股 VWAP | 4.4 | 自定义聚合函数中循环倒序累计 | 自定义聚合函数内部使用 `cumsum` 和向量下标定位 | G | scene-03 分组、累计分组与组内排序 |
| 价格变化率连续段 | 4.5 | 按连续相同报价分段统计 | `group by SecurityID, segment(OfferPrice1, false)` | I | scene-03 分组、累计分组与组内排序 |
| 连续区间最值 | 4.6 | 自定义函数手工维护分组编号 | `context by segment(value >= targetVal)` 后 `having` 过滤 | I | scene-03 分组、累计分组与组内排序 |
| 不同标签不同聚合 | 4.7 | 按标签分别写不同查询 | 字典保存标签到函数的映射，在自定义聚合函数中调用，再 `pivot by` | K, M | scene-04 结果整形、复合字段与数组向量 |
| 月度收益波动率 | 4.8 | 手工生成月份或补齐周期 | `group by code, interval(date(date), 1, "prev")` | 时间分桶与补空桶 | scene-02 时序关联与时间窗口SQL |
| 股票组合价值 | 4.9 | 手工创建 AAPL/FB 列、逐行赋值、再 `ffill` | `select rowSum(ffill(last(weightedPrice))) from ETF pivot by Time, Symbol` | K | scene-04 结果整形、复合字段与数组向量 |
| IoT 测点分钟均值 | 4.9 | 手工按测点生成宽表并补值 | `pivot by bar(time, 60000), id` 后 `ffill(avg(value))` 与 `rowSum` | K | scene-04 结果整形、复合字段与数组向量 |
| 成交量分段时间窗口 | 4.10 | 手工维护累计成交量和窗口起点 | `accumulate` 生成分组起点，`ffill` 后聚合 | G, H | scene-02 时序关联与时间窗口SQL |
| 股票因子归整 | 4.11 | 先合并沪深结果，再 `lj` 维度表过滤，再 `pivot by` | 先取代码集合，各源表用 `SecurityID in sec` 过滤并 `pivot by`，最后合并矩阵 | A, L, K | scene-06 SQL执行语义与性能优化 |
| 交易额单子类型 | 4.12 | 四条 SQL 分别统计小单、中单、大单、特大单，再追加结果 | 用 `getType` 或 `asof(range, volume*price)` 生成类型后一次 `group by` | J | scene-03 分组、累计分组与组内排序 |
| 数值区间统计 | 4.12 | 循环生成区间标签，再 `reduce(add, ...)` | `group by date, code, asof(range, value)` | J | scene-03 分组、累计分组与组内排序 |
| 动态 SQL 案例 1 | 5.1 | 字符串拼接 SQL 后 `parseExpr(...).eval()` | 用 `sql`、`sqlCol`、`makeCall`、`sqlColAlias` 生成元代码 | M | scene-05 SQL元编程与动态字段 |
| 动态 SQL 案例 2 | 5.2 | 手写多条结构相同、过滤值不同的查询，再 `unionAll` | 封装 `bundleQuery` 生成查询列表，批量 `eval` 后合并 | N | scene-05 SQL元编程与动态字段 |

## 三、适合沉淀为测试样本的反例

### 反例 01：仅为过滤而使用 `join`

代码特征：先 `lj` 或 `join` 主表和维度表，随后只根据维度表的某列做 `where` 过滤，最终并不需要右表字段。  
推荐方向：先从维度表取键集合，再用 `where key in keys` 过滤主表。

### 反例 02：分布式查询中破坏分区剪枝

代码特征：在分区时间列上使用 `temporalFormat`、字符串转换、算术表达式、链式比较，或用非分区列作为主要时间过滤。  
推荐方向：改写为系统可识别的分区列过滤表达式，并用 `[HINT_EXPLAIN]` 或 `sqlDS` 检查。

### 反例 03：分布式表先转内存表再分组

代码特征：先 `select ... from dfsTable where ...` 得到内存表，再对内存表执行 `group by`。  
推荐方向：把派生列和分组表达式放回同一条分布式 SQL。

### 反例 04：组内顺序计算在脚本层循环

代码特征：先取 `distinct sym`，循环每个 `sym`，再从原表 `exec` 出向量并计算滑窗、累计或前值关系。  
推荐方向：使用 `context by`，必要时加 `csort`。

### 反例 05：需要累计分组却手工维护历史集合

代码特征：按时间逐步扩大范围，多次扫描历史记录，或在脚本层维护“到当前分钟为止”的聚合集合。  
推荐方向：使用 `cgroup by`，并显式声明 `order by`。

### 反例 06：连续段编号由循环维护

代码特征：逐行比较当前值和下一值，手工更新分组 ID。  
推荐方向：使用 `segment` 生成连续段组标识。

### 反例 07：区间标签由多条 SQL 或循环生成

代码特征：每个金额区间各写一条 SQL，或循环生成区间标签再合并。  
推荐方向：使用 `asof(range, value)` 在一次 `group by` 中完成分桶统计。

### 反例 08：透视结果由手工列填充生成

代码特征：针对每个类别创建一列，在循环中判断类别并写入对应列，再补空值和行聚合。  
推荐方向：使用 `pivot by`，并结合 `ffill`、`last`、`avg`、`rowSum`。

### 反例 09：多个源表先合并再过滤

代码特征：从多个分布式表查出较大结果，先 `unionAll` 或 `join`，再按代码、日期、因子过滤。  
推荐方向：先在每个源表中下推过滤条件，结果缩小后再合并。

### 反例 10：动态 SQL 通过字符串拼接构造

代码特征：大量字符串拼接列名、函数名、分组字段，再 `parseExpr` 执行。  
推荐方向：使用 `sql`、`sqlCol`、`makeCall`、`expr` 等结构化元编程入口。

## 四、六个场景的覆盖重点

### scene-01 SQL 与 DolphinScript 衔接

覆盖重点：SQL 中直接使用脚本变量作为键集合、区间边界、动态函数参数。`where key in keys`、字典映射函数、动态参数化查询均归入本场景。

### scene-02 时序关联与时间窗口 SQL

覆盖重点：`interval` 不只用于重采样，也用于缺失时间桶补齐；`accumulate` 可在 SQL 中生成非等长成交量窗口；交易日历窗口与普通时间窗口需要分开说明。

### scene-03 分组、累计分组与组内排序

覆盖重点：`aggrTopN`、`context by`、`cgroup by`、`segment`、`asof` 均纳入分组计算场景。该场景不仅处理普通聚合，也处理组内顺序、连续段和区间统计。

### scene-04 结果整形、复合字段与数组向量

覆盖重点：`pivot by + ffill + rowSum` 是长表转宽后继续计算的典型路线。股票组合价值和 IoT 测点汇总是重点案例。

### scene-05 SQL 元编程与动态字段

覆盖重点：元编程应强调结构化构造 SQL，而非字符串拼接。`bundleQuery` 适合作为批量相似查询的完整案例。

### scene-06 SQL 执行语义与性能优化

覆盖重点：把 `where in` 替代过滤型连接、分区剪枝、直接查询分布式源表、`map`、先过滤后合并作为主要审查规则。该场景承载 SQL 性能测试素材。

## 五、测试样本建议

1. 测试案例可优先选择 10 个反例：过滤型连接、分区剪枝失败、分布式中间表、组内循环、`cgroup by` 缺失、手工连续段、手工区间标签、手工透视、先合并后过滤、字符串拼接动态 SQL。
2. 需要执行验证时，可从案例中抽取较小模拟数据，避免依赖原文中的大型分布式库表。
