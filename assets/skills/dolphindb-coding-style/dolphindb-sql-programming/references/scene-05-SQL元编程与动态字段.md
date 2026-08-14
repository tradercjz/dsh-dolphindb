# scene-05 SQL 元编程与动态字段

## 场景定义

适用于 SQL 语句无法在编码时完全确定，需要在运行期根据列名、函数名、窗口大小、过滤条件、字段序列或查询模板生成 SQL 元代码的任务。


## 适用任务

- 动态生成 `select`、`update`、`delete`。
- 动态选择列名、别名、分组列、排序列。
- 批量生成相似指标表达式。
- 对宽表的大量相似字段进行查询或计算。
- 每行包含规则表达式，需要动态执行。
- 一批结构相同、过滤值不同的查询需要批量执行并合并。

## 推荐入口

- `sql`
- `sqlCol`
- `sqlColAlias`
- `makeCall`
- `makeUnifiedCall`
- `expr`
- `unifiedExpr`
- `binaryExpr`
- `parseExpr`
- `_$name`
- `_$$name`
- 字段序列 `col0...col999`
- `sqlUpdate`
- `sqlDelete`
- `funcByName`
- `partial`
- `loop`
- `eval`
- `addFunctionView`

## 编码规则

### 固定 SQL 不应改成元编程

元编程适用于运行期才能决定列名、函数名、条件或查询数量的任务。固定查询直接写 SQL 更清晰。

### 结构化元编程优先于字符串拼接

生成 SQL 时优先使用 `sql`、`sqlCol`、`makeCall`、`expr` 等结构化函数。字符串拼接加 `parseExpr` 容易产生上下文、转义和安全边界问题。

### 宏变量适合动态替换列名

`_$name` 表示变量 `name` 指向的一列，`_$$name` 表示变量 `name` 指向的多列。宏变量适合列名动态但 SQL 结构稳定的场景。

### 字段序列适合“前缀 + 连续数字”字段

`col0...col999` 可替代大量连续列名。列名必须满足前缀加连续数字，数字序列不超过 32768。

### `parseExpr` 的上下文需要显式传入

`parseExpr` 不会自动查找函数体内局部变量。表达式依赖局部变量时，应构造字典并传入 `parseExpr(expr, dict)`。

### 动态删除应规避列名与变量名冲突

SQL 列名大小写不敏感，`Date = date` 可能被解释为列与自身比较。动态生成 `delete` 条件时应使用不冲突的变量名或明确表达式对象。

## 典型写法

### 用结构化元编程生成 SQL

```dos
selectCode = sqlColAlias(makeUnifiedCall(cumsum, sqlCol("price")), "cumPrice")
fromCode = "t"
whereCondition = parseExpr("time between 09:00:00 and 15:00:00")
contextByCol = sqlCol("securityID")
csortCol = sqlCol("time")
limitCount = -1

sql(select = selectCode,
    from = fromCode,
    where = whereCondition,
    groupby = contextByCol,
    groupFlag = 0,
    csort = csortCol,
    limit = limitCount)
```

### 批量生成窗口因子

```dos
factor = `mmax`mmin`mavg`mstd
windowSize = 2 5 7
metrics = [<date>, <code>, <price>]

for(f in factor){
    for(win in windowSize){
        metrics.append!(sqlCol(`price, partial(funcByName(f), , win),
            f + "_" + string(win) + "d"))
    }
}

sql(select = metrics, from = t, groupBy = sqlCol(`code), groupFlag = 0).eval()
```

### 多档字段行求和

```dos
colN = `bid + string(1..5)

sql((sqlCol(`time`sym),
     sqlColAlias(makeUnifiedCall(rowSum, sqlCol(colN)), `bidSum)),
    from = quotes).eval()
```

### 宏变量单列替换

```dos
col = "price"
contextByCol = "securityID"
csortCol = "time"
a = 09:00:00
b = 15:00:00

<select cumsum(_$col) from t
 where _$csortCol between a and b
 context by _$contextByCol csort _$csortCol limit -1>
```

### 宏变量多列替换

```dos
name = [`y, `x1]
alias = [`y1, `x11]

<select sum:V(_$$name) as _$$alias from t>.eval()
```

### 字段序列

```dos
select col0...col999 from t
select fixedLengthArrayVector(ask1...ask10) as askArray from t
```

### 动态更新

```dos
sqlUpdate(table = t1,
          updates = <wavg(price, volume) as vwap>,
          from = <lj(t1, t2, `symbol`date)>,
          contextBy = sqlCol(`symbol)).eval()
```

### 动态删除

```dos
sqlDelete(t2, <symbol=`B>).eval()
```

### `parseExpr` 显式传入上下文

```dos
def funcA(a, b){
    B = a + 1
    C = b + 2
    d = dict(STRING, ANY)
    d[`B] = B
    d[`C] = C
    return parseExpr("B+C", d).eval()
}
```

### 批量相似查询

```dos
def bundleQuery(tbl, dt, dtColName, mt, mtColName, filterColValues, filterColNames){
    cnt = filterColValues[0].size()
    filterColCnt = filterColValues.size()
    orderByCol = sqlCol(mtColName)
    selCol = sqlCol("*")
    filters = array(ANY, filterColCnt + 2)
    filters[filterColCnt] = expr(sqlCol(dtColName), ==, dt)
    filters[filterColCnt + 1] = expr(sqlCol(mtColName), <, mt)

    queries = array(ANY, cnt)
    for(i in 0:cnt){
        for(j in 0:filterColCnt){
            filters[j] = expr(sqlCol(filterColNames[j]), ==, filterColValues[j][i])
        }
        queries.append!(sql(select = selCol, from = tbl, where = filters,
                            orderBy = orderByCol, ascOrder = false, limit = 1))
    }
    return loop(eval, queries).unionAll(false)
}
```

## 常见反例

### 反例 01：字符串拼接动态 SQL

代码特征：用 `"select " + func + "(Px) ..."` 组合 SQL，再 `parseExpr(...).eval()`。  
推荐方向：使用 `sql`、`sqlCol`、`makeCall`、`sqlColAlias`。

### 反例 02：大量连续字段逐个列出

代码特征：手写 `col0, col1, ..., col999`。  
推荐方向：使用字段序列 `col0...col999`。

### 反例 03：动态列名仍手写多套 SQL

代码特征：列名不同但 SQL 结构相同，复制多段查询。  
推荐方向：使用 `_$name` 或 `_$$name`。

### 反例 04：函数体内 `parseExpr` 访问局部变量

代码特征：函数内构造 `funcExpr = "B+C"`，直接 `parseExpr(funcExpr).eval()`。  
推荐方向：通过字典传入 `B`、`C`。

### 反例 05：动态删除变量名与列名冲突

代码特征：`delete from t where Date = date`。  
推荐方向：变量改名，或用结构化表达式明确比较对象。

## 检查清单

- SQL 是否真的需要运行期生成。
- 动态部分是列名、函数名、条件、窗口大小还是整条查询。
- 能否用宏变量或字段序列表达。
- 是否需要结构化元编程函数。
- `parseExpr` 是否依赖局部变量。
- 动态删除和更新是否存在列名冲突。
- 批量相似查询是否应封装为函数。

## 可转测试样本

1. 字符串拼接 `select avg(Px)`，要求改为 `sql` 结构化写法。
2. 批量生成 `mmax/mmin/mavg/mstd` 因子。
3. `col0...col999` 字段序列识别。
4. `parseExpr` 函数体局部变量错误。
5. `bundleQuery` 批量相似查询封装。
6. `sqlDelete` 删除条件命名冲突。
