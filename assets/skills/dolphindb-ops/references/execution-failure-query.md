---
kind: category
---

# SQL/查询/写入错误案例

> 触发: SQL 语法错误、查询报错、聚合函数报错、写入失败、append!/update 报错、数据加载失败

## 规则

### Duplicated column name
条件: 报错 `Duplicated column name: xxx`
根因: `group by` 列与 `select` 中聚合别名重名冲突
处置: 重命名冲突字段，确保输出列名唯一

### FROM clause must return a table
条件: 报错 `FROM clause must return a table`
根因: `select from` 的对象不是表；或 `subscribeTable` 未设置 `msgAsTable=true`，回调参数非表
处置: 用 `typestr()` 确认对象类型；订阅场景显式设置 `msgAsTable=true`

### med 报 Unsupported query for reshuffle group
条件: 报错 `Unsupported query for reshuffle group`
根因: 对分布式表直接使用 `med()` 聚合函数
处置: 改写为子查询先拉取到内存再计算：`select med(v) from (select * from loadTable(...))`；注意评估内存/OOM 风险

### Meta code can not be used recursively
条件: 报错 `Meta code can not be used recurisively`
根因: 元编程代码中嵌套使用元编程（meta 内再 meta）
处置: 定位并移除嵌套元编程结构，改写为非递归形式

### nunique+group by 字符串列报错
条件: 报错 `Array vector does not support SYMBOL or STRING type.`
根因: 分布式场景下对 `STRING/SYMBOL` 列执行 `nunique + group by`
处置: 改用 `concat(col,",")+regexCount` 绕行，或自定义聚合函数 `defg stringNunique`

### 查询分区数超限
条件: 报错 `The number of partitions [N] relevant to the query is too large`
根因: 查询命中分区数超过 `maxPartitionNumPerQuery`（默认 65536）
处置: 优先收敛 `WHERE` 分区列过滤条件；确需时调大 `cluster.cfg` 中 `maxPartitionNumPerQuery` 也可以在线通过 `setDynamicConfig` 函数修改查询最大分区数

### 查询结果超内存限制
条件: 报错 `The query result exceeds memLimitOfQueryResult`
根因: 单次查询结果超过 `memLimitOfQueryResult`（默认 `min(50%*maxMemSize, 8G)`）
处置: 先 `count(*)` 核对结果规模；优化 SQL 过滤条件；按需调大阈值或改写为 `sqlDS + mr` 分批查询，或者 `setDynamicConfig` 在线修改 `memLimitOfQueryResult` 值

### JIT 变量类型推断冲突
条件: 报错 `JITUDF::compile ... Can't determine type of variable ... two possibilities`
根因: `@jit` 函数中使用 `$INT` 等 cast 写法，当前 JIT 版本不支持
处置: 将 `$INT` 改写为 `int(xxx)`；用分段注释法定位具体报错语句

### append! 列类型不匹配
条件: 报错 `The column [xxx] expects type of XXX, but the actual type is YYYY.`
根因: `append!` 时插入数据与目标表列顺序或列类型不一致
处置: 核对两侧 schema（列名、顺序、类型），重排列顺序并做类型转换后再写入

### 不能 update 分区列或排序键
条件: 报错 `Can't update partition columns or sort keys.`
根因: 对分区表的分区列或 sort key 执行 `update`
处置: 按条件删除原记录，以修正后的值重新插入（delete + insert）

### VALUE 分区列含不可见字符
条件: 报错 `A string or symbol value-partitioning column can't contain any invisible character.`
根因: VALUE 分区且分区列为字符串/SYMBOL，数据含空格、`\n`、`\r`、`\t` 等不可见字符
处置: `append` 前对分区列做数据清洗，去除不可见字符或做转义映射

### VALUE 分区列含 null
条件: 报错 `A value-partition column can't contain null values.`
根因: VALUE 分区表追加数据时分区列存在 `null`
处置: 入库前对分区列进行填充默认值 / 过滤空值行 / 映射到约定分区值

### SYMBOL 字段唯一值超限
条件: 报错 `One symbase's size can't exceed 2097152`
根因: `SYMBOL` 类型字段的不同取值数超过 2^21（2097152）
处置: 将高基数字段从 `SYMBOL` 改为 `STRING`

### loadText 加载 CSV 类型推断失败
条件: 报错 `getStringConst method not supported`
根因: `loadText` 采样推断列类型与后续真实数据类型不一致
处置: 先 `extractTextSchema` 提取 schema，修正错误列类型后用修正 schema 重新 `loadText`

### functionView 超过 64K 字符串上限
条件: 报错 `UTF-8 string length exceeds the limit of 65536 bytes`
根因: 单个 `functionView` 体积超过 65536 字节
处置: 将大 `functionView` 拆分为多个子函数，主函数组合调用

## 验证
- 重新执行报错 SQL/操作确认成功
- 确认数据写入正确
