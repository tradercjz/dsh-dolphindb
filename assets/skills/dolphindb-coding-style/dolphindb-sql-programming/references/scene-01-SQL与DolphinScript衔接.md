# scene-01 SQL 与 DolphinScript 衔接

## 场景定义

适用于 SQL 与 DolphinScript 变量、函数、表对象、catalog、内存表和分布式表混合使用的任务。此场景关注“SQL 是否仍在表级表达内完成任务”，以及“SQL 与脚本语言的边界是否清楚”。

## 适用任务

- 用 SQL 创建内存表或分布式表。
- 用 SQL 查询、更新、删除内存表或分布式表。
- SQL 中引用脚本变量作为过滤边界、键集合或函数参数。
- SQL 中调用自定义聚合函数。
- SQL 查询结果作为函数参数、返回值或变量值。
- 函数内部封装 SQL 查询。
- catalog 访问分布式表。

## 推荐入口

- `select`
- `exec`
- `update`
- `delete`
- `insert into`
- `loadTable`
- `createCatalog`
- `createSchema`
- `sqlUpdate`
- `sqlDelete`

## 编码规则

### SQL 是 DolphinScript 中的一等表达方式

SQL 可以使用外部变量、自定义函数和内置函数，也可以作为变量值、函数参数和函数返回值。需要查询分布式库表时，未启用 catalog 的情况下应先通过 `loadTable` 获得表对象。

### 标准 SQL 写法可用，但写入方式需要判断性能

DolphinDB 支持 `create table`、`insert into`、`select` 等标准 SQL 风格。分布式表也支持 `insert into`，但一般情况下建议使用 `append!` 或 `tableInsert` 写入。

### 变量名不要与列名产生大小写冲突

DolphinDB SQL 列名不区分大小写。若表中存在 `Date` 列，同时脚本变量名为 `date`，`delete from t where Date = date` 可能被解释为列与自身比较，导致删除条件恒为真。

## 典型写法

### SQL 中使用脚本变量

```dos
t1 = table(2024.01.01..2024.01.05 as date, 1.2 7.8 4.6 5.1 9.5 as value)

startDate = 2024.01.01
endDate = 2024.01.03
select * from t1 where date >= startDate and date <= endDate
```

### SQL 中调用自定义聚合函数

```dos
defg maxDrawdown(value){
    return max(1.0 - value \ value.cummax())
}

select maxDrawdown(value) as mdd from fundData group by fundID
```

### SQL 作为函数返回值

```dos
def getAnnualVolatility(originTable){
    return select std(deltas(value) \ prev(value)) * sqrt(252)
           from originTable
           group by fundID
}

annualVolatility = getAnnualVolatility(select * from fundData)
```

### 使用 catalog 访问分布式表

```dos
createCatalog("trading")
createSchema("trading", "dfs://database1", "stock")
select * from trading.stock.pt1
```

### 动态删除避免列名与变量名冲突

```dos
t = table(2020.01.01..2020.01.05 as Date)
date1 = 2020.01.01
delete from t where Date = date1
```

## 常见反例

### 反例 01：把 SQL 查询结果过早取回脚本层

代码特征：`exec` 出列向量后在脚本层继续过滤、分组或计算，而这些操作可以写在 SQL 内。  
推荐方向：把过滤、派生列、分组和聚合保留在同一条 SQL 中。

### 反例 02：分布式表写入默认使用 `insert into`

代码特征：大量数据写入分布式表时使用逐条或批量 `insert into`。  
推荐方向：批量写入优先评估 `append!` 或 `tableInsert`。

### 反例 03：删除条件中的变量名与列名冲突

代码特征：表列名为 `Date`，变量名为 `date`，删除条件写成 `Date = date`。  
推荐方向：改用不会与列名冲突的变量名，例如 `targetDate`。

## 检查清单

- SQL 是否可以继续留在表级表达中完成。
- 分布式表是否已通过 `loadTable` 或 catalog 正确访问。
- SQL 中引用的脚本变量是否与列名冲突。
- 自定义函数是否适合在 SQL 内作为聚合函数或普通函数调用。
- 分布式表写入是否选择了合适的入口。

## 可转测试样本

1. SQL 中引用日期边界变量完成过滤。
2. 自定义 `maxDrawdown` 在 SQL `group by` 中调用。
3. 函数内部返回 SQL 查询结果。
4. `delete from t where Date = date` 的命名冲突案例。
5. 分布式表 `insert into` 与 `append!` 写入建议识别。
