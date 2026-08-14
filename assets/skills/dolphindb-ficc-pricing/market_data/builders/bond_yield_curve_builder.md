# bondYieldCurveBuilder（样本券收益率曲线构建）

## 定位

`bondYieldCurveBuilder` 根据一组样本债券和对应 YTM 报价构造 `IrYieldCurve`。当目标债券没有可直接使用的同 `subType` 曲线时，优先用同类样本券构造曲线；不要把缺失曲线的信用债静默套入国债曲线。

## 函数签名

```dos
bondYieldCurveBuilder(referenceDate, currency, bonds, terms, quotes, dayCountConvention,
                      [compounding], [frequency], [curveName], [method], [interpMethod], [extrapMethod])
```

已验证 DolphinDB 3.00.5 位置顺序：`curveName` 位于 `method`、`interpMethod`、`extrapMethod` 之前。

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `referenceDate` | DATE | ★ | 曲线参考日期。 |
| `currency` | STRING | ★ | 曲线币种，境内债通常为 `"CNY"`。 |
| `bonds` | INSTRUMENT[] | ★ | 样本债券向量，元素由 `parseInstrument` 生成。 |
| `terms` | DURATION[] | ★ | 样本券剩余期限向量，必须是 `DURATION` 类型，例如 `duration("365d")`。 |
| `quotes` | DOUBLE[] | ★ | 样本券 YTM 报价，小数格式。 |
| `dayCountConvention` | STRING | ★ | 曲线日计数规则，常用 `Actual365`。 |
| `compounding` | STRING |  | `Compounded`、`Simple` 或 `Continuous`。 |
| `frequency` | STRING |  | 曲线计息频率元数据，如 `Annual`。 |
| `curveName` | STRING |  | 曲线名，如 `CNY_TREASURY_BOND`、`CNY_CDB_BOND`。 |
| `method` | STRING |  | `Bootstrap`、`NS` 或 `NSS`。 |
| `interpMethod` | STRING |  | `Linear`、`CubicSpline`、`CubicHermiteSpline`。 |
| `extrapMethod` | STRING |  | 常用 `Flat`。 |

## 样本券选择规则

| 规则 | 说明 |
|---|---|
| 同类样本 | 样本券应与目标券同 `subType`，如 `CDB_BOND` 对 `CDB_BOND`。 |
| 有效存续 | `maturity > referenceDate`，且剩余期限为正。 |
| 报价真实 | 使用 `referenceDate` 当日或此前可接受日期的真实 YTM。百分数报价要除以 100。 |
| 去重 | 按 instrumentId、剩余期限、同月到期桶去重，避免同一期限重复支配曲线。 |
| 稀疏样本 | 样本较少时优先 `Bootstrap`，不要强行用 `NSS`。 |

## 方法选择

| method | 最低有效期限数 | 适用场景 |
|---|---:|---|
| `Bootstrap` | 2 | 样本稀疏、需要稳健通过。 |
| `NS` | 4 | 需要平滑参数化曲线，样本较充足。 |
| `NSS` | 6 | 长端形状更复杂且样本充足。 |

## 常见错误

1. `terms` 必须是 `DURATION[]`，不能传整数天数差。
2. `quotes` 必须是小数，2.35% 写 `0.0235`。
3. 不混用国债、政策性金融债、地方债、信用债样本。
4. 信用债样本不足时，回退到 instrument 标准曲线或补数据，不自动换国债曲线。
5. `curveName` 应反映曲线族，例如 `CNY_TREASURY_BOND`，不要写一次性任务名。

## 关联文档

- 债券字段：[../../instruments/01_bond/fields.md](../../instruments/01_bond/fields.md)
- 利率曲线字段：[../ir_yield_curve/fields.md](../ir_yield_curve/fields.md)
- 主工作流：根目录 `SKILL.md` 的“债券工作流示例”