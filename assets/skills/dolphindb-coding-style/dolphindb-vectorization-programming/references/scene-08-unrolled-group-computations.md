# 场景 08：对分组结果进行组内计算、等长输出或结果回填时，仍在组外展开

场景介绍：

代码已经按组处理数据，难点落在输出语义和组内承载层上。典型外观是 `group by` 之后再 join 回原表、先拆组再逐组循环、先聚合再脚本层前缀累加。这一组问题优先检查：`context by`、`csort`、`limit`、`cgroup by`。若组内递推核已经确认很重，再转到 `scene-11`。

以下是一些典型的例子：

## 1. 分组后每行都要一个结果，代码却先 `group by`

目标：每一行都要得到所在组的统计值。

低效写法：

```dos
g = select sym, avg(price) as avgPrice from t group by sym
re = lj(t, g, `sym)
```

分析：结果本来就要和原表等长，代码却先把组结果压成一行，再把它连回去。

解决方案：

```dos
select sym, avg(price) as avgPrice from t context by sym
```

分析：`context by` 直接按组等长输出。这里决定路线的关键是输出长度。

## 2. 每组前几条记录仍手工拆组排序

目标：取每个分组排序后的前 2 条记录。

低效写法：

```dos
syms = exec distinct sym from t
re = table(0:0, t.colNames(), t.colTypes())
for(s in syms){
    part = select * from t where sym = s order by qty desc
    re.append!(part[0:1])
}
```

分析：代码把组内排序和组内截取都拉回了脚本层。

解决方案：

```dos
select * from t context by sym csort qty desc limit 2
```

分析：`context by + csort + limit` 已经能把组内排序和截取放在同一条路线上做完。

## 3. 分桶后的累计结果仍手工前缀累加

目标：按时间桶累计统计结果。

低效写法：

```dos
g = select minute(time) as minute, sum(qty) as qty from t group by minute(time)
// 再对 g 手工做前缀累加
```

分析：代码先做普通分组，再在脚本层补第二段累计逻辑。

解决方案：

```dos
select wavg(price, volume) from t
where sym = `A
cgroup by minute(time) as minute
order by minute
```

分析：`cgroup by` 直接把累计分组留在 SQL 内。这里要同时核对排序列。

## 4. 分组递推仍在组外自己维护循环

目标：每个分组内部做递推，结果还要继续留在表里。

低效写法：

```dos
ids = exec distinct id from t
parts = array(ANY)
for(x in ids){
    part = select * from t where id = x order by time
    state = 0.0
    cost = array(DOUBLE, part.size())
    for(i in 0:part.size()-1){
        state = state + part.qty[i] * part.price[i]
        cost[i] = state
    }
    part[`cost] = cost
    parts.append!(part)
}
```

分析：组内递推的承载层和递推逻辑都被脚本接管了，后面很难继续优化。

解决方案：

```dos
select *, holdingCost(price, qty) as cost from t context by id csort time
```

分析：先把组内承载层放对。若单步递推本身很重，再继续查 `context by + JIT`。

## 5. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `context by` | 分组后每行都要一个结果 | 组内等长输出 |
| `csort` | 组内顺序会影响结果 | 组内排序 |
| `limit` | 每组只要前几条或后几条 | 组内截取 |
| `window` | 组内相对窗口仍手工取子区间 | 组内相对窗口 |
| `cgroup by` | 分桶后的累计结果仍手工前缀累加 | 累计分组 |
| `update ... context by` | 分组统计值最终要写回原表 | 组内更新 |
