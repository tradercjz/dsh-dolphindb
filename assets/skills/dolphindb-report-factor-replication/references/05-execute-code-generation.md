# DolphinDB Execute 因子代码生成规范

## Skill 介绍

本 Skill 用于生成符合项目要求的 DolphinDB `execute` 脚本。字段入参和表入参模式的核心因子逻辑必须封装在 `def calcFactor(...) {}` 中；Panel 模式的核心因子逻辑必须封装在可被 `panel_call` 调用的 panel 因子函数中。最终输出必须统一为 `tradeTime`, `securityId`, `factorname`, `value` 四列。

## 通用硬约束

1. 只能使用 03 阶段 fieldCheck JSON 中已确认的真实字段。
2. 核心因子函数的字段入参必须来自 fieldCheck JSON 的 `data[*].requiredFields[*].name`；Panel 模式的 panel 函数也遵循同一字段来源约束。
3. 读取数据部分必须使用 03 产出的 `dataSql = extractData(args, "string")["result"]` 作为取数来源，不得在 05 阶段重新手写 `loadTable/select/join` 取数 SQL。
4. 公式窗口、lag、平滑周期、阈值等非字段参数必须作为普通函数参数，并提供默认值；不得放入 fieldCheck 的 `requiredFields`。
5. 尽量使用向量化写法，例如 `context by`、`group by`、`select`、`update`。
6. 脚本中需要中文注释，说明金融逻辑和 DolphinDB 语法目的。
7. 禁止 `try-catch`。
8. 最终结果只能包含四列：`tradeTime`, `securityId`, `factorname`, `value`。
9. `factorname` 必须是当前任务因子名或衍生因子名。
10. `execute` 脚本最后一条语句必须产生 `result` 表，末尾不能再出现单独一行 `result`。

## calcFactor 接口规则

入参形态由计算层级决定，不由用户提示、测试用例名称、表数量或频率数量决定。代码生成分为 SQL 字段入参、Panel 字段入参、表入参三种模式。

历史因子脚本是主交付目标。流计算兼容性只影响函数边界设计：尽量把核心公式保留为字段入参函数，但不要为了未来流引擎强行拆分当前历史脚本。

### SQL 字段入参模式

只涉及单个计算层面时使用 SQL 字段入参。核心公式写成字段入参函数，公式参数必须显式带默认值；最终 SQL 根据计算层面选择普通 `select`、`context by` 或 `group by`：

```dos
def calcFactor(close, preClose, threshold=0.0) {
    return close \ preClose - 1 - threshold
}
```

适用场景：

- 逐行公式：每行输出只依赖同一行字段，最终使用普通 `select`。
- 单层时序滑动/聚合：每个证券内部保持原频输出，最终使用 `context by securityId`。
- 单层降频聚合：例如分钟聚合到日频，最终使用 `group by securityId, tradeDate` 或等价输出时间。
- 多数据源或跨频率 join 后仍是单层计算时，仍属于 SQL 字段入参模式。
- 逐行和 `context by` 场景中 `calcFactor` 返回 `value` 向量；`group by` 场景中 `calcFactor` 可在聚合表达式中返回标量聚合值。
- 窗口、lag、阈值等普通参数不是字段入参；默认值优先来自研报公式，若研报未给出需在注释中说明为待确认默认值。

### Panel 字段入参模式

同一层面内同时存在时序计算与截面计算时使用 Panel 字段入参模式。函数形态仍为 `def FactorName(close, open, vol, ..., window=20)`，但字段入参不是向量，而是时间 x 证券的 panel 矩阵；窗口、lag、平滑周期等是带默认值的普通参数。返回值也必须是同形态 panel 矩阵。

- 从 fieldCheck 确认的长表字段中取出函数参数、时间列和证券列。
- 先使用 03 阶段产出的 `dataSql = extractData(args, "string")["result"]` 和 `rawData = runSQL(dataSql)` 得到已对齐长表；`panel_call` 的 `rawdata` 入参应使用这个 `rawData`，不得在 05 中重新手写取数 SQL。
- 用 `panel(time, securityId, field)` 将每个字段转成 panel。
- 用 `makeUnifiedCall(funcByName(factorName), args).eval()` 调用字段入参因子函数。
- 将结果 panel unpivot 回 `tradeTime`, `securityId`, `factorname`, `value` 四列。

适用场景：

- 列向时序运算和行向截面运算组合，例如 `rowRank(mstd(ratios(close)-1, window), percent=true)`。
- 同一套 panel 字段上的时序与截面运算组合，并且中间结果和最终结果都保持完整 panel shape。
- Alpha 类模块已经提供的 panel 函数。

不适用场景：

- 只有逐行公式、只有单层时序滑动/聚合、或只有单层 `group by` 降频聚合；这些应使用 SQL 字段入参。
- 行业中性化、非 time/security 分组残差或其他非规则分组。
- 多阶段表 join、跨频率重采样放在因子函数内部。
- 需要复用多个中间表、输出不再是完整 panel，或需要保留非 panel 维度。

这种场景不要直接改写为 `def calcFactor(tb)`；`panel_call` 已经承担了长表和 panel 之间的结构转换。

### 表入参模式

多个计算层面或多阶段中间结果使用表入参。普通参数同样必须带默认值：

```dos
def calcFactor(tb, neutralize=true) {
    base = select * from tb order by securityId, tradeTime

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

适用场景：

- 两个及以上不同粒度或不同分组阶段，例如分钟聚合到日频后再做 20 日滚动。
- 多阶段中间表、复杂聚合或非规则对齐。
- 行业中性化、非 time/security 分组、非规则分组残差，且无法表达为单层 SQL 字段入参。
- 同一张表内需要多次 `update/select` 复用中间列。
- 返回值为包含 `tradeTime`, `securityId`, `value` 的表。
- 不包括单层逐行、单层 `context by` 或单层 `group by`；这些应使用 SQL 字段入参模式。

## Execute 脚本骨架：SQL 字段入参模式

读取数据部分必须使用 03 阶段产出的 `dataSql`。下面示例中的 `dataSql` 是由 `extractData(args, "string")["result"]` 生成的取数字符串，不允许在 05 阶段自行改写为手写 `loadTable` 查询。

```dos
// 参数区：集中管理窗口长度、过滤区间和阈值，方便复现实验调整
factorName = "FACTOR_NAME"

// 核心因子函数：入参名来自 fieldCheck JSON 的 requiredFields.name
def calcFactor(close, preClose, threshold=0.0) {
    // 分母保护，避免前收盘价为 0 时产生无效结果
    return iif(preClose == 0 || isNull(preClose), NULL, close \ preClose - 1 - threshold)
}

// 03 阶段由 extractData(args, "string") 生成，不在 05 代码生成阶段手写取数 SQL
dataSql = "select ..."
rawData = runSQL(dataSql)

// 逐行公式：rawData 已由 03 阶段标准化字段名，直接计算并整理四列
result = select tradeTime,
                securityId,
                factorName as factorname,
                calcFactor(close, preClose, threshold=0.0) as value
         from rawData

result = select * from result where value is not null
```

### SQL 字段入参：context by 保持原频

单层时序滑动/聚合使用字段入参函数，最终 SQL 用 `context by securityId` 保持原频输出。

```dos
factorName = "ROLLING_FACTOR"

// window 是公式参数，必须有默认值
def calcFactor(close, window=20) {
    ret = ratios(close) - 1
    return mstd(ret, window)
}

dataSql = "select ..."
rawData = runSQL(dataSql)

result = select tradeTime,
                securityId,
                factorName as factorname,
                calcFactor(close, window=20) as value
         from rawData
         context by securityId

result = select * from result where value is not null
```

### SQL 字段入参：group by 降频

单层降频聚合使用字段入参函数，最终 SQL 用 `group by` 生成目标频率。降频后的时间列必须重命名或投影为 `tradeTime`。

```dos
factorName = "DOWNSAMPLE_FACTOR"

// 聚合函数仍以字段为入参；threshold 等普通参数必须有默认值
def calcFactor(volume, threshold=0.0) {
    return avg(volume) - threshold
}

dataSql = "select ..."
rawData = runSQL(dataSql)

result = select date(tradeTime) as tradeTime,
                securityId,
                factorName as factorname,
                calcFactor(volume, threshold=0.0) as value
         from rawData
         group by securityId, date(tradeTime)

result = select * from result where value is not null
```

## Execute 脚本骨架：Panel 字段入参模式

Panel 模式同样必须使用 03 阶段产出的 `dataSql`。`panel_call` 只负责长表和 panel 之间的结构转换，不负责取数。

```dos
factorName = "FACTOR_NAME"
factorFuncName = "PanelFactor"
factorFieldNames = `close`volume

// Panel 因子函数：字段名来自 fieldCheck JSON 的 requiredFields.name
// 同一层面同时包含时序和截面计算；window/lag 是普通参数并带默认值
def PanelFactor(close, volume, window=20, lag=1) {
    volShock = log(volume) - log(mfirst(volume, lag + 1))
    ret = ratios(close) - 1
    return rowRank(ret, percent=true) * mrank(volShock, true, window)
}

def panel_call(rawdata, startDate, endDate, factorFuncName, factorFieldNames, outputFactorName, securityidName, tradetimeName, params=dict(STRING, ANY)) {
    // factorFieldNames 必须来自 fieldCheck JSON 的 requiredFields.name；不要从 defs().syntax 反推，避免把 window=20 这类普通参数误当成字段
    selection = each(sqlCol, factorFieldNames).append!(sqlCol(tradetimeName)).append!(sqlCol(securityidName))
    whereConditions = [
        expr(sqlCol(tradetimeName), <=, endDate),
        expr(sqlCol(tradetimeName), >=, startDate)
    ]
    data = sql(select=selection, from=rawdata, where=whereConditions).eval()

    panels = dict(STRING, ANY)
    for(rawFieldName in factorFieldNames){
        fieldName = string(rawFieldName)
        panels[fieldName] = panel(data[tradetimeName], data[securityidName], data[fieldName])
    }

    args = array(ANY, 0)
    for(rawFieldName in factorFieldNames){
        fieldName = string(rawFieldName)
        args.append!(panels[fieldName])
    }
    if(params.hasKey("window")){
        args.append!(params["window"])
    }
    if(params.hasKey("lag")){
        args.append!(params["lag"])
    }

    res = makeUnifiedCall(funcByName(factorFuncName), args).eval()

    colNum = size(res.columnNames())
    rowNum = size(res.rowNames())
    result = table(
        take(res.rowNames(), rowNum * colNum) as tradeTime,
        stretch(res.columnNames(), rowNum * colNum) as securityId,
        take(outputFactorName, rowNum * colNum) as factorname,
        res.flatten() as value
    )

    data.rename!(tradetimeName, "tradeTime")
    data.rename!(securityidName, "securityId")
    result = select r.tradeTime, r.securityId, r.factorname, r.value
             from result r
             inner join data d
             on r.tradeTime = d.tradeTime and r.securityId = d.securityId

    return result
}

// 03 阶段由 extractData(args, "string") 生成，不在 05 代码生成阶段手写取数 SQL
dataSql = "select ..."
rawData = runSQL(dataSql)

result = panel_call(
    rawdata=rawData,
    startDate=START_DATE,
    endDate=END_DATE,
    factorFuncName=factorFuncName,
    factorFieldNames=factorFieldNames,
    outputFactorName=factorName,
    securityidName="securityId",
    tradetimeName="tradeTime",
    params=dict(["window", "lag"], [20, 1])
)
```

## Execute 脚本骨架：表入参模式

表入参模式同样必须使用 03 阶段产出的 `dataSql`。`calcFactor(tb)` 的 `tb` 是 `rawData`，不负责取数。

```dos
factorName = "FACTOR_NAME"

// 核心因子函数：表入参用于非规则分组、行业中性化或无法 panel 化的中间表复用
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

// 03 阶段由 extractData(args, "string") 生成，不在 05 代码生成阶段手写取数 SQL
dataSql = "select ..."
rawData = runSQL(dataSql)

// 表入参模式：calcFactor 返回 tradeTime/securityId/value 表
calc = calcFactor(rawData, neutralize=true)

result = select tradeTime,
                securityId,
                factorName as factorname,
                value
         from calc
         where not isNull(value)
```

## 常见计算模式

- 单期比例：字段入参 `calcFactor(close, open)`，注意分母为 0。
- 逐行公式：SQL 字段入参 + 普通 `select`。
- 单层时序滚动/滑动/滞后/聚合：SQL 字段入参 + `context by securityId`。
- 单层降频聚合：SQL 字段入参 + `group by`。
- 同一层面时序 + 截面组合：Panel 模式，使用 `mavg/mstd/mcorr/mrank/ratios/rowRank/rowZScore` 等 panel 函数组合。
- 行业中性化、非规则分组或多阶段聚合：表入参 `calcFactor(tb)`。

## 检查清单

- SQL 字段入参和表入参已生成 `def calcFactor(...) {}` 并调用；Panel 模式已生成 panel 因子函数并通过 `panel_call` 调用。
- 核心因子函数字段入参来自 fieldCheck JSON 的 `requiredFields.name`；公式参数已单独列为带默认值的普通参数。
- 已使用 03 产出的 `dataSql = extractData(args, "string")["result"]`，05 代码中没有重新手写 `loadTable/select/join` 取数 SQL。
- SQL 字段入参模式已选择正确 SQL 包装：普通 `select`、`context by` 或 `group by`；Panel 模式通过 `panel_call` 返回四列表；表入参模式返回 `tradeTime/securityId/value` 表。
- 输出列严格为四列。
- 末尾没有单独 `result`。
- 没有多余列进入最终结果。
- 除法已做分母保护。
- 注释解释了窗口、排序、分组和空值处理。
