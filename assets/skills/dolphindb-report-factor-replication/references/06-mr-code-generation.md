# DolphinDB MR 因子代码生成规范

## Skill 介绍

本 Skill 用于生成符合项目要求的 DolphinDB MR 因子代码。MR 模式必须同时返回 `mapFuncString`、`dbName` 和 `tbName`，并在最终报告中拼装出可阅读、可执行的完整 MR 脚本。核心因子逻辑必须封装在 `def calcFactor(...) {}` 中，并由 `mapFunc(data)` 调用。

## 通用硬约束

1. 只能使用 03 阶段 fieldCheck JSON 中已确认的真实字段。
2. `calcFactor` 的字段入参必须来自 fieldCheck JSON 的 `data[*].requiredFields[*].name`，或在表入参模式下使用 `tb`。
3. 必须使用 03 产出的 `dataSql = extractData(args, "string")["result"]` 构造 `sqlDS`，不得重新手写等价取数 SQL。
4. `mapFunc` 函数名必须固定为 `mapFunc`。
5. `mapFunc` 只在单分区数据内计算，避免依赖跨分区状态。
6. 尽量使用向量化写法，例如 `context by`、`group by`、`select`、`update`。
7. 脚本中需要中文注释，说明金融逻辑和 DolphinDB 语法目的。
8. 禁止 `try-catch`。
9. `mapFunc` 返回值必须是 Table。
10. 最终结果只能包含四列：`tradeTime`, `securityId`, `factorname`, `value`。
11. `factorname` 必须是当前任务因子名或衍生因子名。
12. `dbName` 和 `tbName` 必须来自当前任务指定的数据源；同时必须交付 `dataSql`。
13. Panel 模式不生成 MR `mapFunc`；如果因子被判定为 Panel 模式，应说明 MR 不适用并回到 `05-execute-code-generation.md` 的 Execute panel_call 路径。只涉及时序滑动/滚动/滞后或单层降频聚合时，仍属于 SQL 字段入参，不应自动切到 Panel。
14. 窗口、lag、阈值等公式参数必须作为普通函数参数并提供默认值，不得放入 fieldCheck 的 `requiredFields`。

## MR 代码交付内容

MR 代码生成结果需要包含三项内容：

- `mapFuncString`：完整的 `def calcFactor(...) { ... }` 与 `def mapFunc(data) { ... }` 源码字符串。
- `dbName`：当前任务使用的数据源数据库名。
- `tbName`：当前任务使用的数据源表名。

- `dataSql`：由 `extractData(args, "string")["result"]` 生成的取数 SQL 字符串，用于构造 `sqlDS`。

## calcFactor 接口规则

MR 只覆盖 SQL 字段入参和表入参两种模式。入参形态由计算层级决定，不由用户提示、测试用例名称、表数量或频率数量决定。单层逐行、单层 `context by`、单层 `group by` 使用字段入参；多层聚合、多阶段中间表或非规则表级逻辑使用表入参。

Panel 模式默认走历史 Execute/panel_call，不生成 MR `mapFunc`。原因是 Panel 通常需要同一时间的全市场证券集合或完整时间 x 证券矩阵上下文。只有时序计算与截面计算组合，或 WorldQuant/Alpha 风格矩阵函数组合，才应切回 Execute panel_call。

### 字段入参模式

简单字段计算使用字段入参：

```dos
def calcFactor(close, preClose, threshold=0.0) {
    return iif(preClose == 0 || isNull(preClose), NULL, close \ preClose - 1 - threshold)
}
```

`mapFunc(data)` 先做字段对齐，再调用 `calcFactor(field1, field2, ..., param=default)`。字段入参模式覆盖逐行 `select`、单层 `context by` 和单层 `group by`。窗口、lag、阈值等普通参数必须带默认值，并在调用处显式传入或使用函数默认值。

### 表入参模式

涉及多层聚合、非规则分组或中间表复用时，使用表入参。单层时序滑动/滚动/滞后或单层降频聚合不属于表入参，应使用 SQL 字段入参：

```dos
def calcFactor(tb, neutralize=true) {
    base = select * from tb order by securityId, tradeTime
    base = select *, close \ preClose - 1 as rawReturn from base

    calc = select tradeTime,
                  securityId,
                  rawReturn - avg(rawReturn) as value
           from base
           context by tradeTime, industry

    return select tradeTime, securityId, value
           from calc
           where not isNull(value)
}
```

`mapFunc(data)` 构造字段对齐后的 `base` 表，再调用 `calcFactor(base, param=default)`。表入参模式下 `calcFactor` 返回 `tradeTime/securityId/value` 表。多层聚合、非规则分组、行业中性化和多步中间表复用使用表入参；时序+截面矩阵计算应回到 Execute panel_call。

## mapFunc 骨架：字段入参模式

```dos
def calcFactor(close, preClose, threshold=0.0) {
    // 分母保护，避免前收盘价为 0 时产生无效结果
    return iif(preClose == 0 || isNull(preClose), NULL, close \ preClose - 1 - threshold)
}

def mapFunc(data) {
    // 单分区内字段对齐；字段必须来自 fieldCheck JSON 的 sourceColumns
    base = select realTimeCol as tradeTime,
                  realSecurityCol as securityId,
                  double(realCloseCol) as close,
                  double(realPreCloseCol) as preClose
           from data
           where not isNull(realTimeCol), not isNull(realSecurityCol)

    // 字段入参模式：calcFactor 返回 value 向量
    calc = select tradeTime,
                  securityId,
                  calcFactor(close, preClose, threshold=0.0) as value
           from base

    return select tradeTime,
                  securityId,
                  "FACTOR_NAME" as factorname,
                  value
           from calc
           where not isNull(value)
}
```

字段入参模式也可以在 `mapFunc` 内使用单层 `context by` 或单层 `group by`：

```dos
// 单层时序滑动：保持原频
calc = select tradeTime,
              securityId,
              calcFactor(close, window=20) as value
       from base
       context by securityId

// 单层降频聚合：例如分钟聚合到日频
calc = select date(tradeTime) as tradeTime,
              securityId,
              calcFactor(volume, threshold=0.0) as value
       from base
       group by securityId, date(tradeTime)
```

## mapFunc 骨架：表入参模式

```dos
def calcFactor(tb, neutralize=true) {
    base = select * from tb order by securityId, tradeTime
    base = select *, close \ preClose - 1 as rawReturn from base

    calc = select tradeTime,
                  securityId,
                  rawReturn - avg(rawReturn) as value
           from base
           context by tradeTime, industry

    return select tradeTime, securityId, value
           from calc
           where not isNull(value)
}

def mapFunc(data) {
    // 单分区内字段对齐；字段必须来自 fieldCheck JSON 的 sourceColumns
    base = select realTimeCol as tradeTime,
                  realSecurityCol as securityId,
                  double(realInputCol) as inputValue
           from data
           where not isNull(realTimeCol), not isNull(realSecurityCol)

    calc = calcFactor(base, neutralize=true)

    return select tradeTime,
                  securityId,
                  "FACTOR_NAME" as factorname,
                  value
           from calc
           where not isNull(value)
}
```

## 最终报告 code 拼装

最终报告中的 `code` 不应只放 `mapFuncString`，而应拼装成一段可阅读、可执行的完整脚本：

```dos
def calcFactor(tb, neutralize=true) {
    base = select * from tb order by securityId, tradeTime
    base = select *, close \ preClose - 1 as rawReturn from base

    calc = select tradeTime,
                  securityId,
                  rawReturn - avg(rawReturn) as value
           from base
           context by tradeTime, industry

    return select tradeTime, securityId, value
           from calc
           where not isNull(value)
}

def mapFunc(data) {
    base = select realTimeCol as tradeTime,
                  realSecurityCol as securityId,
                  double(realInputCol) as inputValue
           from data
           where not isNull(realTimeCol), not isNull(realSecurityCol)

    calc = calcFactor(base, neutralize=true)

    return select tradeTime,
                  securityId,
                  "FACTOR_NAME" as factorname,
                  value
           from calc
           where not isNull(value)
}

dataSql = "select ..."
// 将 dataSql 的内容渲染成 SQL 元代码；不要写成 sqlDS(<dataSql>)
ds = sqlDS(<select ...>)
result = mr(ds, mapFunc,, unionAll)
```

拼装逻辑等价于：

```dos
code = mapFuncString + "\n\n" +
       "dataSql = \"" + dataSql + "\"\n" +
       "ds = sqlDS(<" + dataSql + ">)\n" +
       "result = mr(ds, mapFunc,, unionAll)"
```

这里的 `sqlDS(<" + dataSql + ">)` 表示在最终脚本字符串中把 `dataSql` 的内容展开为 `<select ...>` 元代码，而不是在 DolphinDB 脚本里把变量名放进 `<dataSql>`。完整脚本最后一条语句应为 `result = mr(ds, mapFunc,, unionAll)`，末尾不再单独输出 `result`。代码生成阶段总是消费 03 产出的 `dataSql`，不要再用 `dbName` 与 `tbName` 拼接简单 `loadTable` 查询。

## 常见 MR 适用计算

- 单证券收益率、成交量变化率、价格比例。
- 可在单分区内独立完成且不需要跨证券横截面比较的计算。
- 非 panel 的表级逻辑，且 `MREligible` 明确返回适用。

## Panel 模式处理

- 如果 04/06 阶段发现因子应使用 Panel 模式，不生成 `mapFuncString`。
- 输出应说明 MR 不适用原因，并切回 05 Execute 生成 `dataSql -> rawData -> panel_call(rawData, ...)` 脚本。
- 不得把需要完整 panel 上下文的 `rowRank/rowZScore/mcorr/mrank` 强行塞进单分区 `mapFunc(data)`。
- 不得把单层时序滑动/滚动/滞后误判为 Panel；这类因子可在 SQL 字段入参路径中用 `context by securityId`。

## 检查清单

- 已返回 `mapFuncString`, `dbName`, `tbName`。
- 已返回并使用 03 产出的 `dataSql`。
- 窗口、lag、阈值等公式参数均已作为带默认值的普通参数处理。
- `mapFuncString` 包含 `def calcFactor(...) {}` 与 `def mapFunc(data) {}`。
- `mapFunc` 内已调用 `calcFactor`。
- `mapFunc` 返回 Table。
- 输出列严格为四列。
- 没有多余列进入最终结果。
- 除法已做分母保护。
- 最终报告中的 `code` 已拼成 `calcFactor + mapFunc + sqlDS + mr` 的完整脚本。
- 完整脚本末尾没有单独 `result`。
