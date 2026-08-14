# scene-04 结果整形、复合字段与数组向量

## 场景定义

适用于 SQL 查询结果需要改变形态的任务，包括函数返回多列、同构多档字段合并为数组向量、组内数据收集为数组向量、长表转宽表、二维透视、透视后继续行级计算。

## 适用任务

- 自定义函数在 SQL 中返回多列。
- 多档买卖价、买卖量等平行字段合并。
- 分组内明细收集为数组向量。
- 因子窄表转宽表。
- 二维透视统计。
- 透视后填充缺失值并按行计算。
- 查询宽表中一批规则字段或排除指定字段。

## 推荐入口

- 复合字段 `as \`col1\`col2`
- `fixedLengthArrayVector`
- `toArray`
- `pivot by`
- `iif`
- `ffill`
- `rowSum`
- 字段序列 `col0...col999`
- `sqlCol`

## 编码规则

### 函数返回多列时使用复合字段

SQL 调用函数得到多个返回列时，应在 `as` 后指定多个列名，避免后续再拆分无名结果。

### 同构多档字段优先合并为数组向量

`bid1..bid10`、`ask1..ask10` 等字段本质上是一组同构数据，适合用 `fixedLengthArrayVector` 形成数组向量列。

### 组内多行数据可用 `toArray` 收集

按股票、时间桶等分组后，需要保留组内全部明细值时，可使用 `toArray` 搭配 `group by`。

### 二维重排使用 `pivot by`

长表转宽表、交叉透视、因子矩阵和前端透视统计都应优先使用 `pivot by`。不要手工循环生成宽表列。

### 透视后行级计算使用行函数

`pivot by` 之后需要组合价值、测点求和、横截面求和时，可结合 `ffill`、`last`、`avg` 和 `rowSum`。

### 大量规则字段优先使用字段序列或元编程

列名满足连续规则时使用 `col0...col999`；需要排除指定列或动态选择列时使用 `sqlCol(t.colNames()[...])`。

## 典型写法

### 函数返回多列

```dos
def myOls(y, x){
    coef = ols(y, x, true, 2).Coefficient
    return coef[`factor], coef[`beta], coef[`stdError], coef[`tstat]
}

select myOls(y, (x1, x2, x3)) as `factor`beta`stdError`tstat
from t
```

### 多档报价合并为数组向量

```dos
select time, sym,
       fixedLengthArrayVector(bid1, bid2, bid3, bid4, bid5) as bid,
       fixedLengthArrayVector(ask1, ask2, ask3, ask4, ask5) as ask
from quotes
```

### 字段序列生成数组向量

```dos
select fixedLengthArrayVector(ask1...ask10) as askArray
from t
```

### 分组内收集为数组向量

```dos
select toArray(ask1) as ask1All,
       toArray(bid1) as bid1All
from quotes
group by sym, bar(time, 1m) as time
```

### 因子窄表转宽表

```dos
select value
from factorTest
pivot by date, code, name
```

### 利润透视

```dos
select sum(Profit)
from performance
pivot by year(Order_Date), Category
```

### 用 `iif` 生成透视维度

```dos
select count(Order_ID)
from performance
pivot by iif(Sales < 500, "[0,500)", "[500,)") as Range, year(Order_Date)
```

### part=a 减 part=b

```dos
select a - b
from select last(val) from t pivot by id, part
```

### 股票组合价值

```dos
select rowSum(ffill(last(weightedPrice)))
from ETF
pivot by Time, Symbol
```

### IoT 测点分钟均值后求和

```dos
select sum(rowSum) as v
from (
    select rowSum(ffill(avg(value)))
    from t
    where id in `id1`id2`id3, time between timePeriod
    pivot by bar(time, 60000) as minute, id
)
group by interval(minute, 1m, "prev") as minute
```

### 查询宽表中排除指定列后的列集合

```dos
def queryExSpecifiedCol(t, exCols){
    selectCols = t.colNames()[not t.colNames() in exCols]
    return sql(sqlCol(selectCols), t).eval()
}
```

## 常见反例

### 反例 01：函数返回多列后手工拆结果

代码特征：SQL 中调用函数返回元组或多个对象，再在脚本层拆列命名。  
推荐方向：使用复合字段命名。

### 反例 02：多档字段长期保持平行列

代码特征：`bid1..bid10`、`ask1..ask10` 在 SQL 后续阶段仍逐列处理。  
推荐方向：使用 `fixedLengthArrayVector` 或字段序列。

### 反例 03：透视结果手工生成

代码特征：为每个股票、测点、类别手工创建一列，再循环填值。  
推荐方向：使用 `pivot by`。

### 反例 04：组合价值逐类别回填后再求和

代码特征：先把不同股票写入不同列，再 `ffill` 和求和。  
推荐方向：`pivot by + ffill + rowSum`。

## 检查清单

- 函数返回是否是多列。
- 多档字段是否属于同构列组。
- 结果是否需要从长表转宽表。
- 是否需要透视后继续按行计算。
- 宽表列名是否满足字段序列规则。
- 动态列选择是否应使用 `sqlCol`。

## 可转测试样本

1. `myOls` 返回四列，要求用复合字段命名。
2. `bid1..bid5` 合并为数组向量。
3. 手工 AAPL/FB 两列回填，要求改为 `pivot by`。
4. `part=a` 减 `part=b`，要求使用 `pivot by`。
5. 排除部分宽表列，要求使用元编程选择列。
