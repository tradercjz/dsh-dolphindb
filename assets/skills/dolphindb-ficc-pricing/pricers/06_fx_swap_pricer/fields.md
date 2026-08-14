# fxSwapPricer（外汇掉期定价）

## 定价定位

`fxSwapPricer` 将外汇掉期视为近端与远端两笔方向相反的外汇交换，并计算两条腿合计 NPV。它同时受即期汇率、近端汇率、远端汇率和两币种曲线影响。

## 函数签名

```dos
fxSwapPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)
```

## 参数表

| 参数 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `instrument` | INSTRUMENT | ★ | `FxSwap` 对象。 |
| `pricingDate` | DATE | ★ | 定价日。 |
| `spot` | DOUBLE | ★ | 即期汇率标量。 |
| `domesticCurve` | MKTDATA | ★ | 报价货币/本币贴现曲线。 |
| `foreignCurve` | MKTDATA | ★ | 基准货币/外币贴现曲线。 |

## 市场数据映射

字段为扁平结构：近端/远端执行价是 `nearStrike` / `farStrike`（不是 `nearLeg.strike` / `farLeg.strike`），本币曲线标签是 `domesticCurve`（不是 `domesticCurrency`）。

| Instrument 字段 | MarketData 要求 | 校验要点 |
|---|---|---|
| `nearStrike` | `spot` | 近端通常接近即期，但以合约字段为准。 |
| `farStrike` | 两条曲线隐含远期 | 远端价值来自约定远期与市场远期差异。 |
| `domesticCurve` | `domesticCurve.currency` | 本币曲线一致。 |
| `notionalCurrency` | `foreignCurve.currency` | 外币曲线一致。 |

## 输出语义

返回 DOUBLE 标量，表示近端和远端两条腿合计 NPV。

## 常见错误

1. 近端和远端方向必须相反。
2. 专用 pricer 的 `spot` 是 DOUBLE，不是 `FxSpotRate` MKTDATA。
3. 远端 `strike` 是远期汇率，不是掉期点；掉期点 = 远期汇率 - 即期汇率。
4. 曲线传反会改变估值方向。

## 关联文档

- Instrument 字段：[../../instruments/06_fx_swap/fields.md](../../instruments/06_fx_swap/fields.md)
- FX 远期定价：[../05_fx_forward_pricer/fields.md](../05_fx_forward_pricer/fields.md)
