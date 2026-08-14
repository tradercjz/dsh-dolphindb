# irFixedFloatingSwapPricer（固定-浮动利率互换定价）

## 定价定位

`irFixedFloatingSwapPricer` 定价固定端与浮动端交换的 IRS。贴现曲线、远期曲线、历史/当前 fixing 曲线是三个不同角色，即使某些 CNY 示例中它们来自同一 FR007 曲线，也不要在文档或代码中混为一个概念。

## 函数签名

```dos
irFixedFloatingSwapPricer(instrument, pricingDate, discountCurve, forwardCurve, assetPriceCurve, [setting])
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `IrFixedFloatingSwap` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `discountCurve` | MKTDATA | ★ | 现金流贴现曲线。 |
| `forwardCurve` | MKTDATA | ★ | 预测未来浮动利率的远期曲线。 |
| `assetPriceCurve` | MKTDATA | ★ | `AssetPriceCurve`，提供浮动端已发生或当前 fixing。 |
| `setting` | DICT |  | 输出现金流、风险等扩展字段时使用 `dict(STRING, ANY)`。 |

## forward 曲线选择规则（instrument.forwardCurve 未指定时）

当 instrument 没有显式指定远期曲线（`forwardCurve` 为空）时，按以下优先级选取传给 pricer 的 `forwardCurve`：

1. **优先用专用远期曲线**：若市场数据中存在与浮动指数同族的专用 `*_FWD` 曲线（如 `CNY_FR_007_FWD` 对应 `FR_007`），优先用它作 `forwardCurve`。
2. **否则用单曲线法**：没有专用远期曲线时，复用贴现曲线（`forwardCurve = discountCurve`，即单曲线法）。

> 若 `*_FWD` 曲线按单曲线法构建（期限/数值与贴现曲线相同），两种取法等价；只有当 `*_FWD` 与贴现曲线确有差异（真实多曲线场景）时结果才分化，此时以专用 `*_FWD` 为准。

## 市场数据映射

浮动端指数字段名是 `iborIndex`（不是 `floatingLeg.index`）。下表的 `asset` 匹配仅适用于 `instrumentPricer` 自动匹配；专用 `irFixedFloatingSwapPricer` 按**位置**接收 `discountCurve, forwardCurve, assetPriceCurve` 三条曲线，不会校验 `asset` 是否等于 `iborIndex`。

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `notionalCurrency` | `discountCurve.currency` | 贴现币种一致。 |
| `iborIndex` | `assetPriceCurve.asset` | 仅 `instrumentPricer` 自动匹配需要指数名一致，例如 `FR_007` 或 `SHIBOR_3M`；专用 pricer 按位置取曲线。 |
| `iborIndex` | `forwardCurve.curveName` | 远期曲线应与浮动指数同族（同样只对自动匹配是硬约束）。 |
| `start`/`maturity` | 曲线日期覆盖 | 曲线覆盖互换现金流日期。 |

## 输出语义

- 不传 `setting`：返回 DOUBLE 标量 NPV。
- 传入受支持的 `setting`：返回 dict，包含 NPV、现金流明细或风险字段。

### NPV 符号与方向（payReceive）

返回的 NPV **已按 instrument 的 `payReceive` 方向带好符号**，无需再人工取反：

- `payReceive="Pay"`（付固定收浮动）：NPV = 浮动端 PV − 固定端 PV。
- `payReceive="Receive"`（收固定付浮动）：NPV = 固定端 PV − 浮动端 PV，恰为 Pay 的相反数。
- 二者满足 **Pay NPV + Receive NPV = 0**。

> NPV>0 表示该方向有利（例如市场利率高于固定票息时，Pay fixed 方占优）。同条款下 Pay 与 Receive 的 NPV 互为相反数。

## 常见错误

1. `start` 必须是 CFET 工作日，否则可能报 `start date must be a business day`。
2. 三条曲线不能少；缺 fixing 曲线会导致浮动端历史利率无法确定。
3. 用 `instrumentPricer` 自动匹配时，`AssetPriceCurve.asset` 必须和浮动端 `iborIndex` 匹配；专用 `irFixedFloatingSwapPricer` 按位置传入三条曲线，不做该校验。
4. instrument 用**扁平字段**（`fixedRate`、`iborIndex`、`spread`、`fixedDayCountConvention`、`floatingDayCountConvention` 等），不是 `fixedLeg` / `floatingLeg` 嵌套 dict；`setting` 用 `dict(STRING, ANY)`。
5. `Actual365Fixed` 不可用，使用 `Actual365`。

## 关联文档

- Instrument 字段：[../../instruments/04_irs/fields.md](../../instruments/04_irs/fields.md)
- 利率曲线：[../../market_data/ir_yield_curve/fields.md](../../market_data/ir_yield_curve/fields.md)
- fixing 曲线：[../../market_data/asset_price_curve/fields.md](../../market_data/asset_price_curve/fields.md)
