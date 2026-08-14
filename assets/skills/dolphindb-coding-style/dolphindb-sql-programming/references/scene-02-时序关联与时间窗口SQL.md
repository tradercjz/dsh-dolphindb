# scene-02 时序关联与时间窗口 SQL

## 场景定义

适用于时间近邻匹配、时间范围匹配、时间分桶、补齐空桶、时间滑动窗口、交易日历窗口和按累计量切分时间窗口的 SQL 任务。

## 适用任务

- 左表每行匹配右表最近历史记录。
- 左表每行匹配右表一段时间窗口并聚合。
- 固定时间粒度聚合。
- 缺失时间桶补齐。
- 基于时间列做滑动窗口。
- 使用交易日历单位计算窗口。
- 按累计成交量或成交额切分时间窗口。

## 推荐入口

- `aj`
- `wj`
- `pwj`
- `bar`
- `interval`
- `dailyAlignedBar`
- `tmsum`
- `tmavg`
- `twindow`
- `volumeBar`
- `accumulate`

## 编码规则

### 最近历史匹配使用 `aj`

当左表每条记录需要匹配右表中同键、同一时刻或之前最近的一条记录时，使用 `aj`。该任务不应退化为左表逐行扫描右表。

### 时间窗口匹配使用 `wj` 或 `pwj`

左表每条记录需要在右表中匹配一个时间范围，并对窗口内数据做聚合时，使用 `wj` 或 `pwj`。窗口边界必须和时间列类型一致。

### 时间分桶先判断是否补齐空桶

仅对有数据的桶聚合时使用 `bar`。需要输出缺失桶并填充时使用 `interval`。若窗口起点需要从原始数据第一条开始，应显式设置 `origin="start"`。

### 时间滑窗优先使用 tm 系列函数

按时间列滑动计算时优先使用 `tmsum`、`tmavg` 等函数。需要任意窗口函数时使用 `twindow`。交易日历窗口使用 `DURATION` 表达，例如 `2XNYS`。

### 累计量窗口优先检查 `volumeBar` 和 `accumulate`

按累计成交量切分窗口时，可使用 `volumeBar`。规则包含“下一条是否并入当前窗口”等自定义逻辑时，可用 `accumulate` 生成分组起点，再按起点聚合。

## 典型写法

### 交易匹配最近报价

```dos
select * from aj(trades, quotes, `symbol`date`time)
```

### 左表记录匹配右表过去 5 秒窗口

```dos
wj(t1, t2, -5s:0s, <avg(bid)>, `sym`time)
```

### `DATETIME` 场景中未来 5 分钟窗口

```dos
wj(t, t, 0m:4m, <avg(close)>, `code`tradeTime)
```

### 固定 2 秒聚合，不补空桶

```dos
select last(contract) as contract, last(price) as price
from t
group by bar(time, 2s)
```

### 固定 2 秒聚合，并用前值补空桶

```dos
select last(contract) as contract, last(price) as price
from t
group by interval(time, 2s, "prev")
```

### 从原始第一条数据开始分桶

```dos
select last(contract) as contract, last(price) as price
from t
group by interval(time, 2s, "prev", origin="start")
```

### 时间滑动窗口

```dos
select time, sym, qty, tmsum(time, qty, 5s) as sum_qty
from t
```

### 交易日历滑动窗口

```dos
select date, symbol, close, tmavg(date, close, 2XNYS) as avgClose
from t
```

### 任意函数作用于时间窗口

```dos
select date, symbol, close, twindow(avg, close, date, -1XNYS:2XNYS)
from t
```

### 按累计成交量分组

```dos
select last(tradingTime), avg(price), sum(volume)
from t
group by sym, tradingDate, volumeBar(volume, 10000000)
```

### 自定义成交量窗口

```dos
def caclCumVol(target, cumVol, nextVol) {
    newVal = cumVol + nextVol
    if(newVal < target) return newVal
    else if(newVal - target > target - cumVol) return nextVol
    else return newVal
}

select first(wind_code) as wind_code,
       first(date) as date,
       sum(volume) as sum_volume,
       last(time) as endTime
from t
group by iif(accumulate(caclCumVol{1500000}, volume) == volume, time, NULL).ffill() as startTime
```

## 常见反例

### 反例 01：窗口单位与时间列类型不匹配

代码特征：`DATETIME` 时间列上使用 `wj(t, t, 0:4, ...)` 表示 5 分钟窗口。  
推荐方向：改成明确时间单位，例如 `0m:4m`。

### 反例 02：需要补齐空桶却使用 `bar`

代码特征：按固定时间粒度输出，缺失时间桶也要存在，但使用 `bar` 聚合。  
推荐方向：改用 `interval(time, duration, fill)`。

### 反例 03：需要从原始起点分桶却未设置 `origin`

代码特征：希望窗口从第一条记录开始，但 `interval` 默认按规整时间点切桶。  
推荐方向：使用 `origin="start"`。

### 反例 04：按累计量切分窗口时手工维护状态

代码特征：循环累计成交量，达到阈值后重置，并维护起止时间。  
推荐方向：检查 `volumeBar` 或 `accumulate`。

## 检查清单

- 是最近历史匹配、时间范围匹配，还是时间分桶。
- 窗口单位是否与时间列类型一致。
- 是否需要补齐空桶，填充方式是什么。
- 是否需要交易日历窗口。
- 输出是左表等长、按桶聚合，还是按累计量切出的不等长窗口。

## 可转测试样本

1. `wj` 使用 `0:4` 误写未来 5 分钟。
2. `bar` 无法补齐缺失 2 秒桶。
3. `interval` 未设置 `origin="start"`。
4. 使用 `tmavg(date, close, 2XNYS)` 识别交易日历窗口。
5. 手工成交量窗口改为 `volumeBar` 或 `accumulate`。
