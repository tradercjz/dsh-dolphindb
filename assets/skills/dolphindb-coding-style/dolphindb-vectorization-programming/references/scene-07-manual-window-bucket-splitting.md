# 场景 07：对单序列或单表数据进行窗口、分桶与时序聚合时，仍手工切分

场景介绍：

代码在同一条序列或同一张表内部切窗口、切时间桶、补空桶、维护会话段和交易量段。典型外观是切片、计数器、时间取整、窗口头尾指针和手工补点。这一组问题优先检查：事件窗口、时间桶、补空桶、时间长度窗口、会话和交易量窗口。若主问题已经变成左侧对象去右侧对象里找时间范围，转到 `scene-04`。

以下是一些典型的例子：

## 1. 事件型滚动窗口仍手工切片

目标：每 5 条数据做一次滚动聚合。

低效写法：

```dos
re = array(DOUBLE)
for(i in 0:data.size()-5:5){
    re.append!(avg(data[i:i+4]))
}
```

分析：代码自己维护窗口起止和步长。事件型滚动窗口已经有成熟原语。

解决方案：

```dos
re = rolling(avg, data, 5, 5)
```

分析：`rolling` 直接承接窗口大小和步长。规整序列上的固定条数窗口优先查它。

## 2. 时间型分桶仍手工规整时间戳

目标：按 5 秒聚合时序表。

低效写法：

```dos
base = 2024.01.02T09:30:00.000
bucket = array(TIMESTAMP, t.size())
for(i in 0:t.size()-1){
    offset = int((t.time[i] - base) / 5000)
    bucket[i] = base + offset * 5000
}
tmp = table(bucket as bucket, t.qty as qty)
re = select sum(qty) from tmp group by bucket
```

分析：时间桶标签是脚本自己算出来的。时间分桶本来就应该交给时间原语。

解决方案：

```dos
select sum(qty) from t group by bar(time, 5s)
```

分析：`bar` 直接给出时间桶。普通时间聚合先查 `bar`。

## 3. 稀疏时间序列补空桶仍手工补点

目标：固定每 2 秒输出一次数据，缺口用前值填充。

低效写法：

```dos
timeline = 2024.01.02T09:30:00.000 + 0 2000 4000 6000 8000 10000
re = array(INT, timeline.size())
lastVal = NULL
j = 0
for(i in 0:timeline.size()-1){
    while(j < t.size() && t.time[j] <= timeline[i]){
        lastVal = t.qty[j]
        j += 1
    }
    re[i] = lastVal
}
```

分析：代码自己维护时间轴和补值逻辑。补空桶语义已经可以直接放进分桶原语里。

解决方案：

```dos
select sum(qty) from t group by interval(time, 2s, "prev")
```

分析：`interval` 把“分桶 + 缺口补值”放到同一条路线上处理。

## 4. 非等间隔时间序列仍按条数窗口处理

目标：对不等间隔时间序列计算过去 1 分钟均值。

低效写法：

```dos
re = array(DOUBLE, t.size())
for(i in 0:t.size()-1){
    win = array(DOUBLE)
    for(j in 0:i){
        if(t.time[j] >= t.time[i] - 1m)
            win.append!(t.price[j])
    }
    re[i] = avg(win)
}
```

分析：窗口定义来自时间长度，代码却自己维护时间范围和窗口内容。这类脚本很容易变成双层回扫。

解决方案：

```dos
select tmavg(time, price, 1m) as ma1m from t
```

分析：`tm*` 这组函数直接承接时间长度窗口。原始时间不规整时，优先先看这一组。

## 5. 会话窗口或交易量窗口仍手工维护状态

目标：按时间间隔断开会话，或按累计量切段。

低效写法：

```dos
sid = array(TIMESTAMP, t.size())
start = t.time[0]
sid[0] = start
for(i in 1:t.size()-1){
    if(t.time[i] - t.time[i-1] >= 5s)
        start = t.time[i]
    sid[i] = start
}
re = select sum(volume) from table(t.time as time, t.sym as sym, sid as sessionId, t.volume as volume) group by sessionId, sym
```

分析：代码自己维护分段状态。会话窗口和交易量窗口已经有专门入口。

解决方案：

```dos
select sum(volume) from t group by contextby(sessionWindow{, 5s}, time, sym) as sessionId, sym
```

分析：历史会话窗口先看 `sessionWindow`。按累计量切段时，换查 `volumeBar`。

## 6. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `rolling` | 固定条数窗口仍手工切片 | 事件型滚动窗口 |
| `moving` / `tmoving` | 没有专用函数的通用窗口 | 通用窗口高阶入口 |
| `bar` | 时间分桶仍手工取整时间戳 | 时间桶 |
| `dailyAlignedBar` | 多交易时段或隔夜时段分桶 | 交易时段对齐 |
| `interval` | 分桶还带补空桶需求 | 分桶与补值 |
| `resample` | 索引矩阵或索引序列降频 | 重采样 |
| `tm*` / `tmoving` / `twindow` | 时间长度窗口还在手工回扫 | 时间长度窗口 |
| `sessionWindow` | 会话切段仍手工维护断点 | 会话窗口 |
| `segment` | 连续相同值切段 | 段窗口 |
| `volumeBar` | 按累计量切段 | 交易量窗口 |
