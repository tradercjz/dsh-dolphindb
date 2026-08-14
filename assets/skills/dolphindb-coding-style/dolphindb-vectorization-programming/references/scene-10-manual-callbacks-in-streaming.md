# 场景 10：数据已经进入流处理，实时计算仍依赖手工回调、缓存与关联

场景介绍：

数据已经从静态表变成了持续到达的流。代码却还在订阅回调里逐条拆消息、手工维护缓存、手工串接中间流表、手工匹配双流，或者同一因子维护两套批流逻辑。这一组问题优先检查：批次是否被当成表处理、状态和窗口是否应该交给引擎、实时拓扑有没有被写散、历史回放和批流共用表达是否已经打通。

以下是一些典型的例子：

## 1. 订阅回调里仍逐条拆消息

目标：实时计算一个简单因子。

低效写法：

```dos
def onMsg(msg){
    for(i in 0:msg.size()-1){
        spread = msg.askPrice[i] - msg.bidPrice[i]
        tableInsert(out, msg.time[i], msg.sym[i], spread)
    }
}

subscribeTable(tableName="quotes", actionName="spread", offset=0, handler=onMsg, msgAsTable=true)
```

分析：流输入明明是批次，代码却把它退回成逐条处理。

解决方案：

```dos
def onMsg(msg){
    out.append!(select time, sym, askPrice - bidPrice as spread from msg)
}

subscribeTable(tableName="quotes", actionName="spread", offset=0, handler=onMsg, msgAsTable=true)
```

分析：第一步先别急着建复杂引擎，先确认有没有把批次当成表处理。

## 2. 历史窗口或状态缓存仍手工维护

目标：实时计算过去五分钟指标，或上一条、首条、回看值相关指标。

低效写法：

```dos
cache = dict(SYMBOL, ANY)
def onTrade(msg){
    for(i in 0:msg.size()-1){
        s = msg.sym[i]
        if(!cache.hasKey(s))
            cache[s] = table(1000:0, `time`qty`side, [TIMESTAMP, INT, SYMBOL])
        cache[s].append!(table(msg.time[i] as time, msg.qty[i] as qty, msg.side[i] as side))
        while(cache[s].size() > 0 && msg.time[i] - cache[s].time[0] > 5m){
            cache[s].drop!(0)
        }
    }
}
```

分析：代码把状态层全接管了。后面会不断长出更多缓存和补偿逻辑。

解决方案：

```dos
engine = createReactiveStateEngine(
    name="activeRatio",
    metrics=<[tmsum(tradeTime, iif(side=`B, qty, 0), 5m) / tmsum(tradeTime, qty, 5m)]>,
    dummyTable=trades,
    outputTable=result,
    keyColumn=`sym
)
```

分析：这类实时状态问题优先把承载层交给引擎，再把小序列操作交给内置算子。

## 3. 多阶段流计算仍依赖中间流表串接

目标：连续完成多步实时计算。

低效写法：

```dos
share streamTable(1000:0, `time`sym`ret, [TIMESTAMP, SYMBOL, DOUBLE]) as factorStream
share streamTable(1000:0, `time`sym`rank, [TIMESTAMP, SYMBOL, INT]) as rankStream

subscribeTable(tableName="ticks", actionName="calcFactor", offset=0, handler=onFactor, msgAsTable=true)
subscribeTable(tableName="factorStream", actionName="calcRank", offset=0, handler=onRank, msgAsTable=true)
```

分析：脚本把每一步都拆成了独立订阅节点，中间结果和重复订阅会越来越多。

解决方案：

```dos
createCrossSectionalEngine(name="crossSectionalEngine",
metrics=<[securityID, factor, rank(factor, ascending=false)+1]>,
dummyTable=resultTable, outputTable=rankTable, keyColumn=`securityID,
triggeringPattern='perBatch', useSystemTime=false, timeColumn=`datetime)

@state
def priceChange(datetime, lastPrice, duration){
    return lastPrice \ tmove(datetime, lastPrice, duration) - 1
}

createReactiveStateEngine(name="reactiveDemo",
metrics=<[datetime, priceChange(datetime, lastPrice, 2m)]>,
dummyTable=tick, outputTable=getStreamEngine(`crossSectionalEngine),
keyColumn="securityID")
```

分析：多阶段实时计算优先看引擎流水线，少建中间流表。

## 4. 两路实时数据仍手工缓存匹配

目标：两路流数据做等值匹配、邻近匹配或窗口关联。

低效写法：

```dos
leftCache = dict(SYMBOL, ANY)
rightCache = dict(SYMBOL, ANY)
def onTrade(msg){
    for(i in 0:msg.size()-1){
        leftCache[msg.sym[i]] = msg.row(i)
        // 再去 rightCache 里找最近一条报价
    }
}

def onQuote(msg){
    for(i in 0:msg.size()-1){
        rightCache[msg.sym[i]] = msg.row(i)
    }
}
```

分析：这类代码通常会自己维护两套缓存、时间回扫和补输出逻辑。

解决方案：

```dos
ajEngine = createAsofJoinEngine(name="aj1", leftTable=trades, rightTable=quotes, outputTable=prevailingQuotes, metrics=<[price, bid, ask, abs(price-(bid+ask)/2)]>, matchingColumn=`sym, timeColumn=`time, useSystemTime=false)
```

分析：双流匹配一旦手工写开，脚本复杂度很快失控。优先查专用引擎。

## 5. 历史回放仍手工 `insert` 循环推进

目标：用历史数据复现实时链路，同时别再维护批流两套逻辑。

低效写法：

```dos
for(i in 0:hist.size()-1){
    tableInsert(streamTb, hist.row(i))
}

// 另一边再单独写一套 batchFactor(hist)
```

分析：回放层自己被写成了逐条投喂循环。

解决方案：

```dos
replay(inputTables=hist, outputTables=streamTb, dateColumn=`date, timeColumn=`time)

// 同一份表达式同时给 SQL 和流引擎 metrics 使用
```

分析：历史数据模拟实时流先看 `replay` 或 `replayDS`。同一因子若还保留一套独立 batch 版本，再继续查共享表达式或共享函数路线。

## 6. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| 订阅批次表处理 | 回调里仍逐条拆消息 | 批次当表处理 |
| 响应式状态引擎 | 历史窗口或状态缓存还在手工维护 | 状态型增量计算 |
| 时序引擎 | 时间窗口指标还在手工切窗 | 时序聚合 |
| `prev` / `tmove` / `cumfirstNot` / `ratios` | 实时序列指标还在手工追踪历史记录 | 小序列算子 |
| 引擎流水线 | 多阶段流计算还在串中间流表 | 多步实时处理 |
| `createAsofJoinEngine` | 双流匹配还在手工缓存 | 实时邻近 join |
| `replay` / `replayDS` | 历史回放还在写投喂循环 | 历史模拟实时流 |
