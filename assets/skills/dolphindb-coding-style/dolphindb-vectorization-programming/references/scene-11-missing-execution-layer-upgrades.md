# 场景 11：现有写法已接近目标语义，性能提升主要依赖 JIT、并行与分布式执行

场景介绍：

前面的语义和承载层已经大体摆对，代码还是被解释开销、单线程或并发组织方式卡住。这一组问题不要最先看。它是后面的升级路线。当前先看 `JIT`、`reduce/accumulate` 的执行层改写和单机并行。分布式写入、分布式查询、`mr/imr` 当前先只保留升级导航，不放进主案例。

以下是一些典型的例子：

## 1. 强前态依赖逻辑暂时拆不掉

目标：保留递推结构，同时把执行速度提起来。

低效写法：

```dos
x = 1 3 -2 4 -1 5
signal = 1 1 0 1 0 1
state = 0.0
re = array(DOUBLE, x.size())
for(i in 0:x.size()-1){
    if(signal[i] == 1)
        state = max(state + x[i], 0)
    else
        state = state * 0.95
    re[i] = state
}
```

分析：这类问题短时间内很难改成稳定的纯向量表达。继续用解释执行，循环体开销会一直存在。

解决方案：

```dos
@jit
def calcState(x, signal){
    state = 0.0
    re = array(DOUBLE, x.size())
    for(i in 0:x.size()-1){
        if(signal[i] == 1)
            state = max(state + x[i], 0)
        else
            state = state * 0.95
        re[i] = state
    }
    return re
}
```

分析：这里先承认递推结构暂时保留，再把热点循环切到 `JIT`。

## 2. 分组递推仍在 `context by` 里跑解释型函数

目标：保留分组承载层，只把组内热点递推提速。

低效写法：

```dos
def holdingCost(price, qty){
    state = 0.0
    re = array(DOUBLE, price.size())
    for(i in 0:price.size()-1){
        state = state + price[i] * qty[i]
        re[i] = state
    }
    return re
}

select id, time, holdingCost(price, qty) as cost from t context by id csort time
```

分析：外层分组路线已经摆对了，慢点集中在组内递推函数本身。

解决方案：

```dos
@jit
def holdingCost(price, qty){
    state = 0.0
    re = array(DOUBLE, price.size())
    for(i in 0:price.size()-1){
        state = state + price[i] * qty[i]
        re[i] = state
    }
    return re
}

select id, time, holdingCost(price, qty) as cost from t context by id csort time
```

分析：`context by` 继续承接分组和排序，`JIT` 只负责组内热点递推核。

## 3. 独立重任务仍停留单线程，或并发写普通对象

目标：把已经能自然拆分的重任务放到多核上跑，同时保证结果正确。

低效写法：

```dos
result = table(100:0, `factor`score, [SYMBOL, DOUBLE])
for(x in jobs){
    score = calc(x)
    tableInsert(result, x, score)
}
```

分析：子任务彼此独立，却还在单线程串行执行。后续若直接改成并发写普通对象，还会再引入线程安全问题。

解决方案：

```dos
share result as sharedResult
scores = peach(calc, jobs)
```

分析：先确认子任务彼此独立，再判断每个子任务是否足够重。并发写同一对象时，再先检查 `share` 或改成最后统一合并。

## 4. 只需要最终递推结果，代码仍手工写终值循环

目标：只保留最终递推结果。

低效写法：

```dos
v = 1 2 3 4 5
state = 0
for(x in v){
    state = state + x
}
re = state
```

分析：中间路径不会被使用，循环只是在维护一个终值。

解决方案：

```dos
@jit
def addState(x, y){
    return x + y
}

re = reduce(addState, v)
```

分析：`reduce` 负责迭代形态，`JIT` 负责单步状态转移。只要终值时，这条路很顺。

## 5. 需要完整递推路径，代码仍手工维护结果数组

目标：保留每一步递推结果。

低效写法：

```dos
v = 1 2 3 4 5
state = 0
re = array(INT, v.size())
for(i in 0:v.size()-1){
    state = state + v[i]
    re[i] = state
}
```

分析：代码同时维护前一步状态和完整结果数组，外层循环负担很重。

解决方案：

```dos
@jit
def addState(x, y){
    return x + y
}

re = accumulate(addState, v)
```

分析：`accumulate` 直接返回每一步状态。后面若还要按组承载，再把它挂到 `context by` 或流场景里。

## 6. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `@jit` | 强前态依赖逻辑暂时拆不掉 | 保留递推结构后提速 |
| `reduce + JIT` | 只需要终值，单步又很重 | 终值递推提速 |
| `accumulate + JIT` | 需要完整递推路径，单步又很重 | 完整路径递推提速 |
| `peach` / `ploop` | 独立重任务仍停留单线程 | 多核并行 |
| `share` | 并行子任务还在并发写普通对象 | 共享对象与线程安全 |
| `isValid` | `JIT` 里还在用 `x==NULL` | 判空改写 |
| 接口转换开销 | 只是简单内置函数包装也想上 `JIT` | 判断是否值得切 `JIT` |
| 分布式升级导航 | 单机语义已经摆对，但瓶颈进入集群执行层 | 后续再查分布式专题 |
