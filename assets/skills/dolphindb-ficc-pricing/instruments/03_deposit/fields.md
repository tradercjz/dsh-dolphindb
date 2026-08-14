# Deposit（同业存款 / 定期存款）

## 金融含义

Deposit 代表一笔固定期限、固定利率的银行间存款。定价时按照贴现曲线折现面值 + 利息来计算 NPV。

- 常见用途：银行间同业拆借、货币市场——估值参考利率的基础产品。
- 定价函数：`irDepositPricer(instrument, pricingDate, discountCurve)`

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| productType | STRING | 固定 `"Cash"` |
| assetType | STRING | 固定 `"Deposit"`（不要写 `"InterestRate"`，也没有单独的 `interestRateType` 字段） |
| start | DATE | 起息日 |
| maturity | DATE | 到期日 |
| rate | DOUBLE | 固定利率，如 `0.018` 表示 1.80% |
| dayCountConvention | STRING | 计息基准，如 `"Actual365"` |
| notionalCurrency | STRING | 名义本金币种，如 `"CNY"` |
| notionalAmount | DOUBLE | 名义本金金额，如 `1000000` |
| payReceive | STRING | 方向：`"Receive"`（存放方收利息）或 `"Pay"`（借出方） |

## 枚举值速查

| 字段 | 可选值 |
|------|--------|
| dayCountConvention | `Actual360`, `Actual365`, `ActualActualISDA`, `Thirty360` 等 |
| payReceive | `Receive`, `Pay` |

## 关联的 mktData

| mktData 类型 | 结构类型 | 用途 |
|-------------|----------|------|
| [IrYieldCurve](../../market_data/ir_yield_curve/fields.md) | Curve | 贴现曲线（discountCurve） |

## 关联的 Pricer

- [`irDepositPricer`](../../pricers/03_deposit_pricer/fields.md)`(instrument, pricingDate, discountCurve)` → 返回 NPV（本金 + 利息折现值）

## 常见陷阱

1. **notional 格式**：服务端 3.00.5 要求使用 `notionalCurrency` 和 `notionalAmount` 两个独立字段，而非官方文档中 `"notional": ["CNY", 1E6]` 的 ANY-vector 格式。
2. **start/maturity**：没有工作日限制（与 IRS 不同），但日期必须合理（start < maturity）。
3. **rate**：以小数表示，不是百分数（1.80% → 0.018）。
4. **dayCountConvention**：DolphinDB 3.00.5 验证环境使用 `Actual365`，不要写 `Actual365Fixed`。
