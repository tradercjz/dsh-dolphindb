# instrumentPricer（通用批量/自动匹配定价）

## 定位

`instrumentPricer` 是 DolphinDB 的通用定价入口，适合一组 instrument 需要自动匹配市场数据、或组合中包含多种资产类型的场景。单只资产调试时优先使用专用 pricer，因为专用 pricer 的参数更显式，错误更容易定位。

## 函数签名

```dos
instrumentPricer(instrument, pricingDate, marketData)
```

已验证 DolphinDB 3.00.5 环境中为三参数签名。不要传平台 wrapper 的额外参数。

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT 或 INSTRUMENT[] | ★ | 单个 instrument 或 instrument 向量。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `marketData` | MKTDATA、MKTDATA[]、dict 或引擎 handle | ★ | 可供自动匹配的市场数据集合。 |

## marketData 常见形态

| 形态 | 适用场景 | 说明 |
|---|---|---|
| MKTDATA 向量 | 最常见 | `[curve1, curve2, spot, volSurf, ...]`。 |
| 单个 MKTDATA | 单资产、单曲线 | 如单只债配一条曲线。 |
| 嵌套 dict | 自定义组织 | 需要确保底层对象仍可被 pricer 识别。 |
| 市场数据引擎 handle | 流式/实时场景 | 与 `engines/` 文档配合使用。 |

## 各资产自动匹配要点

| 资产 | 必需市场数据 | 匹配要点 |
|---|---|---|
| Bond | `IrYieldCurve` | 优先按 instrument 的 `discountCurve` 和 `subType` 准备曲线。不要依赖自动 fallback 给信用债套国债曲线。 |
| BondFutures | `IrYieldCurve` | 曲线服务可交割券融资和贴现。 |
| Deposit | `IrYieldCurve` | 曲线币种匹配 `notionalCurrency`。 |
| IRS | `IrYieldCurve` + `AssetPriceCurve` | 需要 discount、forward、fixing 三类数据；`AssetPriceCurve.asset` 匹配浮动端 index。 |
| FxForward / FxSwap / NDF | 两条 `IrYieldCurve` + `FxSpotRate` | 曲线匹配 domestic/foreign 币种；spot 的 `unit` 匹配货币对。 |
| FxEuropeanOption | 两条 `IrYieldCurve` + `FxSpotRate` + `FxVolatilitySurface` | vol surface 的 `currencyPair` 匹配期权 underlying/货币对。 |
| CmFutEuropeanOption / CmFutAmericanOption | `IrYieldCurve` + `VolatilitySurface` + 标的价格来源 | 专用 pricer 用 `futPrice` 标量；批量入口需按市场数据组织提供可匹配价格。 |
| EqEuropeanOption / EqAmericanOption | `IrYieldCurve` + `DividendCurve` + `VolatilitySurface` + 标的现价 | DividendCurve 和 VolatilitySurface 应覆盖标的、期限、行权价。 |
| FxExoticOption | 两条 `IrYieldCurve` + `FxSpotRate` + `FxVolatilitySurface` | v3.00.5 仅将 digital/range accrual 作为已验证路径。 |

## 债券曲线特别规则

`instrumentPricer` 可能存在内置匹配或默认曲线逻辑，但通用 skill 不把“自动匹配到国债曲线”视为信用债的合理估值。债券市场数据应按以下顺序准备：

1. 与 `discountCurve` 明确一致的曲线。
2. 同 `subType`、同币种、同参考日的曲线。
3. 同 `subType` 样本券通过 `bondYieldCurveBuilder` 构造的曲线。
4. instrument 标准曲线或用户明确提供的替代曲线。
5. 数据不足时停止并补数据。

## 输出语义

| 输入 | 输出 |
|---|---|
| 单个 instrument | DOUBLE 标量或 pricer 对应结果。 |
| instrument 向量 | 与输入顺序一致的结果向量。 |
| 混合资产组合 | 每个 instrument 按自身类型匹配市场数据；任何一项缺失都可能导致整体报错。 |

## 常见错误

1. `marketData` 中对象名称、币种、货币对、曲面名与 instrument 不一致。
2. 单资产调试时直接上 `instrumentPricer`，导致无法定位是 instrument 字段错还是市场数据匹配错。
3. 把专用 pricer 的标量参数对象化：例如 FX 专用 pricer 用 DOUBLE spot，但 `instrumentPricer` 才用 `FxSpotRate`。
4. 批量定价时漏掉某类市场数据，导致整体失败。
5. 债券信用风险类别未匹配，隐式 fallback 造成估值口径错误。

## 关联文档

| 类别 | 路径 |
|---|---|
| Instrument 字段 | `../instruments/*/fields.md` |
| MarketData 字段 | `../market_data/*/fields.md` |
| 专用 pricer | `./*/fields.md` |
| 通用总纲 | `../SKILL.md` |