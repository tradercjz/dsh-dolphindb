# 数据类型

---


数据类型

数据类型表

| 分类 | 名称 | ID | 举例 |
| --- | --- | --- | --- |
| VOID | VOID | 0 | NULL |
| LOGICAL | BOOL | 1 | 1b, 0b, true, false |
| INTEGRAL | CHAR | 2 | ‘a’, 97c |
| INTEGRAL | SHORT | 3 | 122h |
| INTEGRAL | INT | 4 | 21 |
| INTEGRAL | LONG | 5 | 22l |
| INTEGRAL | COMPRESSED | 26 |  |
| TEMPORAL | DATE | 6 | 2013.06.13 |
| TEMPORAL | MONTH | 7 | 2012.06M |
| TEMPORAL | TIME | 8 | 13:30:10.008 |
| TEMPORAL | MINUTE | 9 | 13:30m |
| TEMPORAL | SECOND | 10 | 13:30:10 |
| TEMPORAL | DATETIME | 11 | 2012.06.13 13:30:10 or 2012.06.13T13:30:10 |
| TEMPORAL | TIMESTAMP | 12 | 2012.06.13 13:30:10.008 or 2012.06.13T13:30:10.008 |
| TEMPORAL | NANOTIME | 13 | 13:30:10.008007006 |
| TEMPORAL | NANOTIMESTAMP | 14 | 2012.06.13 13:30:10.008007006 or 2012.06.13T13:30:10.008007006 |
| TEMPORAL | DATEHOUR | 28 | datehour(2012.06.13 13:30:10) |
| FLOATING | FLOAT | 15 | 2.1f |
| FLOATING | DOUBLE | 16 | 2.1 |
| LITERAL | SYMBOL | 17 |  |
| LITERAL | STRING | 18 | “Hello” or ‘Hello’ or `Hello |
| LITERAL | BLOB | 32 |  |
| BINARY | INT128 | 31 | e1671797c52e15f763380b45e841ec32 |
| BINARY | UUID | 19 | 5d212a78-cc48-e3b1-4235-b4d91473ee87 |
| BINARY | IPADDR | 30 | 192.168.1.13 |
| BINARY | POINT | 35 | (117.60972, 24.118418) |
| SYSTEM | FUNCTIONDEF | 20 | def f1(a,b) {return a+b;} |
| SYSTEM | HANDLE | 21 | file handle, socket handle, and db handle |
| SYSTEM | CODE | 22 | <1+2> |
| SYSTEM | DATASOURCE | 23 |  |
| SYSTEM | RESOURCE | 24 |  |
| SYSTEM | DURATION | 36 | 1s, 3M, 5y, 200ms |
| SYSTEM | INSTRUMENT | 42 | bond = {<br>"productType": "Cash",<br>"assetType": "Bond",<br>"bondType": "DiscountBond",<br>"instrumentId": "259924.IB",<br>"start": 2025.04.17,<br>"maturity": 2025.07.17,<br>"issuePrice": 99.664,<br>"dayCountConvention": "ActualActual"<br>}<br>instrument = parseInstrument(bond) |
| SYSTEM | MKTDATA | 43 | eqSpot = {<br>"mktDataType": "Spot",<br>"referenceDate": 2025.06.07,<br>"spotType": "EqSpot",<br>"value": 3461.66,<br>"unit": "CNY"<br>}<br>mktData=parseMktData(eqSpot) |
| MIXED | ANY | 25 | (1,2,3) |
| MIXED | ANY DICTIONARY | 25 | {a:1,b:2} |
| OTHER | COMPLEX | 34 | 2.3+4.0i |
| DECIMAL | DECIMAL32(S) | 37 | 3.1415926$DECIMAL32(3) |
| DECIMAL | DECIMAL64(S) | 38 | 3.1415926$DECIMAL64(3), 3.141P |
| DECIMAL | DECIMAL128(S) | 39 | 3.1415926$DECIMAL128(3) |
| ARRAY | 基础类型+方括号“[]”，如 INT[]、DOUBLE[]、DECIMAL32(3)[] 等，表示数组类型 | 基础类型 ID+64 | array(INT[], 0, 10).append!([1 2 3, 4 5, 6 7 8, 9 10]) |

## 说明

1. 上表除以下类型外，都支持作为表字段：`VOID`、`FUNCTIONDEF`、`HANDLE`、`CODE`、`DATASOURCE`、`RESOURCE`、`COMPRESS`、`DURATION`。
2. DolphinDB 中字符串类型包含 `STRING`、`BLOB` 与 `SYMBOL` 类型。
   - `BLOB` 类型不支持任何计算。其在内存中大小不受限制，但写入分布式数据库时存在大小上限。
   - `SYMBOL` 是特殊的字符串类型。某个表字段定义为 `SYMBOL` 类型时，必须保证每个分区内该字段的不同取值小于 `2097152(2^21)` 个，否则会报错 `One symbase's size can't exceed 2097152`。
   - 自 `1.30.23/2.00.11` 版本起，向分布式数据库写入这三种类型数据时有大小限制：
     - 写入的 `STRING` 类型数据应小于 `64 KB`，否则系统会截断到 `65,535` 字节（`64 KB - 1` 字节）。
     - 写入的 `BLOB` 类型数据应小于 `64 MB`，否则系统会截断到 `67,108,863` 字节（`64 MB - 1` 字节）。
     - 写入的 `SYMBOL` 类型数据超过 `255` 字节时，系统会抛出异常。
   - 注：数据库中已存在且超出范围限制的数据仍可正常读取使用。
3. `ANY DICTIONARY` 是 DolphinDB 中表示 JSON 的数据类型。
4. `COMPRESS` 类型目前只能通过 `compress` 函数生成。
5. `BLOB` 类型不支持任何计算。
6. `DURATION` 类型可以通过 `duration` 函数生成，或直接使用整数加时间单位（区分大小写）：`y`、`M`、`w`、`d`、`B`、`H`、`m`、`s`、`ms`、`us`、`ns`。
   - `DURATION` 数据范围为 `-2^31 + 1 ~ 2^31 - 1`。
   - 若数据溢出，溢出值会被处理为空值。
   - `DURATION` 数据之间不能进行任何运算，例如不能比较：`duration("20ms") >= duration("10ms")`。
7. `DOUBLE` 和 `FLOAT` 类型精度遵循 `IEEE 754` 标准；该类型数据溢出时会被处理为 `NULL`。
8. `DECIMAL32(S)`、`DECIMAL64(S)`、`DECIMAL128(S)` 中的 `S` 表示保留小数位数：
   - `DECIMAL32(S)` 中 `S` 的有效范围为 `[0, 9]`。
   - `DECIMAL64(S)` 中 `S` 的有效范围为 `[0, 18]`。
   - `DECIMAL128(S)` 中 `S` 的有效范围为 `[0, 38]`。
   - `DECIMAL32` 底层存储使用 `int32_t`（4 字节），`DECIMAL64` 使用 `int64_t`（8 字节），`DECIMAL128` 使用 `int128_t`（16 字节）。
   - `DECIMAL32(0)` 可表示的有效整数范围是 `[-999999999, 999999999]`，而 `INT32` 的范围是 `[-2,147,483,648, 2,147,483,647]`。
   - 将数值型数据强制转换为 `DECIMAL32` 时，若整数部分超过 `DECIMAL32` 的有效范围但仍在 `INT32` 范围内，可以转换成功；将字符串强制转换为 `DECIMAL32` 时会进行位数校验，若字符串长度超过有效位数则抛出异常。

```dolphindb
decimal32(1000000000, 0)
// output: 1000000000

decimal32(`1000000000, 0)
// output: Can't convert STRING to DECIMAL32(0): parse 1000000000 to DECIMAL32(0) failed: decimal overflow
```

9. `INSTRUMENT` 和 `MKTDATA` 是 DolphinDB 中用于表示金融工具和市场数据的类型，限制如下：
   - 创建包含 `INSTRUMENT` 或 `MKTDATA` 类型的分布式表时，仅支持 `TSDB` 存储引擎。
   - `INSTRUMENT` 和 `MKTDATA` 类型列不支持作为 `keyedTable` / `indexedTable` / `keyedStreamTable` / `latestKeyedTable` / `latestIndexedTable` / `latestKeyedStreamTable` 的主键列。
   - `INSTRUMENT` 和 `MKTDATA` 类型不支持一元或二元运算符。

## 类型检查

`typestr` 和 `type` 这两个函数用于检查数据类型。`typestr` 返回数据类型名称（字符串常量），`type` 返回数据类型 ID（整数）。

```dolphindb
typestr 3l;
// output: LONG

type 3l;
// output: 5

x=3;
if(type(x) == INT){y=10};
y;
// output: 10
```

## 数据范围

整型的数据范围在上表中已列出。对于整数类型数据，DolphinDB 使用最小值减 1 来表示对应类型的 `NULL` 值。例如 `-128c` 是一个 `NULL CHAR`。对于 `NULL` 值，参考相关 `NULL` 文档。

```dolphindb
x=-128c;
x;
// output: 00c

typestr x;
// output: CHAR
```

## 数据类型符号

数据类型符号用于声明常量的数据类型。下面第一个例子中没有为 `3` 指定类型符号，因此 `3` 默认作为整数存储。如果要保存为浮点数，应声明为 `3f`（float）或 `3F`（double）。

```dolphindb
typestr 3;
// output: INT

typestr 3f;
// output: FLOAT

typestr 3F;
// output: DOUBLE

typestr 3l;
// output: LONG

typestr 3h;
// output: SHORT

typestr 3c;
// output: CHAR

typestr 3b;
// output: BOOL

typestr 3P;
// output: DECIMAL64
```

## 字符串

在 DolphinDB 中可以将字符串保存为 `SYMBOL` 类型。`SYMBOL` 在系统内部存储为整数，通常使排序和比较更高效，因此可能提升性能并节省空间。但将字符串映射为整数（hash）需要时间，哈希表也会占用内存。

使用建议：
- 如果字符串重复度低，避免使用 `SYMBOL`。
- 如果字符串不会被排序、搜索或比较，避免使用 `SYMBOL`。

典型场景：
- 股票交易数据中的股票代码适合使用 `SYMBOL`，因为值域较固定、重复高，且经常被搜索与比较。
- 描述性字段通常不适合使用 `SYMBOL`，因为重复少且较少参与搜索、排序、比较。

例 1：排序比较。同样排序 300 万条记录，`SYMBOL` 向量比 `STRING` 快约 26 倍。

```dolphindb
n=3000000
strs=array(STRING,0,n)
strs.append!(rand(`IBM`C`MS`GOOG, n))
timer sort strs;
// output: Time elapsed: 184.642 ms

n=3000000
syms=array(SYMBOL,0,n)
syms.append!(rand(`IBM`C`MS`GOOG, n))
timer sort syms;
// output: Time elapsed: 7.001 ms
```

例 2：布尔运算比较。同样是 300 万条记录运算，`SYMBOL` 向量几乎是 `STRING` 向量的 9 倍。

```dolphindb
timer(100){strs>`C};
// output: Time elapsed: 1463.841 ms

timer(100){syms>`C};
// output: Time elapsed: 157.962 ms
```

## 整数溢出

DolphinDB 的整型是有符号的。对于有符号整型，在运算结果超出类型正负范围时会发生溢出。DolphinDB 采用二进制补码溢出：溢出时截断高位并保留低位作为最终结果。

下面示例中，变量 `x` 类型为 `INT`，赋值为 `INT` 可表示的最大值 `2^31-1`：

```dolphindb
x=(pow(2,31)-1)$INT;
x+1
// output: null

x+3;
// output: -2147483646
```
