# FxSpotRate — parseMktData 字段定义

## 金融含义

FxSpotRate（即期汇率）是外汇市场上最基础的报价——今天用一种货币兑换另一种货币的实时价格。例如 USDCNY = 7.2659 意味着 1 美元可以即期兑换 7.2659 元人民币。

"即期"在实操中并非"此刻"而是 T+2（两个工作日后交割），这是全球外汇市场的惯例，给双方留出资金清算和跨时区结算的时间。

即期汇率是所有外汇衍生品定价的"锚点"：
- **远期汇率** = 即期汇率 × 两国利率差调整（利率平价）
- **期权行权价** 通常围绕远期汇率（ATM-Forward）设定
- **掉期点** = 远期汇率 − 即期汇率

> **注意**：在 `fxForwardPricer` / `fxSwapPricer` / `fxEuropeanOptionPricer` 等单品 pricer 中，`spot` 是 **DOUBLE 标量**而非 MKTDATA 对象。只有通过 [instrumentPricer](../../pricers/instrument_pricer.md) 批量定价时才需要构造 FxSpotRate MKTDATA。
>
> 若手头是存量的 FxSpotRate MKTDATA 对象（非标量），取其 `value` 字段得到 DOUBLE 再传给专用 pricer，例如 `spot = extractMktData(obj)["value"]`（或直接读对象的 `value`）。FxSpotRate 对象本身只用于 `instrumentPricer` 自动匹配。

---

## 字段表

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `mktDataType` | STRING | ★ | `"Price"` |
| `priceType` | STRING | ★ | `"FxSpotRate"` |
| `referenceDate` | DATE | ★ | 参考日期 |
| `spotDate` | DATE | ★ | 即期交割日（通常 T+2） |
| `value` | DOUBLE | ★ | 即期汇率 |
| `unit` | STRING | ★ | 货币对标识（如 `"USDCNY"`） |

---

## 服务的资产类型

| 资产 | 用途 | Instrument | Pricer |
|------|------|-----------|--------|
| FxForward | 汇率基准 | [05_fx_forward](../../instruments/05_fx_forward/fields.md) | [fxForwardPricer](../../pricers/05_fx_forward_pricer/fields.md) |
| FxSwap | 汇率基准 | [06_fx_swap](../../instruments/06_fx_swap/fields.md) | [fxSwapPricer](../../pricers/06_fx_swap_pricer/fields.md) |
| FxEuropeanOption | 汇率基准 | [07_fx_option](../../instruments/07_fx_option/fields.md) | [fxEuropeanOptionPricer](../../pricers/07_fx_option_pricer/fields.md) |
| FxNDF | 汇率基准 | [10_fx_ndf](../../instruments/10_fx_ndf/fields.md) | [fxForwardPricer(NDF)](../../pricers/10_fx_ndf_pricer/fields.md) |
| FxExoticOption | 汇率基准 | [13_fx_exotic](../../instruments/13_fx_exotic_option/fields.md) | [fxExoticPricers](../../pricers/13_fx_exotic_option_pricer/fields.md) |

## 构建方式

手工组装 dict → `parseMktData`。FxSpotRate 是单一价格点，不需要 builder。

> 另见 [irCrossCurrencyCurveBuilder](../builders/ir_cross_currency_curve_builder.md)——构建跨货币曲线时也需要即期汇率作为输入参数。

---

## 常见陷阱

- `unit` 必须与 instrument 的 `currencyPair` 一致
- `spotDate` 通常是 referenceDate + 2 个工作日
