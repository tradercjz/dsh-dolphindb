# 计算函数测试要点
根据不同的测试对象，列举一些通用的测试要点。具体还需要根据测试功能来决定。

计算函数的测试要点包括：

## 1 异常场景

（1）对函数的每个参数进行检验。输入非法的数据类型和数据结构，预期能够抛出异常或者返回空值。如果导致系统crash或者返回乱七八糟的值，则判定为bug。

容易遗漏的数据类型：VOID

容易遗漏的数据结构：
- 空的tuple，比如[]
- tuple中元素的数据类型不一致，比如[[1,2,3], 'a]
- array vector
- dict的值键值和要求不符
- dict的value数据类型和要求不符
- 如果参数支持tuple ,要测试columnar tuple

（2）如果函数的多个参数有长度一致性的要求，需要测试每个参数长度不一致的情况，预期能否抛出异常。

- 入参的vector长度不一致
- 入参的matrix,table行数或者列数长度不一致，行数和列数不一致都要有case
- 入参的字典大小不一致

（3）如果某个函数的可选参数很多，在测试某个可选参数的检验时，需要指定该参数前面的所有可选参数。例如，

ewmCorr(X, [com], [span], [halfLife], [alpha], [minPeriods = 0], [adjust = true], [ignoreNA = false], [other], [bias = false])

在校验bias非法输入时，需要指定前面所有参数为合法输入

## 2 正常场景

（1）合法参数需要涵盖支持的所有数据类型 × 数据结构，返回的结果是否符合预期。

DolphinDB支持的数据类型参考`references/doc_datatypes.md`，测试时需要将这些数据类型都覆盖到，需要结合实际来判断是否应该支持某种数据类型。特别需要注意，200及以上分支支持decimal类型和array vector类型。

数据类型需要注意：

- 每种类型的空值
- 每种类型的最小值和最大值
- 如果参数支持的数据类型为数值，那么需要测试是否支持short,int,long,double,float,decimal32,decimal64,decimal128。每种类型都要测试大于等于小于0的场景。
- 测试double，float和decimal类型时，需要构造小数部分不为0的数据，不能只有整数转浮点数的数据。
- 如果参数支持的类型为字符串，那么需要测试是否支持string，symbol，blob。

（2）计算函数支持的数据结构遵循以下规则。

**函数分类：**

- 标量函数：输入标量，返回结果也是标量的函数，如signbit，sin等。
- 向量函数：返回结果是向量的函数。向量函数又分成：
  - 序列函数：如deltas，ratios等。
  - cum系列函数
  - m系列函数
  - tm系列函数
- 聚合函数：输入向量，返回标量的函数。

| 函数分类/数据结构 | scalar | vector | tuple | array | matrix | pair | dict | set | table | vector array |
|------------------|--------|--------|-------|-------|--------|------|------|-----|-------|--------------|
| **标量函数** | √ | √ | √ | √ | √ | √ | × | √ | | |
| **向量函数** | | | | | | | | | | |
| 序列函数 | √ | √ | √ | √ | √ | √ | × | √ | | |
| cum系列函数 | √ | √ | √ | × | √ | √ | √ | × | √ | |
| m系列函数 | √ | √ | √ | × | √ | √ | √ | × | √ | |
| tm系列函数 | √ | √ | × | × | √ | √ | × | × | √ | |
| **聚合函数** | √ | √ | ? | √ | √ | √ | ? | ? | √ | |

（3）测试所有支持的数据结构和数据类型都要覆盖：

- 全为空值
- 部分空值
- 没有空值
- 长度为0
- 0行或0列的matrix
- 全部为相同的值，比如全为0，全为1，全为某个浮点数等。
- 向量，矩阵，表，字典，tuple，集合要覆盖
  -  长度小于/等于/大于1024
  -  长度小于/等于/大于1024
  -   长度很大
- 如果支持向量要覆盖：使用bigarray创建，且大于8388608 bytes
- 如果支持矩阵要覆盖: 行数和列数超过1024或者总长度大于8388608 bytes
- 参数支持向量时要测试subarray，支持矩阵要测试view of matrix
  - view of matrix用loc函数生成，需要指定view=true
- 如果支持 array vector必须测试以下几点
  - 一个单元的数组长度：小于256，小于65536和大于等于65536
  - 长度小于1024，大于等于1024
  - 长度很大
- 需要测试各个参数支持的数据结构组合，比如a，b参数都支持所有类型，要测试a是标量的情况下，b是标量/向量/表等类型

（4）函数是否会修改原输入对象的值，验证执行函数后，输入对象本身没有改变，除非该函数本身设计会改变输入对象的值（一般会加感叹号，如nullFill！）；

（5）如果是聚合函数和向量函数，需要测试在sql查询中的正确性，包括加上groupby和contextby结果的正确性

（6）如果分布式表也支持，需要验证分布式表的正确性，不支持写成异常用例；需要验证 1.所有支持的数据类型 2.结合groupby和contextby使用
- 如果支持array vector 类型，需要测试TSDB 分布式表的计算


（7）通过keyword传参的方式调用函数

## 3 流计算是否支持模块

部分计算函数需要流批同时支持，测试前需要确认该函数是否支持在流计算引擎中使用。

一些原则：
- 聚合函数需要支持timeSeriesEngine，dailyTimeSeriesEngine，crossSectionalEngine
- cum系列，row系列，m系列，tm系列函数需要支持reactiveStateEngine

当新增函数支持流引擎时，需要补充以下要点：

（1）流计算引擎通用测试要点
- 异常检验：测试所有不支持的数据类型，包含arrayvector，不支持的数据类型写成exception expected的用例。
- 正确性校验：
  - metrics中包含keyColumn，timeColumn和joinColumn等。
  - 覆盖当前函数支持的所有数据类型，特别注意array vector类型。
  - double、float、decimal类型需构造小数部分不为0的数据。
  - 分组数：小于1024，大于1024
  - 写入数据的顺序：按照时间乱序排列、按照keyColumn乱序排列
  - useSystemTime=true和false的情况
  - 不同参数组合的情况
  - snapshot的恢复,case可以参考 [snapshot](../../examples/streaming_test_case/test_streaming_reactive_snapshot.txt) 
  - 输入一行数据后验证/多行数据后验证

- addMetrics校验：
    - 包含keyColumn，timeColumn和joinColumn等
    - 新增metrics后，继续写入数据，校验新增metrics的正确性

（2）如果函数支持reactiveStateEngine，除了通用点需要增加测试
- 算子使用方式：在自定义状态函数中使用支持的函数进行验证。
- 指定keyPurgeFilter和keyPurgeFreqInSecond，并且要达到清理keys的条件。case可以参考 [delete_part](../../examples/streaming_test_case/test_function_createReactiveStateEngine_20.txt) 中`delete_part`的用例

## 4 性能测试

计算函数需要进行性能测试。需要测试小数据量（fastarray）和大数据量（hugearray）两种情况。



# 5 并发测试
一般而言，我们可以通过submitJob提交多个后台任务，或者通过ploop和peach高阶函数构造多线程并发的场景。

两者的区别是：

- submitJob需要提交多个任务才能构造出并发的场景，最大并发度取决于配置项maxBatchJobWorker。
- ploop和peach执行默认就是多线程，最大并发度取决于配置项workerNum/localExecutors。


# 6 batchJob
在测试多线程时，通过submitJob提交的后台任务，需要使用getJobReturn(jobId, true)来等待后台任务完成。

如果提交了执行耗时很长的后台任务，测试用例最后需要将该后台任务取消，否则将会一直占用系统的batchJobWorker资源。后续提交的后台任务，可能会因为没有空闲的batchJobWorker而不能执行。以下是取消后台任务的例子：
```dolphindb
def f1(){
    do{
        sleep(1000)
    }while(true)
}
jobId = submitJob("test1", "", f1)
cancelJob(jobId)
try{
    getJobReturn(jobId, true)
}catch(ex){print ex}
```
上面代码中，提交了一个死循环的后台任务，该任务一直不能结束。DolphinDB接收到cancelJob的指令后，会将未执行的子任务取消，而正在执行的子任务是无法取消的，所以需要等待一会该后台任务才能结束，这时候要通过getJobReturn(jobId, blocking=true)来等待任务结束。

## 7 循环和超时
DolphinDB的测试框架没有超时机制，如果在测试用例中编写死循环，会导致测试任务一直无法结束。因此，在编写用例时应当避免使用死循环。如果需要等待一些任务完成或者状态变更（比如：level file合并、recovery任务完成），需要设定等待超过一定时间（比如：5分钟）就退出循环。