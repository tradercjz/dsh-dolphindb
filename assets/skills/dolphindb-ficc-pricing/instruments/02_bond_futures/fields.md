# BondFutures（国债期货）— parseInstrument 字段定义

> **金融含义**：国债期货是以国债为标的的标准化期货合约。交易所规定一只虚拟的"标准券"（如票息 3% 的 10 年期国债），实际交割时通过转换因子（CF）将真实可交割券折算为标准券价格。
>
> **挂钩 Pricer**：[`bondFuturesPricer`](../../pricers/02_bond_futures_pricer/fields.md)`(instrument, pricingDate, discountCurve)`
>
> **所需 MktData**：[`IrYieldCurve`](../../market_data/ir_yield_curve/fields.md)（贴现曲线）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `productType` | STRING | ★ | 固定 `"Futures"` |
| `futuresType` | STRING | ★ | 固定 `"BondFutures"` |
| `instrumentId` | STRING | | 合约代码，如 `"T2509"` |
| `nominal` | DOUBLE | ★ | 合约面值（国债期货通常 100） |
| `maturity` | DATE | ★ | 期货合约到期日 |
| `settlement` | DATE | ★ | 交割日 |
| `underlying` | DICT | ★ | 标的可交割债券的 instrument dict（FixedRateBond） |
| `nominalCouponRate` | DOUBLE | ★ | 名义票面利率（T 合约 = 0.03，TF = 0.03，TS = 0.03） |

## underlying 结构

`underlying` 是一个 FixedRateBond 的字典（未经 `parseInstrument`），至少包含：

```
{
    "productType": "Cash",
    "assetType": "Bond",
    "bondType": "FixedRateBond",
    "instrumentId": "220010.IB",
    "start": 2020.12.25,
    "maturity": 2031.12.25,
    "coupon": 0.0149,
    "frequency": "Annual",
    "dayCountConvention": "ActualActualISDA"
}
```

## 常见陷阱

- `nominalCouponRate` 是交易所标准券的名义利率，不是 underlying 的实际 coupon
- `underlying` 传入的是原始字典，不是 INSTRUMENT 对象
- `maturity` 指期货合约到期日，不是标的债券到期日
- Pricer 内部会自动计算转换因子（CF），输出为标准券盘面公允价格
