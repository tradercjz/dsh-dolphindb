# bondFuturesPricer（国债期货定价）

## 定价定位

`bondFuturesPricer` 用可交割债券的现金债价值、持有融资成本、期间票息和转换因子估算国债期货理论价格。它定的是期货合约，不是直接定价标的债券。

## 函数签名

```dos
bondFuturesPricer(instrument, pricingDate, discountCurve)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `BondFutures` 对象，内部应包含可交割债券条款。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `discountCurve` | MKTDATA | ★ | 可交割债券融资/贴现使用的 `IrYieldCurve`。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `underlying` | `discountCurve` | 曲线应匹配可交割券币种和风险类型。 |
| `settlement` | 曲线期限覆盖 | 曲线需覆盖到交割日。 |
| `nominalCouponRate` | 无直接市场数据 | 用于交易所标准券转换因子计算，不是 underlying 的真实 coupon。 |

## 输出语义

返回 DOUBLE 标量，表示国债期货理论价格。结果受可交割券条款、转换因子、融资曲线和交割日强烈影响。

## 常见错误

1. `maturity` 是期货合约到期日，`settlement` 是交割/结算日，不要与 underlying 债券到期日混淆。
2. `underlying` 在 instrument 字段中是原始债券 dict，不是已 parse 的 INSTRUMENT。
3. `nominalCouponRate` 是标准券名义票息，不等于可交割券实际 `coupon`。
4. 曲线要服务可交割债券融资，不是只看期货合约代码。

## 关联文档

- Instrument 字段：[../../instruments/02_bond_futures/fields.md](../../instruments/02_bond_futures/fields.md)
- 利率曲线：[../../market_data/ir_yield_curve/fields.md](../../market_data/ir_yield_curve/fields.md)
