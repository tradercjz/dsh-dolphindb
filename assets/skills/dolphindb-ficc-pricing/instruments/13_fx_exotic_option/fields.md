# FxExoticOption（外汇奇异期权）

## 金融含义

外汇奇异期权（Exotic FX Options）是在标准欧式期权基础上增加了非标准条款的结构化产品。DolphinDB v3.00.5 支持以下 4 种奇异期权 instrument 类型：

| 类型 | assetType | 定价函数 | 状态 |
|------|-----------|---------|------|
| 数字期权 | FxDigitalOption | `fxDigitalOptionPricer` | ✅ 可用 |
| 区间累计期权 | FxRangeAccrualOption | `fxRangeAccrualOptionPricer` | ✅ 可用 |
| 欧式 Quanto 期权 | FxEuropeanQuantoOption | `fxEuropeanQuantoOptionPricer` | ❌ v3.00.5 cast bug |
| 数字 Quanto 期权 | FxDigitalQuantoOption | `fxDigitalQuantoOptionPricer` | ❌ v3.00.5 cast bug |

> **已知问题**：Quanto 类期权的 parseInstrument 能正确创建 instrument，但 pricer 内部尝试将其向下转型为基础类型（FxEuropeanOption/FxDigitalOption），导致 "cast from type\<Quant::Instrument\> to type\<Quant::FxEuropeanOption\> is not allowed" 错误。预计在后续版本修复。

---

## 1. FxDigitalOption（数字/二元期权）

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"DigitalOption"` |
| assetType | STRING | 固定 `"FxDigitalOption"` |
| instrumentId | STRING | 自定义标识 |
| notionalCurrency | STRING | 名义本金币种（如 `"USD"`） |
| notionalAmount | DOUBLE | 到期支付金额（数字期权的固定 payoff） |
| strike | DOUBLE | 触发行权价 |
| maturity | DATE | 到期日 |
| direction | STRING | `"Buy"` 或 `"Sell"` |
| payoffType | STRING | `"Call"` 或 `"Put"` |
| dayCountConvention | STRING | 如 `"Actual365"` |
| underlying | STRING | 货币对标识（如 `"USDCNY"`） |
| domesticCurve | STRING | 本币曲线名称（如 `"CNY"`） |
| foreignCurve | STRING | 外币曲线名称（如 `"USD"`） |
| domesticCurrency | STRING | 本币代码（如 `"CNY"`） |

### 关联 Pricer

[`fxDigitalOptionPricer`](../../pricers/13_fx_exotic_option_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurf)`

- `spot`：DOUBLE 标量（即期汇率）
- `volSurf`：[FxVolatilitySurface](../../market_data/fx_vol_surface/fields.md) 类型
- 贴现曲线：[IrYieldCurve](../../market_data/ir_yield_curve/fields.md)（domestic + foreign）

---

## 2. FxRangeAccrualOption（区间累计期权）

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"RangeAccrualOption"` |
| assetType | STRING | 固定 `"FxRangeAccrualOption"` |
| instrumentId | STRING | 自定义标识 |
| notionalCurrency | STRING | 名义本金币种 |
| notionalAmount | DOUBLE | 名义本金金额 |
| start | DATE | 累计观察起始日 |
| maturity | DATE | 到期日 |
| direction | STRING | `"Buy"` 或 `"Sell"` |
| upperBarrier | DOUBLE | 区间上轨 |
| lowerBarrier | DOUBLE | 区间下轨 |
| dayCountConvention | STRING | 如 `"Actual365"` |
| underlying | STRING | 货币对标识 |
| domesticCurve | STRING | 本币曲线名称 |
| foreignCurve | STRING | 外币曲线名称 |

### 关联 Pricer

[`fxRangeAccrualOptionPricer`](../../pricers/13_fx_exotic_option_pricer/fields.md)`(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurf)`

- `spot`：DOUBLE 标量
- `volSurf`：[FxVolatilitySurface](../../market_data/fx_vol_surface/fields.md) 类型
- 贴现曲线：[IrYieldCurve](../../market_data/ir_yield_curve/fields.md)（domestic + foreign）

---

## 3. FxEuropeanQuantoOption（欧式 Quanto 期权，v3.00.5 不可用）

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Option"` |
| optionType | STRING | 固定 `"EuropeanOption"` |
| assetType | STRING | 固定 `"FxEuropeanQuantoOption"` |
| instrumentId | STRING | 自定义标识 |
| notionalCurrency | STRING | 名义本金币种 |
| notionalAmount | DOUBLE | 名义本金金额 |
| strike | DOUBLE | 行权价 |
| maturity | DATE | 到期日 |
| direction | STRING | `"Buy"` 或 `"Sell"` |
| payoffType | STRING | `"Call"` 或 `"Put"` |
| quantoCurrency | STRING | 结算货币（如 `"CNY"`） |
| quantoFactor | DOUBLE | Quanto 换算因子 |
| dayCountConvention | STRING | 如 `"Actual365"` |
| underlying | STRING | 货币对标识 |
| domesticCurve | STRING | 本币曲线名称 |
| foreignCurve | STRING | 外币曲线名称 |

### 关联 Pricer

```
fxEuropeanQuantoOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, quantoCurve, volSurfs)
```

- `volSurfs`：dict(STRING, ANY)，key 为货币对名称（需覆盖 underlying 对、domestic-quanto 交叉对、foreign-quanto 交叉对）

---

## 4. FxDigitalQuantoOption（数字 Quanto 期权，v3.00.5 不可用）

与 FxEuropeanQuantoOption 字段基本相同，区别在于 `optionType="DigitalOption"` / `assetType="FxDigitalQuantoOption"`。

### 关联 Pricer

```
fxDigitalQuantoOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, quantoCurve, volSurfs)
```

---

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| — (DOUBLE 标量) | — | spot — 即期汇率 |
| IrYieldCurve | Curve | domesticCurve — 本币贴现曲线 |
| IrYieldCurve | Curve | foreignCurve — 外币贴现曲线 |
| FxVolatilitySurface | Surface | volSurf — 波动率曲面 |

## 常见陷阱

1. **direction 必填**：所有奇异期权都需要 `direction`（`"Buy"` 或 `"Sell"`），这与标准 FxEuropeanOption 不同。
2. **optionType vs assetType**：同一 optionType 可对应不同 assetType。如 `optionType="DigitalOption"` 可搭配 `assetType="FxDigitalOption"` 或 `"FxDigitalQuantoOption"`。
3. **FxVolatilitySurface 格式**：奇异期权使用 `smileMethod` + `currencyPair` + `termDates` + `volSmiles` 格式（不是简化的 dates/strikes/values 格式）。
4. **支持的货币对**：USDCNY, EURUSD, JPYCNY, EURCNY, GBPCNY, HKDCNY。
