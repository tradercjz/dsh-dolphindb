3.7 流计算引擎测试

3.7.1 流计算引擎通用测试要点

（1）参数校验

特别注意以下异常情况：

- metrics为不支持的算子
- 写入数据的数据类型、列数与dummyTable不一致
- metrics的数量与outputTable不一致
- outputTable的前面几列不符合要求：不是分组列、不是时间列等
- outputTable的数据类型与实际不符
- timeColumn，keyColumn，joinColumn等在dummyTable不存在

（2）正确性校验，按照流计算引擎的计算逻辑验证输出结果的正确性。注意，批流计算结果是否一致。

特别注意以下情况：

- metrics中包含keyColumn，timeColumn和joinColumn等
- 覆盖支持的所有算子和数据类型。特别注意array vector类型，有些引擎可能dummyTable有array vector类型，创建时不报错，写入数据会报错。
- 分组数：小于1024，大于1024
- 写入数据的顺序：按照时间乱序排列、按照keyColumn乱序排列
- useSystemTime=true和false的情况
- 不同参数组合的情况
- snapshot的恢复

（3）addMetrics的测试。

新增的metrics需要覆盖以下情况：

- 包含keyColumn，timeColumn和joinColumn等
- 新增metrics后，继续写入数据，校验新增metrics的正确性

（4）运维函数getStreamEngineStat, getStreamEngineList和dropStreamEngine（别名：dropAggregator）的测试。

3.7.2 reactiveStateEngine测试要点

流计算reactiveStateEngine支持的所有函数都是单独实现的，因此在测试reactiveStateEngine支持某个函数时，需要按照新函数的测试要点进行测试，否则有些代码会覆盖不到：

（1）参数校验，包括数据类型。不支持的数据类型写成exception expected的用例

（2）支持的所有数据类型。测试double，float和decimal类型时，需要构造小数部分不为0的数据，不能只有整数转浮点数的数据。

（3）不同key的个数需要测试<1024, >=1024

（4）keyColumn的数据有序，乱序的情况；通过take和rand函数生成keyColumn列的数据

（5）在自定义状态函数中使用支持的函数

（6）指定keyPurgeFilter和keyPurgeFreqInSecond，并且要达到清理keys的条件。reactiveStateEngine每支持一个函数都会有一个相应的增加keys和删除keys的函数，比如MovingSLRReactiveState::addKeys和MovingSLRReactiveState::removeKeys，对应的是mslr增加和删除key的函数。这部分的case可以参考unit_testing/test_function_createReactiveStateEngine_20.txt中delete_part的用例。

（7）指定snapshotDir和snapshotIntervalInMsgCount，并且要测试到从snapshot文件中恢复引擎状态。reactiveStateEngine每支持一个函数都会有一个相应的snapshotState和restoreState的函数。这部分的case可以参考streaming_testing/test_streaming_reactive_snapshot.txt。特别是，当函数输入的数据类型为string和symbol时，从snapshot恢复会比较容易出问题。
