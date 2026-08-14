# irDepositPricer（存款定价）

## 定价定位

`irDepositPricer` 用贴现曲线折现存款本金和固定利息，适用于同业存款、定期存款等单期固定利率现金流产品。

## 函数签名

```dos
irDepositPricer(instrument, pricingDate, discountCurve)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `Deposit` 对象。 |
| `pricingDate` | DATE | ★ | 定价日，应满足 `start <= pricingDate < maturity`。 |
| `discountCurve` | MKTDATA | ★ | 存款币种对应的 `IrYieldCurve`。 |

## 市场数据映射

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `notionalCurrency` | `discountCurve.currency` | 币种一致。 |
| `rate` | 无需市场数据 | 合同固定利率，用小数。 |
| `maturity` | 曲线日期覆盖 | 曲线需要覆盖到到期日或可合理外推。 |

## 输出语义

返回 DOUBLE 标量 NPV。符号由 instrument 的收付方向字段决定；若字段缺省或方向与预期不符，需要回到 instrument 文档确认。

## 常见错误

1. 字段名是 `rate`，不是 `interestRate`。
2. 起息日字段是 `start`，不是 `startDate`。
3. 已验证环境使用 `notionalCurrency` + `notionalAmount`，不要写成官方示例里的 ANY-vector `notional`。
4. `Actual365Fixed` 不可用，使用 `Actual365`。
5. Deposit 不需要 spot、forwardCurve 或 fixing curve。

## 关联文档

- Instrument 字段：[../../instruments/03_deposit/fields.md](../../instruments/03_deposit/fields.md)
- 利率曲线：[../../market_data/ir_yield_curve/fields.md](../../market_data/ir_yield_curve/fields.md)
