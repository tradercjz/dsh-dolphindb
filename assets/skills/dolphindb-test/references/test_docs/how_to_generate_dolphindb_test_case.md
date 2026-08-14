# 如何编写 DolphinDB 测试用例

DolphinDB server端和插件的测试，采用内置的测试框架编写自动化测试脚本。本文主要介绍DolphinDB测试用例的编写规范。

## 1. 测试用例分类

### 1.1 server端测试

server端的测试分为：

- **单元测试**  
  单元测试用例在/dolphindb_test/testing/unit_testing文件夹中，涵盖各个函数的功能测试及SQL语句基本功能测试。

- **OLAP engine测试**  
  olap引擎的用例在/dolphindb_test/testing/olap_engine文件夹中，分成cluster_mode（集群模式）和single_mode（单节点模式），每个目录下又细分tabletSingle（分区粒度为table）和tabletMultiple（分区粒度为database）。包括集群和单节点中分布式数据库的基本操作测试及权限测试。

- **TSDB engine测试**  
  从2.0版本开始，DolphinDB支持TSDB engine。TSDB engine的测试用例是在olap engine测试用例的基础上改写，再加上TSDB engine自己特性（点查、去重、level file合并等等）的测试用例。

- **IOTDB engine测试**  
  从2.0.05和3.0.02开始，DolphinDB支持IOTDB engine。IOTDB engine的测试用例是在tsdb engine测试用例的基础上改写，再加上IOTDB engine自己特性（IOTANY列的支持，最新值缓存等等）的测试用例。

- **IMOLTP engine测试**  
  从3.0版本开始，DolphinDB支持IMOLTP（in-memory OLTP）engine。目前该引擎仅支持单机点模式。特别地，需要配置enableIMOLTPEngine=true才能启用该引擎。

- **PKEY engine测试**  
  从3.0版本开始，DolphinDB支持PKEY（主键）engine。PKEY engine的测试用例是在TSDB engine用例的基础上进行修改，再加上PKEY engine自己特性（主键列，uniqueFlag，index查询优化等等）的测试用例。特别地，需要配置enablePKEYEngine=true才能启用该引擎。

- **流数据测试**  
  流计算测试用例在/dolphindb_test/testing/streaming_testing文件夹中，涵盖集群中本节点/远程节点处理流数据的测试及流计算引擎的测试。

- **高可用流数据测试**  
  高可用流计算测试用例在/dolphindb_test/testing/streaming_testing文件夹中，涵盖集群中本节点/远程节点处理流数据的测试及流计算引擎的测试。

- **JIT测试**  
  JIT（即时编译）功能仅在特定的DolphinDB版本中提供。测试内容是JIT支持的函数和语句的测试。

- **arm测试**  
  DolphinDB提供了arm版本，可运行在arm芯片上。由于arm版本内存和磁盘受限，arm版本仅测试简单的计算功能和查询功能。

- **场景测试**

### 1.2 插件测试

插件是 DolphinDB 与其他系统耦合的工具。插件测试用例在/dolphindb_test/testing/plugin_testing文件夹中，每个插件再细分一个子目录。每个插件的测试数据放在对应目录setup/data目录中。

## 2. 测试用例的编写

本章主要介绍DolphinDB server端和插件测试用例的文件、单个用例的命名规范。

### 2.1 测试文件的命名

#### 2.1.1 单元测试

单元测试在unit_testing目录。DolphinDB单元测试的对象分为以下几类：

- 与dfs不相关的函数
- 数据类型
- 数据结构
- SQL语句
- 编程语句
- 其他

##### （1）与dfs不相关的函数

与dfs不相关的函数是指数学函数、统计函数等。与dfs相关的函数放到系统测试中。

单元测试中，这些函数的测试文件的命名方式是test_function_<functionName>.txt。

<functionName>替换成需要测试函数，比如test_function_avg.txt。

##### （2）数据类型

DolphinDB中可以使用函数、符号等声明数据类型。因此，数据类型的测试用例也纳入到函数中，测试文件的命名方式也是test_function_<functionName>.txt，比如test_function_boolean.txt。

##### （3）数据结构

同样地，DolphinDB中使用函数声明数据结构。因此，数据类型的测试用例也纳入到函数中，测试文件的命名方式也是test_function_<functionName>.txt，比如test_function_table.txt。

##### （4）SQL语句

SQL语句应用到内存表的测试文件的命名方式是test_topic_sql_<SQL Statement>.txt。<SQL Statement>替换成需要测试的SQL语句，比如test_topic_sql_delete.txt。

SQL中tablejoiner的测试文件的命名方式是test_topic_table_join.txt。替换成需要测试的joiner，比如test_topic_table_join_ej.txt。

##### （5）编程语句

#### 2.1.2 系统测试

系统测试在olap_engine, tsdb_engine, iotdb_engine, pkey_engine, imoltp_engine目录中。DolphinDB系统测试的对象分为以下几类：

- 与dfs相关的函数
- 存储引擎相关的功能
- 数据类型的序列化和反序列化
- 数据结构的序列化和反序列化
- SQL语句
- 权限控制
- 其他

##### （1）与dfs相关的函数

与dfs相关的函数是指建库建表，分布式表操作和运维的函数。

只能在master/controller上执行的函数的测试文件的命名方式是test_dfs_master_function_<functionName>.txt。<functionName>替换成需要测试的函数，比如test_dfs_master_function_getClusterChunksStatus.txt。在master/controller上执行的函数一般都是运维和管理函数。

只能在datanode上执行的函数的测试文件的命名方式是test_dfs_node_function_<functionName>.txt。<functionName>替换成需要测试的函数，比如test_dfs_node_function_loadTable.txt。

##### （2）存储引擎相关的功能

比如tsdb_engine特有的level file合并、点查，支持向量检索（vectordb）等；pkey_engine特有的index查询，支持文本检索（textdb）等；iotdb_engine特有的支持IOTANY类型等。

##### （3）数据类型

系统测试中，数据类型的测试包括：

- 节点间的序列化和反序列化是否正常
- 写入到dfs是否正确，读取是否正常
- 要测试新增数据类型在备份与恢复功能中的正确性

这类测试文件的命名方式是test_topic_<dataType>.txt。<dataType>替换成需要测试的数据类型，比如test_topic_symbol_base.txt。

##### （4）数据结构

系统测试中，数据结构的测试包括：

- 节点间的序列化和反序列化是否正常
- 在SQL查询中解析是否正确

这类测试文件的命名方式是test_topic_<dataForm>.txt。

##### （5）SQL语句

SQL语句应用到分布式表的测试文件的命名方式是test_dfs_topic_<SQL Statement>.txt。<SQL Statement>替换成需要测试的SQL语句，比如test_dfs_topic_orderby.txt。

##### （6）权限控制

权限控制(user access control)的测试文件的命名方式是test_uac_function_<functionName>.txt。<functionName>替换成需要测试的权限控制函数，比如test_uac_function_grant.txt。

##### （7）其他

不属于以上几类的测试文件的命名方式是test_dfs_topic_<topicName>.txt。

#### 2.1.3 插件测试用例

插件测试用例在plugin_testing，每个插件对应一个目录。目录名称采用小写英文字母，比如httpclient，而不是httpClient。

一般来说，每个插件目录下只有一个测试文件，命名方式是test_<pluginName>.txt。

<pluginName>替换成需要测试的插件名称，同样采用小写英文字母，比如test_httpclient.txt。

### 2.2 编写测试用例

以unit_testing/test_function_skew.txt为例，介绍测试用例的组成。

- 测试用例声明和名称之间用等号连接，一个声明表示一个测试用例。
- 每个测试用例的名称不能相同
- 一个测试用例中可以有多个断言。assert之后是断言的编号，断言编号不能重复。
- 断言后面是判定的内容，一般都是判断实际和预期是否符合。

常用的几种判断的方式：
- eqObj: 最严格的判断，包括数值和类型。
- eqFloat: 用于浮点数的判断。
- eq(= =): 可以用于整型、时间类型和字符串的判断。注意，浮点数的判断需要指定小数位数。

## 3. 测试要点

根据不同的测试对象，列举一些通用的测试要点。具体还需要根据测试功能来决定。

### 3.1 新增计算函数

新增计算函数的测试要点包括：

#### 3.1.1 非法参数检验

（1）对函数的每个参数进行检验。输入非法的数据类型和数据结构，预期能够抛出异常或者返回空值。如果导致系统crash或者返回乱七八糟的值，则判定为bug。

容易遗漏的数据类型：VOID

容易遗漏的数据结构：
- 空的tuple，比如[]
- tuple中元素的数据类型不一致，比如[[1,2,3], 'a]
- array vector
- dict的值键值和要求不符
- dict的value数据类型和要求不符

（2）如果函数的多个参数有长度一致性的要求，需要测试每个参数长度不一致的情况，预期能否抛出异常。

- 入参的vector长度不一致
- 入参的matrix,table行数或者列数长度不一致，行数和列数不一致都要有case

（3）如果某个函数的可选参数很多，在测试某个可选参数的检验时，需要指定该参数前面的所有可选参数。例如，

ewmCorr(X, [com], [span], [halfLife], [alpha], [minPeriods = 0], [adjust = true], [ignoreNA = false], [other], [bias = false])

在校验bias非法输入时，需要指定前面所有参数为合法输入

#### 3.1.2 合法参数

（1）合法参数需要涵盖支持的所有数据类型 × 数据结构，返回的结果是否符合预期。

DolphinDB支持的数据类型参考用户手册 https://www.dolphindb.cn/cn/help/200/DataTypesandStructures/DataTypes/index.html，测试时需要将这些数据类型都覆盖到，需要结合实际来判断是否应该支持某种数据类型。特别需要注意，200及以上分支支持decimal类型和array vector类型。

数据类型需要注意：

- 空值
- 每种类型的最小值和最大值
- 如果参数支持的数据类型为数值，那么需要测试是否支持short,int,long,double,float,decimal32,decimal64,decimal128。
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

（3）测试支持的数据结构需要注意：

- 全为空值
- 部分空值
- 没有空值
- 长度为0
- 0行或0列的matrix
- 全部为相同的值，比如全为0，全为1，全为某个浮点数等。
- 连续内存存储
  - fast vector: 长度小于/等于/大于1024
  - fast matrix: 长度小于/等于/大于1024
- 不连续内存存储
- huge vector: 使用bigarray创建，且大于8388608 bytes
- huge matrix: 行数和列数超过1024或者总长度大于8388608 bytes
- subarray和view of matrix
  - 这两种数据结构不会复制数据，仅记录下标，在一些与位置相关的计算函数中，会容易出现bug，需要特别注意
  - view of matrix用loc函数生成，需要指定view=true
- arrayvector需要注意以下几点
  - 一个单元的数组长度：小于256，小于65536和大于等于65536
  - fast array vector：长度小于1024，大于等于1024
  - huge array vector

（4）函数是否会修改原输入对象的值，验证执行函数后，输入对象本身没有改变，除非该函数本身设计会改变输入对象的值（一般会加感叹号，如nullFill！）；

（5）如果是聚合函数和向量函数，需要测试在sql查询中的正确性，包括加上groupby和contextby结果的正确性，如果分布式表也支持，需要验证分布式表的正确性，不支持写成异常用例；

（6）通过keyword传参的方式调用函数

#### 3.1.3 流计算是否支持

部分计算函数需要流批同时支持，测试前需要确认该函数是否支持在流计算引擎中使用。

一些原则：

- 聚合函数需要支持timeSeriesEngine，dailyTimeSeriesEngine，crossSectionalEngine
- cum系列，row系列，m系列，tm系列函数需要支持reactiveStateEngine

#### 3.1.4 性能测试

计算函数需要进行性能测试。需要测试小数据量（fastarray）和大数据量（hugearray）两种情况。

性能标准：

- 如果在其他系统中有对标的函数，至少比其他系统快10倍。
- 如果在其他系统中没有对标的函数，要做到与DolphinDB中实现类似的函数性能相当。

### 3.2 新增运维函数

新增运维函数的测试要点包括：

（1）能否在不同类型的节点上执行：包括控制节点（高可用集群还要分leader和follower）、数据节点和计算节点。

（2）是否具有权限控制，比如是否要求admin用户使用，guest和其他用户能否使用。

一些原则：

- 文件操作相关的函数需要进行权限控制，否则会有安全漏洞；
- 修改配置项相关的函数需要进行权限控制；
- 非admin用户只能看到自己创建的东西，admin用户可以看到所有用户创建的东西。

（3）并发。运维函数一般是获取某些状态，需要测试该运维函数多线程并发调用，以及该运维函数与其他相关操作并发调用的情况。

（4）结果正确性。

（5）如果返回结果中包含时间，需要确认这个时间是零时区时间还是当前时区的时间。（我们统一使用当前时区的时间，而不是零时区时间）。

（6）逻辑性校验。比如，setTSDBCacheEngineSize不能超过maxMemSize的大小。

（7）性能。对于运维函数，如果统计的数据量很多，会不会出现性能下降。比如，创建了多个数据库和表，创建了多个流计算引擎等，具体要根据运维函数是统计什么对象来决定。

（8）如果是内存相关的运维函数，要特别注意string，symbol类型，arrayvector等的内存使用量是否统计正确。

### 3.3 新增数据类型

新增数据类型的测试要点包括：

（1）数据类型对应函数的测试，见3.1节。

（2）节点间的序列化和反序列化

- 在节点1中创建某种数据类型，通过rpc，xdb，remoteRun等远程调用函数发送到节点2，节点2得到的结果是否正确。由于这项测试需要多个节点，所以放到cluster_mode中。
- functionview和scheduleJob中使用该数据类型，校验能否正常addFunctionView和定义scheduleJob，并且节点重启是否正常，重启后需要执行functionview和等待scheduleJob执行结束，验证执行结果是否符合预期。重启相关的用例先在本地手动测试，没问题之后写成用例放在restart_testing中。

（3）写入到dfs是否正确，读取是否正常。需要覆盖所有的存储引擎。

将包含该数据类型的内存表append到dfs table，再从dfs table中读取出来的结果是否正确

（4）要测试分布式表的所有操作，包括3.8节列出的操作，以及备份与恢复功能

（5）流数据的支持，需要覆盖每种引擎，不支持的要写成异常case。

（6）class，jt等是否支持。如果不支持，需要写成异常用例。

### 3.4 新增数据结构
新增数据结构的测试要点包括：

（1）数据结构对应函数的测试，见 3.1 节。  
（2）验证在 SQL 中解析是否正确。例如在 `where` 子句中包含字典：
    ```dolphindb
    n = 10000
    t = table(rand(100, n) as id, rand(100.0, n) as val)
    d = dict(`A`B`C`D`E`F`G`H`I`J, 1..10)
    select * from t where id = d[`A]
    ```
（3）序列化和反序列化：
在节点1中创建某种数据结构，通过rpc, xdb, remoteRun等远程调用函数发送到节点2，节点2得到的结果是否正确。由于这项测试需要多个节点，所以放到cluster_mode中。

function view和scheduleJob中使用该数据结构，校验能否正常addFunctionView和定义scheduleJob，并且节点重启是否正常，重启后需要执行function view和等待scheduleJob执行结束，验证执行结果是否符合预期。重启相关的用例先在本地手动测试，没问题之后写成用例放在restart_testing中。

（4）覆盖入参是该数据结构的所有函数。比如，新增latestKeyedStreamTable这一类型的内存表，需要测试入参可以是表的所有函数。

（5）特别注意支持原地修改的函数入参为该数据类型时是否正常。可以用defs("%!")查询有哪些原地修改函数。

（6）class, jit等是否支持。如果不支持，需要写成异常用例。

### 3.5 SQL语句
（1）SQL语句作用于内存表的结果是否正确

内存表需要注意：

- 长度小于/等于/大于1024
- 长度大于2000000
- 0行的表
- 只有一列
- 只有一行
- 作用于symbol列

（2）SQL语句作用于分布式表的结果是否正确

分布式表需要注意：

- 分区表
  - 同内存表
  - 分区数要大于1
- 维度表
  - 同内存表，特别注意空的维度表

（3）能否在自定义函数中使用

（4）序列化和反序列化

在节点1中创建该SQL语句，并封装在函数中，通过rpc, xdb, remoteRun等远程调用函数发送到节点2，节点2得到的结果是否正确。由于这项测试需要多个节点，所以放到cluster_mode中。

function view和scheduleJob中使用该SQL语句，校验能否正常addFunctionView和定义scheduleJob，并且节点重启是否正常，重启后需要执行function view和等待scheduleJob执行结束，验证执行结果是否符合预期。重启相关的用例先在本地手动测试，没问题之后写成用例放在restart_testing中。

（5）是否支持关键字大小写和换行。

（6）与其他SQL关键字一起使用是否正常。

（7）用法应当与标准SQL兼容。

### 3.6 编程语言

#### 3.6.1 class测试
（1）数据类型校验: 需要测试所有支持的数据类型，对于不支持的数据类型，比如dict， set， array vector是否能正常报错

（2）类名/函数名/变量名需要设置与ddb内置函数一直的情况

（3）需要测试类的继承，父类，超类，子类和父类中有同名函数，子类继承父类的属性

（4）测试class与reactiveStateEngine一起使用

（5）在类的方法中，包含if-else 语句，do-while语句，for 语句，break和continue语句

（6）序列化和反序列化

需要注意function view和scheduleJob后重启是否正常，以及是否能正常执行

（7）在module中定义class

#### 3.6.2 jit测试
（1）数据类型校验：需要测试所有的数据类型，对于不支持的数据类型要写成异常用例，例如：VOID, DECIMAL等类型是不支持，要写成异常用例

（2）数据形式校验：需要测试所有的数据形式，对于不支持的数据形式要写成异常用例

（3）配合以下语句进行测试：if-else 语句，do-while语句，for 语句，break和continue语句

（4）测试函数嵌套和部分应用的情况，以及配合内置函数的使用

（5）正确性验证：函数的正确性以及行为表现应当与非jit保持一致

特别注意：对于空值的验证要还要验证其nullflag

### 3.7 流计算引擎测试

#### 3.7.1 流计算引擎通用测试要点
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

#### 3.7.2 reactiveStateEngine测试要点
流计算reactiveStateEngine支持的所有函数都是单独实现的，因此在测试reactiveStateEngine支持某个函数时，需要按照新函数的测试要点进行测试，否则有些代码会覆盖不到：

（1）参数校验，包括数据类型。不支持的数据类型写成exception expected的用例

（2）支持的所有数据类型。测试double，float和decimal类型时，需要构造小数部分不为0的数据，不能只有整数转浮点数的数据。

（3）不同key的个数需要测试<1024, >=1024

（4）keyColumn的数据有序，乱序的情况；通过take和rand函数生成keyColumn列的数据

（5）在自定义状态函数中使用支持的函数

（6）指定keyPurgeFilter和keyPurgeFreqInSecond，并且要达到清理keys的条件。reactiveStateEngine每支持一个函数都会有一个相应的增加keys和删除keys的函数，比如MovingSLRReactiveState::addKeys和MovingSLRReactiveState::removeKeys，对应的是mslr增加和删除key的函数。这部分的case可以参考unit_testing/test_function_createReactiveStateEngine_20.txt中delete_part的用例。

（7）指定snapshotDir和snapshotIntervalInMsgCount，并且要测试到从snapshot文件中恢复引擎状态。reactiveStateEngine每支持一个函数都会有一个相应的snapshotState和restoreState的函数。这部分的case可以参考streaming_testing/test_streaming_reactive_snapshot.txt。特别是，当函数输入的数据类型为string和symbol时，从snapshot恢复会比较容易出问题。

### 3.8 插件的测试要点
从以往插件的bug来看，以下几种情况比较容易出现问题：

（1）基本的参数校验，比较常见的有：

- 非法输入：比如参数的类型是string，输入int；参数的数据接口是vector，输入scalar等
- 参数个数不对：比如接口的必选参数个数为3，但输入参数个数为2或4。
- 可选参数缺省：比如odbc::query(connHandle|connStr, querySql, [t], [batchSize], [transform])，其中t, batchSize, transform都为可选参数，那么其中一种缺省（t不填）的情况是odbc::query(connHandle|connStr, querySql, , batchSize)。
- 输入NULL值：比如参数的类型是string，输入NULL和string(NULL)；参数的数据结构是字典，key为相应类型的NULL或者value为相应类型的NULL。

（2）不合理使用（比较容易忽略这种情况）

- 未创建连接就调用其他接口
- 连接创建后，再次创建
- 连接关闭后，再次关闭
- 连接关闭后，复用之前的连接
- 连接关闭后，再次创建连接
- 第三方系统关闭后，再次创建连接、复用之前的连接和关闭连接
- 共用一个连接

（3）多次调用同一个接口

（4）多线程并发调用（基本上插件的接口都没有考虑多线程的情况）

通过submitJob提交多个线程调用接口，每个线程中调用多次

（5）大数据量测试

由于dolphindb里分为fast array和huge array，需要测试不同数据量下，插件的表现。特别是huge array，会容易出现问题。

（6）异常处理

部分接口的参数可以接受一个函数作为输入，需要测试：

- 函数的输入和输出不符合要求
- 函数中间抛出异常
- partial application
- 人为构造第三方系统抛出异常

（7）内存泄漏和文件描述符泄漏（这方面的测试较少）

- 如果是计算类的接口，多次执行相同代码，观察内存是否持续上涨
- 如果是订阅类的接口，长时间订阅，观察内存是否持续上涨
- 关注文件描述符是否泄漏，参考第7章文件描述符泄漏测试

（8）断网重连（手动测试）

部分行情数据插件和订阅数据的插件支持断网重连，需要测试：

- 第三方系统端断网
- dolphindb即server端断网

（9）结果校验

- 如果是计算类的接口，需要校验结果正确性
- 如果是订阅类的接口，需要校验数据正确性和完整性
- 如果插件可以处理null值，需要校验null flag是否设置正确，用isNull函数校验

（10）关注插件的错误提示和日志输出

- 错误提示是否合理
- 终端中的输出是否过多
- 日志中的输入是否过多

### 3.9 存储引擎通用的测试点

#### 3.9.1 功能测试
以下表格列出了olap和tsdb存储引擎对于DDL和DML操作的支持情况（以下操作均支持事务）：

| 操作类型 | 相关函数和语句 | olap存储引擎 | tsdb存储引擎 | pkey存储引擎 | iotdb存储引擎 | imoltp存储引擎 |
|---------|---------------|--------------|--------------|--------------|---------------|----------------|
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

#### 3.9.2 与其他组件结合
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

- 集群配置双副本，先建库建表，写入一点数据
- 关闭其中一个数据节点，保证分区至少有一个副本在线
- 继续写入数据或者进行更新删除操作
- 重启步骤2关闭的节点
- 通过getRecoveryTaskStatus()函数确认是否发起了recovery，以及recovery任务是否完成
- recovery任务完成后，从重启的节点查询和写入是否正常

（6）rebalance相关

moveReplicas, copyReplicas, deleteReplicas等函数操作存储引擎的分区是否正常。

#### 3.9.3 稳定性
不需要重启的场景：

（1）并发操作。

（2）长时间进行事务操作，数据和元数据都正确，节点状态正常，没有内存泄漏，文件能够正常回收。

需要重启（kill进程或者断电）的场景：

（1）进行事务操作之后，结合takeMasterCheckpoint和chunkCheckPoint，重启。

（2）进行事务操作过程中，结合takeMasterCheckpoint和chunkCheckPoint，重启。

#### 3.9.4 性能测试
与市面上其他相同类型的数据库进行性能对比测试，挖掘性能不足。

### 3.10 tsdb存储引擎特有的功能测试点
tsdb存储引擎和olap引擎底层架构不同，测试点上也大有不同。tsdb架构请参考
TSDB架构简介 

（1）建表参数多了sortColumns, keepDuplicates, sortKeyMappingFunction, softDelete四个参数，因此数据正确性的测试 需要结合这四个参数不同取值来测试。

（2）需要考虑level file和cache的关系（对于同一个分区而言）：

- 从cacheEngine中查询，没有zonemap优化
- level file keyIndexEntry会存储每个列min, max, sum, count等属性，用于查询优化。只有从磁盘中查询数据时才会用到zonemap优化，需要考虑：
  - 单个level file
  - 多个level file
  - level file merge
- 从磁盘+cacheEngine中查询
- 指定合并levelFile函数后，要等待merge完成，具体检查函数见
D20-2941:TSDB merge 逻辑相关内存消耗优化


### 3.11 pkey存储引擎特有的功能测试点
pkey采用与tsdb相同的数据结构LSM-Tree，不同的是，pkey采取列存方式，而不是PAX，并增加了delete bitmap和自定义索引的概念。pkey设计方案参见
主键存储引擎设计方案 | 1. 背景


（1）建表参数多了primaryKey和indexes，数据正确性的测试需结合这两个参数进行测试。

（2）同tsdb，需考虑level file和cache的关系：

- 从cacheEngine中查询，没有zonemap优化
- zonemap会记录每个block中的max和min，只有在flush之后才会生成，需要考虑：
  - 单个level file
  - 多个level file
  - level file merge
- zonemap设计文档
TSDB查询和存储格式细化测试

- 从磁盘+cacheEngine中查询
- 可通过triggerPKEYCompaction(chunkId, [async=true])手动触发合并（注意：triggerIotCompaction是TSDB的合并函数）

（3）delete bitmap会标记哪些数据已被删除，数据量达到PKEYDeleteBitmapUpdateThreshold设定的阈值时更新，也可通过updatePKEYDeleteBitmap(chunkId)手动触发。

### 3.12 iotdb存储引擎特有的功能测试点
iotdb在tsdb的基础上引入了静态表和最新值缓存表，并且支持了IOTANY列物联网点位管理引擎 ,相关技术细节
点位管理
。特有的测试点包括

（1）建表参数多了latestKeyCache和compressHashSortKey，指定hashMappingFunction，且sortColumns大于2列时，compressHashSortKey默认为true，开启sortColumns列压缩，测试时需要覆盖这种分区表

（2）建表时需要区分是否包含IOTANY列测试

（3）clearAllIOTDBStaticTableCache,clearAllIOTDBLatestKeyCache，清除静态表和最新值缓存表后的正确性

### 3.13 内存表测试要点
对于内存表，需要测试以下情况：

（1）构造函数的异常测试，参数校验等。

（2）能否创建空表。

（3）是否支持所有的数据类型，特别注意：ANY列，array vector，decimal等数据类型。对于decimal类型，要校验schema extra中的精度是否正确，以及表中的数据精度有无丢失。

（4）表中包含NULL。

（5）如果有keyColumn, timeColumn，需要测试keyColumn, timeColumn是否支持所有的数据类型。

（6）序列化和反序列化。

（7）API和前端需要支持。

（8）与所有SQL关键字连用，特别注意子查询+多表join。

（9）下表列出了内存表支持的所有操作。当新增一种内存表时，需要测试以下操作是否支持。

| 操作类型 | 相关语句和函数 | 操作类型 | 相关语句和函数 |
|---------|---------------|---------|---------------|
| 1 | 创建表 | SQL关键字：create table（不一定会支持） | 2 | 写入数据 | SQL关键字：insert into<br>函数：append!, tableInsert, push! |
| 3 | 更新数据 | SQL关键字：update<br>函数：tableUpsert, upsert!, update!, sqlUpdate | 4 | 删除数据 | SQL关键字：delete<br>函数：clear!, erase!, sqlDelete |
| 5 | 增加列 | SQL关键字：alter … add，通过update增加列<br>函数：addColumn | 6 | 删除列 | SQL关键字：alter ... drop<br>函数：dropColumns!, drop! |
| 7 | 重命名列 | SQL关键字：alter ... rename<br>函数：rename! | 8 | 修改列的类型 | SQL关键字：alter ... replace<br>函数：replaceColumn! |
| 9 | 修改列的顺序 | 函数：reorderColumns! | 10 | 填充数据 | 函数：bfill!, ffill!, fill!, lfill!, nullFill! |
| 11 | 合并 | 函数：join!, unionAll<br>SQL关键字：union, union all | 12 | 排序 | SQL关键字：order by<br>函数：sortBy! |
| 13 | 共享与取消 | share，undef | 14 | 拷贝 | copy |
| 15 | 相关运维函数 | 函数：schema, getSessionMemoryStat, objs | | | |

注意：

流表不能更新和删除数据。

对于原地修改的操作，需要校验原表的属性有无变化，比如会不会从keyedTable变成非keyedTable

### 3.14 反序列化测试
数据类型、数据结构、SQL语句、系统内置常量、枚举值等需要测试反序列化是否正常。反序列化测试包括：

（1）rpc, remoteRun等是否正常。如果是数据类型、数据结构等，可作为自定义函数的参数，发送到远程节点执行；如果是SQL语句等，可以在自定义函数中使用该语句，发送到远程节点指定。
```dolphindb
//测试decimal32类型
def f1(a){
	return a
}
rpc(NODE2, f1, decimal32(1.0, 2))
//测试update语句
def f2(tableName){
	t = objByName(tableName)
	update t set val=val+1
}
rpc(NODE2, f2, `t)
```
（2）function view和scheduleJob的自定义函数中使用到这些数据类型、数据结构、语句等，能否正常定义，并且能否正常重启之后，function view和scheduleJob没有丢失。
```dolphindb
//测试function view
def f2(tableName){
	t = objByName(tableName)
	update t set val=val+1
}
t = table(1..10 as val)
addFunctionView(f2)
getFunctionViews()
undef(`f2, DEF)//需要先把自定义函数undef，确保下面调用的是function view
f2(`t)
t
//测试scheduleJob
def f3(tableName){
	t = objByName(tableName)
	update t set val=val+1
}
scheduleJob("job1", "test", f3{`t}, minute(now())+1, date(now()), date(now())+1, 'D')
getScheduledJobs()
//重启server，确认function view和scheduleJob正常
getFunctionViews()
getScheduledJobs()
```

### 3.15 并发测试
在计算函数、运维函数、SQL等都会涉及到并发测试，这里介绍如何构建并发测试的场景。一般而言，我们可以通过submitJob提交多个后台任务，或者通过ploop和peach高阶函数构造多线程并发的场景。

两者的区别是：

- submitJob需要提交多个任务才能构造出并发的场景，最大并发度取决于配置项maxBatchJobWorker。
- ploop和peach执行默认就是多线程，最大并发度取决于配置项workerNum/localExecutors。

## 4. 变量的处理
DolphinDB的test函数在每次执行完之后，都会自动清除局部变量。因此，局部变量不需要手动清除。以下变量需要测试人员在用例中手动清除：共享表、订阅、流数据引擎、数据库和表、测试目录、用户和组。

### 4.1 共享表
共享表需要手动释放，即在用例末尾使用undef释放变量，比如:
```dolphindb
undef(`st, SHARED)
```
一种检验用例中是否有未释放变量的方法是：在GUI中unit test该文件，测试完后观察右下角的Variables，如果Shared Tables中不为空，表示还有未释放的变量。
如果是在集群，可能在其他节点中定义了共享表，那么需要使用以下命令来获取共享变量。
```dolphindb
select * from pnodeRun(objs{true}) where shared=true
```
取消各个节点中的共享变量：
```dolphindb
@testing:case="clear_shared_variable"
shareObjs = select * from pnodeRun(objs{true}) where shared=true
if(shareObjs.size()>0){
	for(i in shareObjs){
		rpc(i[`node], undef, i[`name], SHARED)
	}
}
```
如果是持久化的流数据表，需要先clearTablePersistence，再undef变量。

### 4.2 订阅
在流数据测试中，每个用例末尾使用unsubscribeTable取消订阅。如果不unsubscribeTable，就没法undef共享流表。

### 4.3 流数据引擎
在流数据测试中，如果用例定义了流数据引擎，需要在用例末尾使用dropAggregator删除流数据引擎。

### 4.4 数据库和表
在系统测试中，数据库的命名要与测试文件相关，避免采用dfs://test_db1这种通用的命名。测试用例末尾应当删除数据库。

### 4.5 测试目录
测试的工作目录是WORK_DIR。在某些测试中，我们需要在WORK_DIR下创建子目录，比如：

流数据引擎snapshot目录

数据库备份目录

导出文件的测试目录

如果在WORK_DIR下创建了子目录，需要在用例末尾使用rm(WORK_DIR+"/sub_directory", true)删除子目录。

### 4.6 用户和组
权限测试中，如果创建了admin以外的用户和组，需要在用例末尾logout这些新用户，并删除这些新用户和组。

### 4.7 batchJob
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

### 4.8 循环和超时
DolphinDB的测试框架没有超时机制，如果在测试用例中编写死循环，会导致测试任务一直无法结束。因此，在编写用例时应当避免使用死循环。如果需要等待一些任务完成或者状态变更（比如：level file合并、recovery任务完成），需要设定等待超过一定时间（比如：5分钟）就退出循环。