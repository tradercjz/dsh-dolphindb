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