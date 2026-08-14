# DolphinDB 因子复现常见模式

## Skill 介绍

本 Skill 用于整理研报因子复现中常见的 DolphinDB 计算模式、函数和代码片段。遇到收益率、滚动窗口、横截面排名、中性化、分组聚合、缺失值处理等常见逻辑时，应优先参考本 Skill 选择稳定写法。

## 数据准备模式

### 字段对齐

```dos
// 将真实字段统一成后续计算使用的标准字段
base = select realTimeCol as tradeTime,
              realSecurityCol as securityId,
              double(realCloseCol) as close,
              double(realVolumeCol) as volume
       from loadTable("dfs://db", "tb")
       where not isNull(realTimeCol), not isNull(realSecurityCol)
```

### 排序

```dos
// 时间序列计算前必须先按证券和时间排序
base = select * from base order by securityId, tradeTime
```

### 输出统一四列

```dos
result = select tradeTime,
                securityId,
                "FACTOR_NAME" as factorname,
                value
         from calc
         where not isNull(value)
```

## 时间序列计算模式

只涉及时序滑动、滚动、滞后时，优先使用 `05-execute-code-generation.md` 的 SQL 字段入参模式，并在最终 SQL 中使用 `context by securityId`。不要因为存在滚动窗口就改成 Panel 或 `calcFactor(tb)`。

### 单期收益率

```dos
calc = select tradeTime,
              securityId,
              close \ prev(close) - 1 as value
       from base
       context by securityId
```

### N 期收益率

```dos
calc = select tradeTime,
              securityId,
              close \ move(close, windowSize) - 1 as value
       from base
       context by securityId
```

### 滚动均值

```dos
calc = select tradeTime,
              securityId,
              mavg(inputValue, windowSize) as value
       from base
       context by securityId
```

### 滚动求和

```dos
calc = select tradeTime,
              securityId,
              msum(inputValue, windowSize) as value
       from base
       context by securityId
```

### 滚动波动率

```dos
calc = select tradeTime,
              securityId,
              mstd(ret, windowSize) as value
       from returns
       context by securityId
```

### 滚动相关

```dos
calc = select tradeTime,
              securityId,
              mcorr(xValue, yValue, windowSize) as value
       from base
       context by securityId
```

### 累计求和

```dos
calc = select tradeTime,
              securityId,
              cumsum(inputValue) as value
       from base
       context by securityId
```

## 横截面计算模式

同一层面内时序计算与横截面 rank/标准化组合时，优先使用 `05-execute-code-generation.md` 中的 Panel 模式和 `rowRank/rowZScore`。单独一次横截面 rank/标准化可以作为单层 SQL 计算，用 `context by tradeTime` 表达。

### 横截面排名

```dos
calc = select tradeTime,
              securityId,
              rank(inputValue) as value
       from base
       context by tradeTime
```

### 横截面标准化

```dos
calc = select tradeTime,
              securityId,
              iif(std(inputValue) == 0, NULL, (inputValue - avg(inputValue)) \ std(inputValue)) as value
       from base
       context by tradeTime
```

### 横截面去均值

```dos
calc = select tradeTime,
              securityId,
              inputValue - avg(inputValue) as value
       from base
       context by tradeTime
```

### 分行业去均值

```dos
calc = select tradeTime,
              securityId,
              inputValue - avg(inputValue) as value
       from base
       context by tradeTime, industry
```

## 分组聚合模式

### 按证券聚合

```dos
agg = select avg(inputValue) as avgValue,
             std(inputValue) as stdValue
      from base
      group by securityId
```

### 按日期聚合

```dos
agg = select avg(inputValue) as marketAvg,
             count(inputValue) as sampleCount
      from base
      group by tradeTime
```

### 聚合后回连

```dos
joined = lj(base, agg, `tradeTime)
```

## 常见保护写法

### 分母为 0

```dos
calc = select tradeTime,
              securityId,
              iif(denominator == 0 || isNull(denominator), NULL, numerator \ denominator) as value
       from base
```

### 空值过滤

```dos
clean = select * from base
        where not isNull(tradeTime),
              not isNull(securityId),
              not isNull(inputValue)
```

### 极端值裁剪

```dos
calc = select tradeTime,
              securityId,
              iif(inputValue > upperBound, upperBound,
                  iif(inputValue < lowerBound, lowerBound, inputValue)) as value
       from base
```

## 常见函数签名速查

### 时序与滞后函数

| Function | Signature | Parameters | Return | Notes |
|----------|-----------|------------|--------|-------|
| `prev` | `prev(X)` | `X`: vector/column | vector | 返回上一期值，常在 `context by securityId` 中使用 |
| `move` | `move(X, n)` | `X`: vector/column; `n`: lag periods | vector | 将序列移动 `n` 期，常用于 N 期收益 |
| `deltas` | `deltas(X)` | `X`: numeric vector/column | vector | 相邻差分，等价于当前值减上一期值 |
| `ratios` | `ratios(X)` | `X`: numeric vector/column | vector | 相邻比值，常用于收益率 `ratios(X)-1` |
| `cumsum` | `cumsum(X)` | `X`: numeric vector/column | vector | 累计求和 |
| `cummax` | `cummax(X)` | `X`: numeric vector/column | vector | 累计最大值 |
| `cummin` | `cummin(X)` | `X`: numeric vector/column | vector | 累计最小值 |

### 滚动窗口函数

| Function | Signature | Parameters | Return | Notes |
|----------|-----------|------------|--------|-------|
| `mavg` | `mavg(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动均值 |
| `msum` | `msum(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动求和 |
| `mstd` | `mstd(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动标准差 |
| `mvar` | `mvar(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动方差 |
| `mmax` | `mmax(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动最大值 |
| `mmin` | `mmin(X, window)` | `X`: numeric vector/column; `window`: positive int | vector | 滚动最小值 |
| `mcorr` | `mcorr(X, Y, window)` | `X`, `Y`: numeric vectors/columns; `window`: positive int | vector | 滚动相关系数 |

### 聚合与横截面函数

| Function | Signature | Parameters | Return | Notes |
|----------|-----------|------------|--------|-------|
| `avg` | `avg(X)` | `X`: numeric vector/column | scalar/vector | 在 `context by` 中返回组内均值 |
| `std` | `std(X)` | `X`: numeric vector/column | scalar/vector | 在 `context by` 中返回组内标准差 |
| `sum` | `sum(X)` | `X`: numeric vector/column | scalar/vector | 组内求和 |
| `count` | `count(X)` | `X`: any vector/column | scalar/vector | 组内非空计数 |
| `max` | `max(X)` | `X`: numeric vector/column | scalar/vector | 组内最大值 |
| `min` | `min(X)` | `X`: numeric vector/column | scalar/vector | 组内最小值 |
| `rank` | `rank(X)` | `X`: numeric vector/column | vector | 组内排名，常配合 `context by tradeTime` |

### 条件与空值函数

| Function | Signature | Parameters | Return | Notes |
|----------|-----------|------------|--------|-------|
| `iif` | `iif(condition, trueValue, falseValue)` | `condition`: boolean scalar/vector; `trueValue`, `falseValue`: scalar/vector | scalar/vector | 条件选择 |
| `isNull` | `isNull(X)` | `X`: scalar/vector/column | boolean scalar/vector | 判断空值 |
| `nullCompare` | `nullCompare(op, X, Y)` | `op`: comparison function; `X`, `Y`: scalar/vector | boolean vector | 带空值保护的比较，如 `nullCompare(>, X, 0)` |
| `isVoid` | `isVoid(X)` | `X`: object | boolean | 判断对象是否为空/未提供 |

必要时对真实字段做显式类型转换，例如将价格、成交量等输入转为数值类型，或将时间字段转为复现逻辑需要的日期/时间粒度。类型转换只应服务于字段对齐，不应改变字段的金融含义。

### 表连接函数

| Function | Signature | Parameters | Return | Notes |
|----------|-----------|------------|--------|-------|
| `lj` | `lj(leftTable, rightTable, matchingCols)` | `matchingCols`: symbol or symbol vector | table | 左连接，保留左表所有记录 |
| `ej` | `ej(leftTable, rightTable, matchingCols)` | `matchingCols`: symbol or symbol vector | table | 等值连接，仅保留匹配记录 |
| `join` | `join(leftTable, rightTable)` | two tables | table | 横向拼接，需谨慎确认行顺序 |

连接键示例：

```dos
joined = lj(base, industryInfo, `securityId`tradeTime)
```

### 数据源与查询函数

| Function/Clause | Signature | Parameters | Return | Notes |
|-----------------|-----------|------------|--------|-------|
| `loadTable` | `loadTable(dbName, tbName)` | `dbName`: string; `tbName`: string | table handle | 读取分布式表 |
| `group by` | `group by col1, col2` | grouping columns | grouped table | 聚合后通常减少行数 |
| `context by` | `context by col1, col2` | grouping columns | same-row result | 组内计算并保留原行结构 |
| `order by` | `order by col1, col2` | sorting columns | sorted table | 时间序列计算前常用 |

## 选择写法的原则

1. 单个计算层面优先使用 SQL 字段入参：逐行 `select`、时序 `context by securityId`、降频 `group by`。
2. 同一层面内时序 + 截面组合优先使用 Panel 模式。
3. 两个及以上计算层面、不同粒度阶段或必须复用中间表时，使用 `calcFactor(tb)`。
4. 滚动窗口、lag、阈值等公式参数必须从字段入参中分离，写成核心函数的带默认值普通参数。
5. 滚动窗口计算前必须确认排序。
6. 多表连接前必须确认连接键类型一致。
7. 最终输出只保留四列：`tradeTime`, `securityId`, `factorname`, `value`。
8. 不为通过执行而删除研报中的核心计算逻辑。
