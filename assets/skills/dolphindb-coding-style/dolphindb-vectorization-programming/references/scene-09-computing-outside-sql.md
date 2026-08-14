# 场景 09：数据已经位于表中，查询、聚合与结果整理仍在 SQL 外完成

场景介绍：

数据已经在表里，代码也已经走进 SQL 路线，问题出在中途拉回脚本层、结果仍留到查询外整形、时间逻辑没有继续留在 SQL 里完成，或者查询组织本身太松。这个场景优先检查：能不能继续留在 SQL 里做、结果形态能不能在查询里直接产出、时间分桶和时间窗口能不能留在查询里、查询组织有没有把分区剪枝和批量执行拖慢。若重点已经变成分组后等长输出，转到 `scene-08`。若重点已经变成跨对象匹配，转到 `scene-04`。若重点只是单序列窗口、单表分桶或会话切段，转到 `scene-07`。

以下是一些典型的例子：

## 1. 数据已经在表里，代码还回脚本层做聚合

目标：按基金分组计算最大回撤。

低效写法：

```dos
funds = exec distinct fundID from fundData
re = table(100:0, `fundID`mdd, [INT, DOUBLE])
for(id in funds){
    v = exec value from fundData where fundID = id
    tableInsert(re, id, maxDrawdown(v))
}
```

分析：数据本来就在表里，计算也已经是表级分组任务。中途拉回脚本层会把后面的批量表达拆散。

解决方案：

```dos
select maxDrawdown(value) as mdd from fundData group by fundID
```

分析：自定义聚合或向量逻辑优先尝试直接嵌进 SQL。能留在 SQL 里就先别拉回脚本层。

## 2. 查询结果还在 SQL 外手工整形

目标：把多列同构字段打包成一个结果列。

低效写法：

```dos
q = select time, sym, bid1, bid2, bid3, bid4, bid5 from quotes
bids = array(DOUBLE[], 0, q.size())
for(i in 0:q.size()-1){
    bids.append!([q.bid1[i], q.bid2[i], q.bid3[i], q.bid4[i], q.bid5[i]])
}
q[`bid] = bids
```

分析：核心计算已经在查询里完成，结果形态却留到查询外继续加工。

解决方案：

```dos
select time, sym, fixedLengthArrayVector(bid1, bid2, bid3, bid4, bid5) as bid from quotes
```

或者：

```dos
select toArray(ask1) as ask1All from quotes group by sym, bar(time, 1m) as time
```

分析：结果整形也尽量留在查询里完成，这样后面的脚本不会再多一轮拼装。

## 3. 时间分桶和时间滑窗仍被拉回脚本层

目标：按 1 分钟聚合成交量。

低效写法：

```dos
q = select time, qty from trades where sym=`A
base = 2024.01.02T09:30:00.000
bucket = array(TIMESTAMP, q.size())
for(i in 0:q.size()-1){
    offset = int((q.time[i] - base) / 60000)
    bucket[i] = base + offset * 60000
}
tmp = table(bucket as bucket, q.qty as qty)
select sum(qty) from tmp group by bucket
```

分析：数据已经在表里，时间桶标签却还在脚本层自己算。这会把后面的聚合路线拆散。

解决方案：

```dos
select sum(qty) from trades where sym=`A group by bar(time, 1m)
```

分析：只要时间分桶、补空桶、时间滑窗还能留在 SQL 里，就先别回到脚本层去手工切。

## 4. 查询被拆成多次扫描和中间表

目标：完成一条分布式查询。

低效写法：

```dos
ids = exec sym from hotList
tmp = select * from trades where date between 2024.01.01 : 2024.01.31
re = select sym, sum(volume) as sumVol from tmp where sym in ids group by sym
```

分析：表面上已经在用 SQL，实际执行组织还在吞掉批量收益。分布式表场景里尤其明显。

解决方案：

```dos
hotSyms = exec sym from hotList
select sym, sum(volume) as sumVol from trades
where date between 2024.01.01 : 2024.01.31, sym in hotSyms
group by sym
```

分析：这组问题的重点在查询组织。能合成一条就先别拆成多次扫描。

## 5. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `select` / `exec` / `update` | 数据已经在表里，脚本还在取列后再算 | 表级批量表达 |
| `fixedLengthArrayVector` / `toArray` | 查询结果需要打包 | 查询内整形 |
| `pivot by` / `unpivot` | 查询结果需要宽化、面板化或重新拉直 | 查询内结构整形 |
| `bar` / `interval` / `tm*` | 时间逻辑还在脚本层切 | 时间分桶与时间窗口 |
| `in` / `exec` | 连接只是在服务过滤 | 把过滤留在 SQL 内 |
| `sqlDS` / Trace | 分布式查询已经复杂到看不清瓶颈 | 诊断扫描与分区剪枝 |
