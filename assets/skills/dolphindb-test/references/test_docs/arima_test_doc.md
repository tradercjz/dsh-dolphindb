2.1.1 测试要点
2.1.1.1 函数接口


arima(ds, endogColName, order, [seasonalOrder], [exog], [trend], [enforceStationarity=true], [enforceInvertibility=true], [concentrateScale=false], [trendOffset=1], [maxIter=50])
2.1.1.2 异常测试要点
针对arima 函数的接口编写以下异常用例测试点：

| 参数名称 | 测试目的 | 测试内容 | 预期结果 |
|----------|----------|----------|----------|
| ds | 测试不满足要求的数据类型，能否正确报错 | 测试输入除numeric类型的数据 | 报错：Column 0 in table should be numeric. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除table和DATASOURCE类型的向量外其他数据形式 | 报错：ds should be a list of data sources or an in-mem table. |
| | | 测试输入的表非内存表 | 报错：ds should be a list of data sources or an in-mem table. |
| | 测试空值 | 测试输入空表 | 报错：Table built from ds cannot be empty. |
| | | 测试输入的数据包含空值 | 报错：data cannot contain NULL values. |
| | | 测试输入NULL,或者不输入 | 报错：ds should be a list of data sources or an in-mem table. |
| endogColName | 测试不满足要求的数据类型，能否正确报错 | 测试输入除STRING类型的数据 | 报错：endogColName should be a STRING that represents the dependent column name. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除STRING类型标量的数据 | 报错：endogColName should be a STRING that represents the dependent column name. |
| | 测试输入错误数据 | 测试输入内容非表中的列名 | 报错：Table does not contain the following column: id1 |
| | 测试空值 | 测试输入空的STRING类型标量 | |
| | | 测试输入NULL | |
| | | 测试不输入 | 报错：endogColName should be a STRING that represents the dependent column name. |
| order | 测试不满足要求的数据类型，能否正确报错 | 测试输入除INT类型的数据 | 报错：order must be an INT vector of length 3. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除INT类型向量的数据 | 报错：order must be an INT vector of length 3. |
| | 测试空值 | 测试输入空的INT类型向量 | 报错：Elements of order must be non-negative and less than ds data length. |
| | | 测试输入NULL, [] | |
| | | 测试不输入 | 报错：order must be an INT vector of length 3. |
| | 测试输入错误数据 | 测试输入的长度不等于3 | 报错：order must be an INT vector of length 3. |
| | | 测试输入的值不合法：<br>存在负数<br>值大于等于ds的长度 | 报错：Elements of order must be non-negative and less than ds data length. |
| seasonalOrder | 测试不满足要求的数据类型，能否正确报错 | 测试输入除INT类型的数据 | 报错：seasonalOrder must be an INT vector of length 4. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除INT类型向量的数据 | 报错：seasonalOrder must be an INT vector of length 4. |
| | 测试空值 | 测试输入空的INT类型向量 | 报错：Elements of seasonalOrder must be non-negative and less than ds data length. |
| | | 测试输入NULL, [] | 报错：seasonalOrder must be an INT vector of length 4. |
| | 测试输入错误数据 | 测试输入的长度不等于4 | 报错：seasonalOrder must be an INT vector of length 4. |
| | | 测试输入的值不合法：<br>存在负数<br>值大于等于ds的长度 | 报错：Elements of seasonalOrder must be non-negative and less than ds data length. |
| exog | 测试不满足要求的数据类型，能否正确报错 | 测试输入除numeric类型的数据 | 报错：exog must be a numeric matrix. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除numeric类型MATRIX的数据 | 报错：exog must be a numeric matrix. |
| | 测试空值 | 测试输入包含空的numeric类型MATRIX | 报错：exog cannot contain NULL values. |
| | | 测试输入NULL | 报错：exog must be a numeric matrix. |
| | 测试输入错误数据 | 测试输入的matrix行数和ds不一致 | 报错：Cannot concatenate the matrices horizontally because they don't have the same number of rows. |
| trend | 测试不满足要求的数据类型，能否正确报错 | 测试输入除STRING类型的数据 | 报错：trend must be a STRING scalar. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除STRING类型标量的数据 | 报错：trend must be a STRING scalar. |
| | 测试输入错误数据 | 测试输入非“n”, “t“, “c“, “ct“中的内容 | |
| | | 测试输入空的STRING类型标量 | 报错：trend must be 'c','ct','t' or 'n'. |
| | 测试空值 | 测试输入NULL | 报错：trend must be a STRING scalar. |
| enforceStationarity/ enforceInvertibility/concentrateScale | 测试不满足要求的数据类型，能否正确报错 | 测试输入除BOOL类型的数据 | 报错：enforceStationarity must be a boolean scalar.<br>报错：enforceInvertibility must be a boolean scalar.<br>报错：concentrateScale must be a boolean scalar. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除BOOL类型标量的数据 | 报错：enforceStationarity must be a boolean scalar.<br>报错：enforceInvertibility must be a boolean scalar.<br>报错：concentrateScale must be a boolean scalar. |
| | 测试空值 | 测试输入NULL | 报错：concentrateScale must be a boolean scalar. |
| | | 测试输入bool() | 有结果输出，但无意义 |
| trendOffset | 测试不满足要求的数据类型，能否正确报错 | 测试输入除INT类型的数据 | 报错：trendOffset must be an INT scalar. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除INT类型标量的数据 | 报错：trendOffset must be an INT scalar. |
| | 测试空值 | 测试输入NULL | 报错：trendOffset must be an INT scalar |
| | | 测试输入int() | 有结果输出，但无意义 |
| maxIter | 测试不满足要求的数据类型，能否正确报错 | 测试输入除INT类型的数据 | 报错：maxIter must be a positive INT scalar. |
| | 测试不满足要求的数据形式，能否正确报错 | 测试输入除INT类型标量的数据 | 报错：maxIter must be a positive INT scalar. |
| | 测试空值 | 测试输入NULL | 报错：maxIter must be a positive INT scalar. |
| | | 测试输入int() | |
| | 测试异常值 | 0 | 报错：maxIter must be a positive INT scalar. |
| | | -1 | |

2.1.1.3 正确性测试要点
| 测试功能 | 测试内容 |
|----------|----------|
| syntax | 测试syntax输出是否符合预期 |
| ds | 测试ds的输入是keyedTable, indexedTable, mvccTable 类型的内存表 |
| | 内存表列的类型是支持的数值类型 |
| | 通过sqlDS获取不同类型的数据 |
| | 通过sqlDS获取非内存表的数据进行计算 |
| | datasource的sql语句中使用 |
| | ds中数据重复/部分重复/无重复/递增/递减/乱序 |
| | ds数据长度：10, 1024, bigarray |
| | ds是宽表 |
| endogColName | 通过sqlDS获取数据并使用as,endogColName设置的列是as前/后的列 |
| order | order取值：[0,1,0], [1,0,0], [1,1,0], [0,1,1], [1,1,1], [0,0,0], 较大值 |
| | ds的长度-1 |
| seasonalOrder | seasonalOrder取值：[1,1,1,1], [0,0,0,0], 较大值 |
| | ds的长度-1 |
| exog | 测试支持的类型：INT, SHORT, CHAR, LONG, DOUBLE, FLOAT |
| trend | 测试支持的值：“n’, “c“, “t“, “ct“ |
| enforceStationarity/enforceInvertibility/concentrateScale/maxIter | 分别测试为true/false时结果的正确性 |
| | 配合其他参数使用时的正确性 |
| trendOffset | 较大值 |
| | 配合其他参数使用时的正确性 |
| 其他场景 | 多次调用函数 |
| | 通过自定义函数方式使用 |
| | 并行执行 |
| | 通过functionView使用 |
