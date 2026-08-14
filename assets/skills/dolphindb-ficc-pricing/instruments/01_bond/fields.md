# Bond（债券）— parseInstrument 字段定义

本文件用于构造 DolphinDB 债券 INSTRUMENT。债券字段不能只按资产大类处理，必须同时识别 `bondType`（现金流结构）和 `subType`（曲线族/信用风险类别）。曲线选择、样本券 fallback 和净价/全价解释的总规则见根目录 `SKILL.md` 的“债券工作流示例”。

## 金融含义

债券是确定或半确定现金流资产。`parseInstrument` 负责把条款转成现金流生成规则，`bondPricer` 再用贴现曲线折现未来现金流。字段错误会直接改变现金流形状，例如把零息债误建为固定利率债、把含权债误建为普通债、把信用债套国债曲线，都会导致估值口径错误。

## 通用字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `productType` | STRING | ★ | 固定为 `"Cash"`。 |
| `assetType` | STRING | ★ | 固定为 `"Bond"`。 |
| `bondType` | STRING | ★ | 债券现金流结构，见下方 `bondType` 表。 |
| `instrumentId` | STRING | ★ | 债券代码或内部标识。`.XIBE`、`.XSHG`、`.IB`、`.SH`、`.SZ` 等交易所/市场后缀只标识交易场所，**不改变贴现曲线族**；曲线选择由 `subType` 驱动。 |
| `start` | DATE | ★ | 起息日/计息开始日。使用 `start`，不要写 `issueDate`、`startDate`。 |
| `maturity` | DATE | ★ | 到期日。必须晚于定价日。 |
| `dayCountConvention` | STRING | ★ | 计息基准。常用 `ActualActualISDA`、`ActualActualISMA`、`Actual365`、`Actual360`、`Thirty360`。 |
| `issuePrice` | DOUBLE | 条件 | 发行价，通常为 100。贴现债、收益率互算、应计利息口径中很重要。 |
| `currency` | STRING | 建议 | 币种，生产脚本建议显式写 `"CNY"`、`"USD"` 等。 |
| `discountCurve` | STRING | 建议 | 标准曲线名或曲线族名。缺曲线 fallback 时优先使用此字段，不要硬编码国债曲线。 |
| `subType` | STRING | 建议 | 债券子类型，决定曲线族和样本券过滤。见下方 `subType` 表。 |
| `creditRating` | STRING | 条件 | 信用债曲线分层可使用，如 `AAA`、`AA+`。 |

## bondType 与专属字段

| `bondType` | 适用条款 | 关键字段 | 建模说明 |
|---|---|---|---|
| `FixedRateBond` | 固定票息、规则付息债 | `coupon`、`frequency`、`issuePrice` | `coupon` 用小数；来源频率为 `Once` 时通常归一为 `Annual`，除非本质是零息或贴现债。 |
| `ZeroCouponBond` | 无期间票息，到期一次兑付 | 起息/到期/发行或兑付口径 | 不要用普通固定票息年付债近似，除非用户明确接受模型假设。 |
| `DiscountBond` | 折价发行，到期按面值兑付 | `issuePrice` | 通常不填 `coupon`、`frequency`；收益来自发行价与兑付价差。 |
| `OptionBond` | 含赎回、回售、调息等特殊条款 | 固息债字段 + 期权标志/日期/价格 | 行权路径收益率用 `bondInstrumentCalculator(..., priceType="YTE")`，`YTM` 是持有到期路径。 |
| `FloatingRateBond` | 票息随指数重置 | 浮动指数、spread、reset/fixing 信息 | 缺少重置和 fixing 时不能默认当固定利率债。 |
| `AmortizingBond` | 本金分期偿还 | 本金摊还计划 | bullet 100 面值近似会改变久期和现金流。 |
| `PerpetuityBond` | 永续债或展期条款主导 | 赎回/延期/利差跳升假设 | 缺少假设时应说明限制，不强行给普通到期债口径。 |

## 常用字段枚举

| 字段 | 合法值/常用值 | 说明 |
|---|---|---|
| `frequency` | `Annual`、`Semiannual`、`Quarterly`、`Monthly`、`Once` | 中国固息债常见 `Annual` 或 `Semiannual`；`Once` 要谨慎。 |
| `dayCountConvention` | `ActualActualISDA`、`ActualActualISMA`、`Actual365`、`Actual360`、`Thirty360` | 已验证环境中 `Actual365Fixed` 不可用。 |
| `subType` 利率债 | `TREASURY_BOND`、`CDB_BOND`、`ADBC_BOND`、`EIBC_BOND`、`LOCAL_GOV_BOND` | 国债、国开、农发、口行、地方政府债。 |
| `subType` 信用债 | `SHORT_FIN_BOND`、`PPN`、`CORP_BOND`、`ABS`、`COMM_BANK_FIN_BOND` | 短融、PPN、公司/企业债、ABS、商业银行金融债。 |

## 最小固定利率债示例

```dos
bondDict = dict(STRING, ANY)
bondDict["productType"] = "Cash"
bondDict["assetType"] = "Bond"
bondDict["bondType"] = "FixedRateBond"
bondDict["instrumentId"] = "240025.IB"
bondDict["start"] = 2024.10.24
bondDict["maturity"] = 2031.10.24
bondDict["coupon"] = 0.0200
bondDict["frequency"] = "Semiannual"
bondDict["dayCountConvention"] = "ActualActualISDA"
bondDict["issuePrice"] = 100.0
bondDict["currency"] = "CNY"
bondDict["discountCurve"] = "CNY_TREASURY_BOND"
bondDict["subType"] = "TREASURY_BOND"
bond = parseInstrument(bondDict)
```

## 市场数据依赖

| 用途 | MarketData | 匹配要求 |
|---|---|---|
| 曲线折现定价 | `IrYieldCurve` | 币种、参考日、曲线族应与 `currency`、`discountCurve`、`subType` 一致。 |
| 缺曲线时构造 | `bondYieldCurveBuilder` | 样本券需同 `subType`，且有真实 YTM 报价和有效剩余期限。 |
| 净价/全价/收益率互算 | `bondInstrumentCalculator` | 输入价格口径必须与 `priceType` 一致。 |

## 常见错误

1. `coupon`、YTM、曲线点必须是小数，2% 写 `0.02`。
2. `FixedRateBond + frequency="Once"`：仅当一只**规则付息债**被误录成 `Once` 时才归一为 `Annual`。对真正只有单笔现金流的超短期贴现票据（SCP 超短融/短融、部分 ADBC/NCD 贴现券）`frequency="Once"` 是**正确**的，不得归一。另注：临近到期的单现金流票据，`bondInstrumentCalculator` 的净价/应计/YTM 拆分可能返回 NULL/None（已知限制），此时直接用 `bondPricer` 的全价口径。
3. `Actual365Fixed` 不是已验证 DolphinDB 3.00.5 环境的合法枚举，使用 `Actual365`。
4. 信用债、PPN、短融、ABS 不得静默套用 `CNY_TREASURY_BOND`。
5. `bondPricer` 不输出净价标签；净价 = 全价/dirty price - 应计利息。
6. 含权债需要 `OptionBond` 和行权路径；只用 `FixedRateBond` 会丢失选择权价值。
7. 交易所/市场后缀（`.XIBE`、`.XSHG`、`.IB`、`.SH`、`.SZ`）只表示交易场所，不决定贴现曲线族；曲线族由 `subType` 决定，不要因后缀切换曲线。