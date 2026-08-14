---
name: dolphindb-ficc-pricing
description: DolphinDB FICC 定价技能。用于构造 FICC Instrument、MarketData、曲线/曲面、调用专用 pricer 或 instrumentPricer，并校验债券、利率、外汇、商品期货期权、权益期权等资产定价脚本。
license: MIT
metadata:
  author: ddb-user
  version: "2.1.0"
---

# dolphindb-ficc-pricing

本 skill 是 DolphinDB FICC 定价的通用中文规范。它服务于三个目标：准确构造 `parseInstrument` 入参、准确构造 `parseMktData` 或 builder 入参、准确选择 pricer 并解释结果。平台 API、前端 session、REST endpoint、业务数据库名、页面状态同步等内容不属于本 skill；这些内容应放在平台集成 skill 中。

## 一、适用范围

使用本 skill 处理以下任务：

- 根据条款构造单只或一组 FICC instrument。
- 根据市场数据构造利率曲线、股息曲线、资产价格曲线、外汇即期、波动率曲面。
- 调用 DolphinDB 专用定价函数，例如 `bondPricer`、`fxForwardPricer`、`eqEuropeanOptionPricer`。
- 调用 `instrumentPricer(instrument, pricingDate, marketData)` 做批量或自动匹配定价。
- 校验 `.dos` 示例脚本、定位字段错误、补充可审计输出。

不在本 skill 中硬编码平台函数前缀、平台库表路径、HTTP 路由、会话字段、UI 状态或一次性任务说明。

## 二、通用工作流

### 1. 确认条款

先确认资产类型、交易方向、本金、币种、起息日、到期日、行权价、票息、浮动指数、曲线名称、参考日期等真实输入。缺少关键市场数据时，应说明缺口或使用明确给出的替代假设；不要凭空补曲线、票息、波动率、股息率、样本券或即期汇率。

### 2. 构造 Instrument

统一使用 `dict(STRING, ANY)`：

```dos
instDict = dict(STRING, ANY)
instDict["productType"] = "Cash"
instDict["assetType"] = "Bond"
// ...继续填字段
inst = parseInstrument(instDict)
```

字段以各资产目录下的 `instruments/*/fields.md` 为准。字段名要使用 DolphinDB 实际枚举和字段名，例如债券用 `start`，不是 `issueDate`；权益期权用 `payoffType`，不是 `callPut`；NDF 用 `direction`，不是 `buySell`。

### 3. 构造 MarketData

市场数据也统一使用 `dict(STRING, ANY)` 后 `parseMktData`，或使用对应 builder。利率和波动率输入均使用小数，`0.02` 表示 2%，不能写成 `2`。

常见对象：

| 类型 | 用途 | 文档 |
|---|---|---|
| `IrYieldCurve` | 债券、存款、IRS、FX、期权贴现曲线 | `market_data/ir_yield_curve/fields.md` |
| `AssetPriceCurve` | IRS fixing、商品期货曲面构建的期货价格曲线 | `market_data/asset_price_curve/fields.md` |
| `FxSpotRate` | `instrumentPricer` 自动匹配外汇即期 | `market_data/fx_spot/fields.md` |
| `FxVolatilitySurface` | 外汇期权波动率曲面 | `market_data/fx_vol_surface/fields.md` |
| `VolatilitySurface` | 商品期货期权、权益期权波动率曲面 | `market_data/vol_surface/fields.md` |
| `DividendCurve` | 权益期权股息率曲线 | `market_data/dividend_curve/fields.md` |

专用 FX pricer（`fxForwardPricer` / `fxSwapPricer` / `fxEuropeanOptionPricer` 等）的 `spot` 参数要 **DOUBLE 标量**；若手头是存量 `FxSpotRate` MKTDATA 对象，取其 `value` 字段得标量再传，例如 `spot = extractMktData(obj)["value"]`。`FxSpotRate` 对象本身只用于 `instrumentPricer` 自动匹配。

### 4. 选择定价入口

单资产优先使用专用 pricer；多资产组合、需要自动匹配市场数据时使用 `instrumentPricer`。已验证环境中 `instrumentPricer` 签名为三参数：

```dos
instrumentPricer(instrument, pricingDate, marketData)
```

不要给已验证服务器传第四个参数或 platform wrapper 专用参数。

### 5. 输出可审计结果

示例脚本最后应返回标量、dict 或小表，避免最后一行只是赋值或注释。推荐返回 `table(...)`，至少包含 `pricingDate`、核心输入、NPV/price、曲线名称、关键风险指标或状态字段。

### 6. 执行与验收

用运行环境提供的 **DolphinDB 执行能力**读取并运行/验证 `.dos`(在 DDB 实例上执行脚本),不依赖任何本地 runner、Python 或 shell。成功判据:服务端无报错、脚本最后返回标量/dict/表(返回 `None` 视为成功);失败时检查返回中的 `[Error]`、`Code Execution Failed`、`Server Response` 等字样。

## 三、资产覆盖矩阵

| # | 资产 | Instrument 文档 | 专用 pricer | 主要市场数据 | 输出语义 |
|---|---|---|---|---|---|
| 1 | 债券 | `instruments/01_bond/fields.md` | `bondPricer(instrument, pricingDate, discountCurve, [spreadCurve], [setting])` | `IrYieldCurve`，可选 spread curve | 曲线折现得到的全价/现值；净价需另减应计利息 |
| 2 | 国债期货 | `instruments/02_bond_futures/fields.md` | `bondFuturesPricer(instrument, pricingDate, discountCurve)` | 可交割债券融资/贴现曲线 | 理论期货价格 |
| 3 | 存款 | `instruments/03_deposit/fields.md` | `irDepositPricer(instrument, pricingDate, discountCurve)` | `IrYieldCurve` | 标量 NPV |
| 4 | 利率互换 | `instruments/04_irs/fields.md` | `irFixedFloatingSwapPricer(instrument, pricingDate, discountCurve, forwardCurve, assetPriceCurve, [setting])` | 贴现曲线、远期曲线、fixing 曲线 | 标量 NPV 或含明细的 dict |
| 5 | 外汇远期 | `instruments/05_fx_forward/fields.md` | `fxForwardPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)` | spot 标量、两条利率曲线 | 标量 NPV |
| 6 | 外汇掉期 | `instruments/06_fx_swap/fields.md` | `fxSwapPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)` | spot 标量、两条利率曲线 | 近端+远端合计 NPV |
| 7 | 外汇欧式期权 | `instruments/07_fx_option/fields.md` | `fxEuropeanOptionPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve, volSurface, [setting])` | spot、两条曲线、`FxVolatilitySurface` | 标量 NPV 或 Greeks dict |
| 8 | 商品期货欧式期权 | `instruments/08_cm_fut_european_option/fields.md` | `cmFutEuropeanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf, [setting], [model], [method])` | 期货价标量、贴现曲线、`VolatilitySurface` | 标量 NPV 或 Greeks dict |
| 9 | 商品期货美式期权 | `instruments/09_cm_fut_american_option/fields.md` | `cmFutAmericanOptionPricer(instrument, pricingDate, futPrice, discountCurve, volSurf, [setting], [model], [method])` | 期货价标量、贴现曲线、`VolatilitySurface` | 含提前行权价值的 NPV |
| 10 | 外汇 NDF | `instruments/10_fx_ndf/fields.md` | `fxForwardPricer(instrument, pricingDate, spot, domesticCurve, foreignCurve)` | spot、两条曲线 | NDF 差额结算 NPV |
| 11 | 权益欧式期权 | `instruments/11_eq_european_option/fields.md` | `eqEuropeanOptionPricer(instrument, pricingDate, spotPx, discountCurve, dividendYieldCurve, volSurface, [setting])` | spot、贴现曲线、股息曲线、波动率曲面 | 标量 NPV 或 Greeks dict |
| 12 | 权益美式期权 | `instruments/12_eq_american_option/fields.md` | `eqAmericanOptionPricer(instrument, pricingDate, spotPx, discountCurve, dividendYieldCurve, volSurface, [setting], [model], [method])` | spot、贴现曲线、股息曲线、波动率曲面 | 含提前行权价值的 NPV |
| 13 | 外汇奇异期权 | `instruments/13_fx_exotic_option/fields.md` | `fxDigitalOptionPricer`、`fxRangeAccrualOptionPricer` | spot、两条曲线、`FxVolatilitySurface` | v3.00.5 已验证数字期权和区间累计 |

## 四、债券工作流示例

债券是本 skill 中最容易出错的资产。不能只看 `Bond`，必须同时识别 `bondType` 和 `subType`。

### 1. bondType 决定现金流结构

| `bondType` | 适用场景 | 构造要点 |
|---|---|---|
| `FixedRateBond` | 固定票息、规则付息 | 必填 `coupon`、`frequency`；仅当规则付息债被误录成 `Once` 时才归一为 `Annual`。真正单笔现金流的超短期票据（SCP 超短融/短融、部分 ADBC/NCD 贴现券）`Once` 是正确的，不要归一；本质零息/贴现债同理。临近到期的单现金流票据 `bondInstrumentCalculator` 的净价/应计/YTM 拆分可能返回 NULL/None（已知限制）。 |
| `ZeroCouponBond` | 无期间票息，到期一次兑付 | 不要硬建成普通固定票息债 |
| `DiscountBond` | 折价发行，到期按面值兑付 | 重点字段是 `issuePrice`，通常不需要 `coupon`/`frequency` |
| `OptionBond` | 含赎回、回售、调息等特殊条款 | 需补充期权标志、行权日/价格/票息路径；行权收益率用 `priceType="YTE"` |
| `FloatingRateBond` | 票息随指数重置 | 需要浮动指数、spread、reset/fixing 信息；不能默认当固定利率债 |
| `AmortizingBond` | 本金分期偿还 | 需要本金摊还计划；普通 bullet 假设会显著偏差 |
| `PerpetuityBond` | 永续债或展期特征主导 | 需要赎回/延期/利差跳升假设 |

### 2. subType 决定曲线族和样本券

| 类别 | `subType` |
|---|---|
| 利率债 | `TREASURY_BOND`、`CDB_BOND`、`ADBC_BOND`、`EIBC_BOND`、`LOCAL_GOV_BOND` |
| 信用债 | `SHORT_FIN_BOND`、`PPN`、`CORP_BOND`、`ABS`、`COMM_BANK_FIN_BOND` |

不要使用过期或自造枚举，例如 `LOC_GOV_BOND`、`CORPORATE_BOND` 或中文标签。

#### `subType → 标准 discountCurve 名` 映射（信用债无评级时默认 AAA 曲线）

| `subType` | `discountCurve` | | `subType` | `discountCurve` |
|---|---|---|---|---|
| `TREASURY_BOND` | `CNY_TREASURY_BOND` | | `NCD` | `CNY_NCD_AAA` |
| `CENTRAL_BANK_BILL` | `CNY_CENTRAL_BANK_BILL` | | `MTN` | `CNY_MTN_AAA` |
| `CDB_BOND` | `CNY_CDB_BOND` | | `SHORT_FIN_BOND` | `CNY_MTN_AAA` |
| `EIBC_BOND` | `CNY_EIBC_BOND` | | `CORP_BOND` / `PPN` / `ABS` | `CNY_OTHER_BOND_AAA` |
| `ADBC_BOND` | `CNY_ADBC_BOND` | | `URBAN_INVEST_BOND` | `CNY_URBAN_INVEST_BOND_AAA` |
| `LOCAL_GOV_BOND` | `CNY_LOCAL_GOV_BOND_AAA` | | `BANK_BOND` / `COMM_BANK_FIN_BOND` | `CNY_BANK_BOND_AAA` |
| `RAILWAY_BOND` | `CNY_RAILWAY_BOND` | | `SECURITIES_BOND` | `CNY_OTHER_BOND_AAA` |

有评级时把 `_AAA` 换成实际评级后缀（如 `_AA+`）。instrument 的 `discountCurve` 字段应据此填写；`instrumentPricer` 即按该字段自动匹配同名曲线。**信用债不得静默套用国债曲线。**

### 3. 债券曲线选择顺序

1. 用户明确提供曲线且币种、日期、风险类别匹配时，直接使用。
2. instrument 的 `discountCurve` 指向可信标准曲线时，优先按该曲线族取数。
3. 有同 `subType`、同参考日或可接受参考日的存量曲线时使用。
4. 无存量曲线时，用同 `subType` 样本券和真实 YTM 报价通过 `bondYieldCurveBuilder` 构造。
5. 样本券少于两个有效期限或报价不可信时，回退到 instrument 标准曲线或停止并补数据。

信用债、PPN、短融、ABS、商业银行金融债不能因为缺曲线就静默套国债曲线。国债曲线只能用于国债或明确的无风险基准比较。

### 4. 样本券选择规则

- 样本券必须与目标券同 `subType`，且 `maturity > pricingDate`。
- YTM 报价必须是真实市场报价，并转换为小数。
- 按目标期限匹配剩余期限，优先流动性更好的券。
- 对续发、柜台、重复期限或同一月到期的样本做去重。
- `Bootstrap` 至少需要 2 个有效期限；`NS` 至少建议 4 个；`NSS` 至少建议 6 个。

### 5. 债券结果解释

`bondPricer` 返回的是给定曲线下的现值/全价含义，不自动拆分净价、全价、应计利息和收益率。需要交易报价口径时使用：

```dos
dirtyPrice = bondPricer(bond, pricingDate, discountCurve)
accrued = bondAccrInt(start, maturity, issuePrice, coupon, frequency, dayCountConvention, bondType, pricingDate)
cleanPrice = dirtyPrice - accrued
risk = bondInstrumentCalculator(bond, pricingDate, cleanPrice, "CleanPrice", calcRisk=true)
```

含权债若按行权路径估值，使用 `bondInstrumentCalculator(..., priceType="YTE")`；`YTM` 是到期收益率路径。

## 五、文件组织

| 路径 | 用途 |
|---|---|
| `instruments/*/fields.md` | `parseInstrument` 字段、枚举、必填项、条款含义 |
| `instruments/*/demo.dos` | 最小可运行 instrument 构造示例 |
| `market_data/*/fields.md` | `parseMktData` 字段、曲线/曲面格式、适用资产 |
| `market_data/builders/*` | 曲线和曲面 builder 参数、输入形状、demo |
| `pricers/*/fields.md` | 专用 pricer 签名、参数、市场数据映射、输出语义、常见错误 |
| `pricers/*/demo.dos` | 单资产定价 demo |
| `pricers/instrument_pricer.md` | 批量自动匹配定价入口 |