# bondPricer（债券曲线折现定价）

## 定价定位

`bondPricer` 用贴现曲线折现债券未来现金流，适合回答“在给定曲线下这只债的现值/全价是多少”。它不是价格收益率互算器，不直接给出净价、YTM、久期或凸度标签；这些口径要结合 `bondAccrInt` 和 `bondInstrumentCalculator`。

## 函数签名

```dos
bondPricer(instrument, pricingDate, discountCurve, [spreadCurve], [setting])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `parseInstrument` 生成的 Bond 对象。 |
| `pricingDate` | DATE | ★ | 定价日。通常应与曲线 `referenceDate` 一致。 |
| `discountCurve` | MKTDATA | ★ | `IrYieldCurve`，币种、参考日、曲线族应与债券匹配。 |
| `spreadCurve` | MKTDATA |  | 可选利差曲线，通常也是曲线对象。 |
| `setting` | DICT |  | `dict(STRING, ANY)`，控制风险输出。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `currency` | `discountCurve.currency` | 币种一致。 |
| `discountCurve` | `discountCurve.curveName` | 优先使用 instrument 指定的标准曲线族。 |
| `subType` | 曲线族或样本券类型 | 国债、政策性金融债、信用债不能混用曲线。 |
| `maturity` | 曲线日期/期限覆盖 | 曲线长端应覆盖或可合理外推到债券到期日。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量，表示给定曲线下现金流现值/全价含义。
- 传入 `setting`：返回 dict，包含 `npv` 以及所请求的风险字段。

交易净价口径需要另算：

```dos
dirtyPrice = bondPricer(bond, pricingDate, curve)
accrued = bondAccrInt(start, maturity, issuePrice, coupon, frequency, dayCountConvention, bondType, pricingDate)
cleanPrice = dirtyPrice - accrued
risk = bondInstrumentCalculator(bond, pricingDate, cleanPrice, "CleanPrice", calcRisk=true)
```

## setting 常用键

| 键 | 含义 |
|---|---|
| `calcDiscountCurveDelta` | 平行移动贴现曲线的一阶敏感度。 |
| `calcDiscountCurveGamma` | 曲线二阶敏感度。 |
| `calcDiscountCurveKeyRateDuration` | 关键期限久期。 |

## 常见错误

1. `coupon`、YTM、曲线利率都必须用小数。
2. `FixedRateBond + frequency="Once"` 对普通固息债通常应归一为 `Annual`。
3. 信用债缺曲线时不能静默套国债曲线。
4. 含权债需检查是否应使用 `OptionBond` 和 `YTE` 路径。
5. 输出不是自动标记的 clean price；净价必须扣应计利息。

## 关联文档

- Instrument 字段：[../../instruments/01_bond/fields.md](../../instruments/01_bond/fields.md)
- 曲线字段：[../../market_data/ir_yield_curve/fields.md](../../market_data/ir_yield_curve/fields.md)
- 曲线构造：[../../market_data/builders/bond_yield_curve_builder.md](../../market_data/builders/bond_yield_curve_builder.md)
- 价格/收益率互算：[bond_instrument_calculator.md](bond_instrument_calculator.md)
