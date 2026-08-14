# 场景 04：为找到对应项再继续计算，仍手工查找、匹配与对齐

场景介绍：

代码的主问题已经变成先找到对应项，再继续计算。常见外观是循环里不停扫描目标向量、手工维护标签到位置的关系、对多档价位逐行比对，或者对左侧每一行去右侧对象里找最近记录和时间范围。这个场景优先检查：首个命中、批量精确查找、标签取数、逐行价位对齐、时间匹配。若代码只是按固定规则筛、改、打标，转到 `scene-02`。

以下是一些典型的例子：

## 1. 找第一个命中位置还在手工扫描

目标：在向量里找到第一个小于 2.5 的位置。

低效写法：

```dos
X = NULL 3.2 4.5 1.2 NULL 7.8 0.6 9.1
pos = -1
for(i in 0:X.size()-1){
    if(isValid(X[i]) && X[i] < 2.5){
        pos = i
        break
    }
}
```

分析：循环一位一位扫，命中后才退出。查找目标很简单，脚本层扫描没有必要继续保留。

解决方案：

```dos
X = NULL 3.2 4.5 1.2 NULL 7.8 0.6 9.1
pos = ifirstHit(<, X, 2.5)
```

分析：`ifirstHit` 直接表达“第一个满足条件的位置”。向前找、向后找、找距离这类变体，也先查这一组函数。

## 2. 一批查询值仍逐个回扫目标向量

目标：用一批查询值去大向量里找对应位置。

低效写法：

```dos
x = 7 3 3 5 6
y = 2 4 5
re = array(INT, y.size())
for(i in 0:y.size()-1){
    re[i] = -1
    for(j in 0:x.size()-1){
        if(x[j] == y[i]){
            re[i] = j
            break
        }
    }
}
```

分析：查询值在变，目标向量不变。代码却对同一目标向量反复线性扫描。

解决方案：

```dos
x = 7 3 3 5 6
y = 2 4 5
re = find(x, y)
```

如果目标向量已经有序，查询值又很少，可以继续写成：

```dos
re = binsrch(1..1000, 23 6 888 1002)
```

分析：`find` 承接批量精确查找。已排序目标上的少量查询，再看 `binsrch`。

## 3. 标签矩阵取数还在自己维护下标

目标：按标签从矩阵里取出子集。

低效写法：

```dos
m = rand(48, 6:8)
m.rename!(`A`A`B`A`B`B, 2022.01.01 + 0..7)

rowLabels = `A`A`B`A`B`B
colLabels = 2022.01.01 + 0..7
rowIdx = find(rowLabels, `B)
colIdx = find(colLabels, 2022.01.03)
sub = m[rowIdx, colIdx]
```

分析：代码先把标签映射成位置，再按位置取数。标签矩阵已经自带按标签取子集的入口。

解决方案：

```dos
m = rand(48, 6:8)
m.rename!(`A`A`B`A`B`B, 2022.01.01 + 0..7)
sub = loc(m, `B, 2022.01.03)
```

分析：`loc` 直接按行列标签取数。继续手工映射标签，后面很快就会长出更多位置表和回填逻辑。

## 4. 多档价位逐行对齐仍手工做映射

目标：对齐两个时刻的买价档位，再计算对应委托量变化。

低效写法：

```dos
leftBid = array(DOUBLE[], 0, 3).append!([9.01 9.00 8.99 8.98 8.97, 9.00 8.98 8.97 8.96 8.95, 8.99 8.97 8.95 8.93 8.91])
rightBid = array(DOUBLE[], 0, 3).append!([9.02 9.01 9.00 8.99 8.98, 9.01 9.00 8.99 8.98 8.97, 9.00 8.98 8.97 8.96 8.95])
leftQty = array(INT[], 0, 3).append!([10 5 15 20 13, 12 15 20 21 18, 7 8 9 9 10])
rightQty = array(INT[], 0, 3).append!([8 12 10 12 8, 10 5 15 18 13, 12 15 20 21 19])

delta = array(ANY)
for(i in 0:leftBid.size()-1){
    oldQty = dict(DOUBLE, INT)
    for(j in 0:rightBid[i].size()-1){
        oldQty[rightBid[i][j]] = rightQty[i][j]
    }
    one = array(INT, leftBid[i].size())
    for(j in 0:leftBid[i].size()-1){
        p = leftBid[i][j]
        one[j] = leftQty[i][j] - oldQty[p]
    }
    delta.append!(one)
}
```

分析：每一行都先建一次价位映射，再逐档计算。盘口多档数据继续走脚本层对齐，成本很高。

解决方案：

```dos
leftIndex, rightIndex = rowAlign(leftBid, rightBid, "bid")
delta = leftQty.rowAt(leftIndex).nullFill(0) - rightQty.rowAt(rightIndex).nullFill(0)
```

分析：`rowAlign` 负责逐行价位对齐，`rowAt` 负责按对齐后的索引取数。盘口逐行对齐优先走这条路线。

## 5. 时间匹配还在对右表反复回扫

目标：给每笔成交补上最近一条报价，或者补上一个时间范围内的聚合结果。

低效写法：

```dos
trades = table(2020.08.27T09:30:00.002 2020.08.27T09:30:00.020 2020.08.27T09:30:00.008 as time, `A`A`B as sym, 20.01 20.07 20.04 as price)
quotes = table(2020.08.27T09:30:00.001 2020.08.27T09:30:00.006 2020.08.27T09:30:00.019 as time, `A`A`A as sym, 20 20.03 20.06 as bid)

re = table(100:0, `time`sym`price`bid, [TIMESTAMP, SYMBOL, DOUBLE, DOUBLE])
for(i in 0:trades.size()-1){
    lastBid = NULL
    for(j in 0:quotes.size()-1){
        if(quotes.sym[j] == trades.sym[i] && quotes.time[j] <= trades.time[i])
            lastBid = quotes.bid[j]
    }
    tableInsert(re, trades.time[i], trades.sym[i], trades.price[i], lastBid)
}
```

分析：左表每一行都对右表做一次回扫。数据量一大，很容易变成双层循环热点。

解决方案：

```dos
aj(trades, quotes, `sym`time)
```

如果目标是“每一行拿一个时间范围内的聚合结果”，改查：

```dos
wj(trades, quotes, -5s:0s, <avg(bid)>, `sym`time)
```

分析：最近一条历史匹配先看 `aj`。时间范围聚合先看 `wj`。这类代码的重点始终是“怎么找到对应项”。

## 6. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `ifirstHit` | 找第一个命中位置仍手工扫描 | 首个命中定位 |
| `find` | 一批查询值仍逐个回扫 | 批量精确查找 |
| `binsrch` | 目标向量已排序，查询值很少 | 已排序向量查找 |
| `asof` | 递增序列上的近邻定位 | 邻近命中 |
| `at` / `eachAt` | 已有下标结果，仍手工拼返回值 | 批量取数 |
| `loc` | 标签矩阵取数还在自己映射 | 标签取子集 |
| `align` | 两个标签对象还在手工对齐 | 标签矩阵对齐 |
| `rowAlign` / `rowAt` | 多档价位逐行对齐还在手工做 | 数组向量逐行对齐 |
| `aj` | 最近一条历史匹配 | 时间邻近 join |
| `wj` / `pwj` | 左表每行对应一个时间窗口 | 时间窗口 join |
