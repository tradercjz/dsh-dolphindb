# sql测试要点
根据不同的测试对象，列举一些通用的测试要点。具体还需要根据测试功能来决定。

## 1 sql测试要点
1）SQL语句作用于内存表的结果是否正确

内存表需要注意：

长度小于/等于/大于1024

长度大于2000000

0行的表

只有一列

只有一行

作用于symbol列

（2）SQL语句作用于分布式表的结果是否正确

分布式表需要注意：

分区表

同内存表

分区数要大于1

维度表

同内存表，特别注意空的维度表


（3）能否在自定义函数中使用

（4）序列化和反序列化

在节点1中创建该SQL语句，并封装在函数中，通过rpc, xdb, remoteRun等远程调用函数发送到节点2，节点2得到的结果是否正确。由于这项测试需要多个节点，所以放到cluster_mode中。

function view和scheduleJob中使用该SQL语句，校验能否正常addFunctionView和定义scheduleJob，并且节点重启是否正常，重启后需要执行function view和等待scheduleJob执行结束，验证执行结果是否符合预期。重启相关的用例先在本地手动测试，没问题之后写成用例放在restart_testing中。

（5）是否支持关键字大小写和换行。

（6）与其他SQL关键字一起使用是否正常。

（7）用法应当与标准SQL兼容。

### olap存储引擎特有的功能测试点
(1) 需要覆盖分区列/非分区列

### tsdb存储引擎特有的功能测试点

tsdb存储引擎和olap引擎底层架构不同，测试点上也大有不同。tsdb架构请参考
TSDB架构简介 

（1）建表参数多了sortColumns, keepDuplicates, sortKeyMappingFunction, softDelete四个参数，因此数据正确性的测试 需要结合这四个参数不同取值来测试。

（2）需要考虑level file和cache的关系（对于同一个分区而言）：

从cacheEngine中查询，没有zonemap优化

level file keyIndexEntry会存储每个列min, max, sum, count等属性，用于查询优化。只有从磁盘中查询数据时才会用到zonemap优化，需要考虑：

单个level file

多个level file

level file merge

从磁盘+cacheEngine中查询

指定合并levelFile函数后，要等待merge完成，具体检查函数见
D20-2941:TSDB merge 逻辑相关内存消耗优化
 ；

### pkey存储引擎特有的功能测试点

pkey采用与tsdb相同的数据结构LSM-Tree，不同的是，pkey采取列存方式，而不是PAX，并增加了delete bitmap和自定义索引的概念。pkey设计方案参见
主键存储引擎设计方案 | 1. 背景
 

（1）建表参数多了primaryKey和indexes，数据正确性的测试需结合这两个参数进行测试。

（2）同tsdb，需考虑level file和cache的关系：

从cacheEngine中查询，没有zonemap优化

zonemap会记录每个block中的max和min，只有在flush之后才会生成，需要考虑：

单个level file

多个level file

level file merge

zonemap设计文档
TSDB查询和存储格式细化测试
 

从磁盘+cacheEngine中查询

可通过triggerPKEYCompaction(chunkId, [async=true])手动触发合并（注意：triggerIotCompaction是TSDB的合并函数）

（3）delete bitmap会标记哪些数据已被删除，数据量达到PKEYDeleteBitmapUpdateThreshold设定的阈值时更新，也可通过updatePKEYDeleteBitmap(chunkId)手动触发。

### iotdb存储引擎特有的功能测试点

 iotdb在tsdb的基础上引入了静态表和最新值缓存表，并且支持了IOTANY列物联网点位管理引擎 ,相关技术细节
点位管理
 。特有的测试点包括

(1)建表参数多了latestKeyCache和compressHashSortKey，指定hashMappingFunction，且sortColumns大于2列时，compressHashSortKey默认为true，开启sortColumns列压缩，测试时需要覆盖这种分区表

(2)建表时需要区分是否包含IOTANY列测试

(3)clearAllIOTDBStaticTableCache,clearAllIOTDBLatestKeyCache，清除静态表和最新值缓存表后的正确性
