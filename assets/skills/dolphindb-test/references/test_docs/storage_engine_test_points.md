3.9 存储引擎通用的测试点

3.9.1 功能测试

以下表格列出了olap和tsdb存储引擎对于DDL和DML操作的支持情况（以下操作均支持事务）：

| 操作类型 | 相关函数和语句 | olap存储引擎 | tsdb存储引擎 | pkey存储引擎 | iotdb存储引擎 | imoltp存储引擎 |
|---------|---------------|-------------|-------------|-------------|--------------|---------------|
| 1 | 建库 | database/create database | √ | √ | √ | √ | √ |
| 2 | 删库 | dropDatabase/drop database | √ | √ | √ | √ | √ |
| 3 | 建分布式表 | createPartitionedTable/create table | √ | √ | √ | √ | ×（使用createIMOLTPTable建表） |
| 4 | 建维度表 | createTable/create table | √ | √ | √ | × | × |
| 5 | 删表 | dropTable/drop table | √ | √ | √ | √ | √ |
| 6 | 重命名表 | renameTable | √ | √ | √ | √ | × |
| 7 | 增加value分区 | addValuePartitions | √ | √ | √ | √ | × |
| 8 | 增加range分区 | addRangePartitions | √ | √ | √ | √ | × |
| 9 | 自动增加value分区 | newValuePartitionPolicy=add | √ | √ | √ | √ | × |
| 10 | 删除分区 | dropPartition | √ | √ | √ | √ | × |
| 11 | 设置库的原子性级别 | setAtomicLevel | √ | √ | √ | √ | × |
| 12 | 设置数据保留策略 | setRetentionPolicy | √ | √ | √ | √ | × |
| 13 | 启动异步复制 | setDatabaseForClusterReplication | √ | √ | √ | √ | × |
| 14 | 写入数据 | append/tableInsert/loadTextEx/insert into（需要配置enableInsertStatementForDFSTable=true） | √ | √ | √（不支持loadTextEx） | √ | √（不支持loadTextEx） |
| 15 | 更新数据 | update/upsert/tableUpsert | √ | √ | √ | √ | √ |
| 16 | 删除数据 | delete/truncate | √ | √ | √ | √ | √（不支持truncate） |
| 17 | 增加列 | addColumn/alter | √（200开始支持） | √ | × | √ | × |
| 18 | 删除列 | dropColumns!/alter | √（200开始支持） | × | × | × | × |
| 19 | 重命名列 | rename!/alter | √（200开始支持） | × | × | × | × |
| 20 | 修改列的类型 | replaceColumn! | √（200开始支持） | × | × | × | × |
| 21 | 设置列的注释 | setColumnComment | √ | √ | √ | √ | × |
| 22 | 设置表的注释 | setTableComment | √（2.00.13和3.00.1开始支持） | √（2.00.13和3.00.1开始支持） | √（2.00.13和3.00.1开始支持） | √ | × |
| 23 | 设置表的敏感列 | setTableSensitiveColumn | √（2.00.15和3.00.3开始支持） | √（2.00.15和3.00.3开始支持） | √（2.00.15和3.00.3开始支持） |  | × |

注意：

addValuePartitions, addRangePartitions, newValuePartitionPolicy=add, dropPartition(deleteSchema=true), setAtomicLevel, setRetentionPolicy, setDatabaseForClusterReplication这些操作会修改数据库的domain

renameTable, addColumn, dropColumns!, rename!, replaceColumn!, setColumnComment, setTableComment这些操作会修改表的tbl

关于存储引擎数据正确性的校验，需要从以下几个方面考虑：

（1）从cacheEngine和缓存中查询数据的正确性。

（2）数据压缩、解压缩的正确性。目前支持这几种压缩算法：lz4, delta, zstd, chimp。

（3）从磁盘中查询数据的正确性，olap引擎通过purgeCacheEngine刷盘；tsdb,iotdb引擎通过flushTSDBCache刷盘，通过triggerTSDBCompaction触发合并；pkey引擎通过flushPKEYCache刷盘，通过triggerPKEYCompaction触发合并。

（4）schema的校验，执行蓝框中的操作后，需要校验schema(db)和schema(tb)的完整性和正确性。

（5）重启后的数据正确性。

（6）表格中的操作能否回滚，需要使用testCommitFailure在集群中执行（该函数用于模拟一阶段提交失败）。

3.9.2 与其他组件结合

（1）备份恢复

通过backup, restore, backupDB, restoreDB等函数，对存储引擎进行备份恢复的结果是否正常。

（2）权限控制

需要测试与数据库、表相关的权限（如DB_READ, DB_WRITE等），应用于存储引擎是否正常。

（3）异步复制

该存储引擎3.9.1中的操作能否通过异步复制同步到从集群。

（4）分级存储

该存储引擎的数据，能够通过分级存储，将冷数据存储到其他盘或者s3上。

（5）recovery相关

需要测试存储引擎，副本recovery是否正常。测试步骤如下：

集群配置双副本，先建库建表，写入一点数据

关闭其中一个数据节点，保证分区至少有一个副本在线

继续写入数据或者进行更新删除操作

重启步骤2关闭的节点

通过getRecoveryTaskStatus()函数确认是否发起了recovery，以及recovery任务是否完成

recovery任务完成后，从重启的节点查询和写入是否正常

（6）rebalance相关

moveReplicas, copyReplicas, deleteReplicas等函数操作存储引擎的分区是否正常。

3.9.3 稳定性

不需要重启的场景：

（1）并发操作。

（2）长时间进行事务操作，数据和元数据都正确，节点状态正常，没有内存泄漏，文件能够正常回收。

需要重启（kill进程或者断电）的场景：

（1）进行事务操作之后，结合takeMasterCheckpoint和chunkCheckPoint，重启。

（2）进行事务操作过程中，结合takeMasterCheckpoint和chunkCheckPoint，重启。

3.9.4 性能测试

与市面上其他相同类型的数据库进行性能对比测试，挖掘性能不足。

3.10 tsdb存储引擎特有的功能测试点

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

3.11 pkey存储引擎特有的功能测试点

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

3.12 iotdb存储引擎特有的功能测试点

 iotdb在tsdb的基础上引入了静态表和最新值缓存表，并且支持了IOTANY列物联网点位管理引擎 ,相关技术细节
点位管理
 。特有的测试点包括

(1)建表参数多了latestKeyCache和compressHashSortKey，指定hashMappingFunction，且sortColumns大于2列时，compressHashSortKey默认为true，开启sortColumns列压缩，测试时需要覆盖这种分区表

(2)建表时需要区分是否包含IOTANY列测试

(3)clearAllIOTDBStaticTableCache,clearAllIOTDBLatestKeyCache，清除静态表和最新值缓存表后的正确性
