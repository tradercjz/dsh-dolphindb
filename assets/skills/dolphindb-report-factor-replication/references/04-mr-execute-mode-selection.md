# MR 与 Execute 模式判定

## Skill 介绍

本 Skill 用于判断因子是否适合 Map-Reduce，并规范 Starfish MR 判定模块的参数选择。该 Skill 涉及实际计算能力判断，最终结论必须以 DolphinDB 中 `starfish::facplfRun::MREligible` 的返回结果为准。

## 使用流程

1. 先执行 DolphinDB 模块加载语句：`use starfish::facplfRun`。
2. 如果模块加载成功，说明可以使用本 Skill 进行 MR 适配判定。
3. 根据公式和样例数据判断因子输出频率，得到 `targetFreq`。
4. 判断是否涉及同一时刻多证券横截面计算，得到 `isCS`。
5. 判断是否存在固定长度且窗口长度大于 1 的时间滚动窗口，得到 `isSlide`。
6. 当 `isSlide=true` 时，填写 `computeFreq` 和 `windowSize`；同时判断该滑动/滚动/滞后属于单层 `context by`，还是与截面计算组合，或属于多层聚合。单层滑动仍走 SQL 字段入参，不因存在滑窗而切到 Panel 或 TB。
7. 读取用户输入中的 `forceMR`，不得忽略强制开关。
8. 调用 `starfish::facplfRun::MREligible` 后，等待返回结果再进入代码生成。

## Starfish 模块要求

本 Skill 依赖 Starfish 的 DolphinDB 模块：

```dos
use starfish::facplfRun
```

如果上述语句无法加载，不能声称已完成 MR 适配判定。此时只能说明 Starfish 判定模块暂不可用，并等待平台提供可执行的 DolphinDB 模块环境。

模块加载成功后，最终判断函数为：

```dos
starfish::facplfRun::MREligible(dbName, tbName, targetFreq, isCS, isSlide, computeFreq=NULL, windowSize=NULL, forceMR=NULL)
```

该函数返回的 `isEligible` 和 `reason` 是选择 MR 或 Execute 的最终依据。经验规则只用于准备参数，不用于替代函数返回结果。

返回值为字典：

```dos
dict(["isEligible", "reason"], [false, ""])
```

其中：

- `isEligible`：布尔值，表示是否适合 MR。
- `reason`：字符串，说明适用或不适用原因。

## 参数说明

`targetFreq` 表示因子最终输出的目标时间频率。虽然函数注释示例中出现了 `"1min"`，但当前实现中的 `targetLevelMap` 只接受以下标准大写粒度：

`NANOTIME`, `NANOTIMESTAMP`, `TIMESTAMP`, `SECOND`, `DATETIME`, `MINUTE`, `TIME`, `HOUR`, `DAY`, `DATE`, `MONTH`, `YEAR`

`isCS=true` 的典型场景：

- 横截面 rank。
- 分位数。
- 行业中性化。
- 规模中性化。
- 截面回归。
- 同日市场均值比较。

`isSlide=true` 的典型场景：

- `mavg`。
- `msum`。
- `mstd`。
- `mcorr`。
- N 日收益。
- N 分钟波动。

`computeFreq` 表示滑窗计算依赖的时间粒度，仅在 `isSlide=true` 时需要填写；可选值与 `targetFreq` 相同。

`windowSize` 表示滑窗长度，仅在 `isSlide=true` 时需要填写，必须是正整数。

`forceMR` 是用户强制开关：

- `true`：函数直接返回适用，`reason` 为用户指定强制使用 MR。
- `false`：函数直接返回不适用，`reason` 为用户指定强制不使用 MR。
- `NULL`：进入自动判定逻辑。

## 判断函数参数

`starfish::facplfRun::MREligible` 参数顺序：

1. `dbName`
2. `tbName`
3. `targetFreq`
4. `isCS`
5. `isSlide`
6. `computeFreq`
7. `windowSize`
8. `forceMR`

其中 `computeFreq`、`windowSize`、`forceMR` 在 DolphinDB 函数签名中默认为 `NULL`。当 `isSlide=false` 时，`computeFreq` 和 `windowSize` 应传 `NULL`。


## 判定经验

优先考虑 MR：

- 因子可在单个分区内独立计算。
- 不需要跨证券横截面比较。
- 窗口不会跨分区边界，或工具确认可处理。

优先考虑 Execute：

- 涉及时序计算与截面计算组合，且可表达为 panel 时，优先回到 05 的 Execute panel_call 路径。
- 涉及行业中性化、规模中性化、截面回归或非规则分组时，优先 Execute 表入参路径。
- 需要跨分区聚合、全市场基准、指数权重或多表联结。
- `starfish::facplfRun::MREligible` 返回不适用。
- 用户 `forceMR=false`。

## MREligible 自动判定逻辑

函数自动判定时会依次检查：

1. `forceMR` 是否非空。若非空，直接按用户指定返回，不继续检查表结构。
2. `existsTable(dbName, tbName)`。表不存在则返回不适用。
3. `schema(loadTable(dbName, tbName))`。非分区表返回不适用。
4. 分区类型。存在 SEQ 分区返回不适用。
5. 分区列类型。只接受时间分区或 ID 分区；存在非常规分区列则返回不适用。
6. 时间分区粒度。若目标频率与物理分区粒度不兼容，则返回不适用。
7. 横截面计算。若 `isCS=true` 且数据被 ID 维度物理切分，则返回不适用。
8. 滑窗计算。若 `isSlide=true`，会进一步检查：
   - 时间字段是否被 hash 打散。
   - 是否提供 `computeFreq/windowSize`。
   - `computeFreq` 是否在标准粒度映射中。
   - `windowSize` 是否为正整数。
   - 滑窗是否可能跨分区。

只有上述检查全部通过，函数才返回 `isEligible=true` 且 `reason="适用"`。

## 检查清单

- 已成功加载 `starfish::facplfRun`。
- 已读取 `forceMR`。
- `targetFreq` 表示输出频率。
- `computeFreq` 表示滑窗依赖粒度。
- `targetFreq` 和 `computeFreq` 使用标准大写粒度，而不是 `"1min"` 这类别名。
- `isSlide=false` 时 `computeFreq/windowSize` 使用 `NULL`。
- `isSlide=true` 时 `windowSize` 为正整数。
- `isSlide=true` 时已区分单层 SQL 字段入参、时序+截面 Panel、多层 TB。
- `isCS=true` 时已警惕 MR 不适用。
- 未绕过 `starfish::facplfRun::MREligible` 直接生成代码。
