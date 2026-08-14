# bondInstrumentCalculator — 债券价格/收益率互算

## 概述

`bondInstrumentCalculator` 是债券**价格与收益率互算**的计算器，支持：
- 已知 YTM / YTE → 算净价、全价、应计利息
- 已知净价 / 全价 → 反算 YTM / YTE
- 可选输出麦考利久期、修正久期、凸度、PVBP 等风险指标
- 支持普通固定利率债、含权债（OptionBond）

### 与 `bondPricer` 的区别

| | `bondPricer` | `bondInstrumentCalculator` |
|---|---|---|
| 输入 | 贴现曲线（IrYieldCurve） | 价格 或 收益率（数值） |
| 输出 | NPV（净现值） | cleanPrice / dirtyPrice / ytm / accruedInterest |
| 用途 | 曲线折现定价 + Greeks | 价格 ↔ 收益率互算 + 风险指标 |
| 支持含权债 | ✗（FixedRateBond only） | ✓（OptionBond，priceType="YTE"） |

---

## 函数签名

```
bondInstrumentCalculator(bond, settlement, price, priceType, [calcRisk=false], [benchmark='Qeubee'], [isExercised])
```

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `bond` | INSTRUMENT | ★ | Bond INSTRUMENT 对象（标量或向量） |
| `settlement` | DATE | ★ | 结算日（购买日期）（标量或向量） |
| `price` | DOUBLE | ★ | 价格输入，含义由 `priceType` 决定 |
| `priceType` | STRING | ★ | `"YTM"` / `"YTE"` / `"CleanPrice"` / `"DirtyPrice"` |
| `calcRisk` | BOOL | | 默认 `false`；`true` 时额外返回久期、凸度、PVBP |
| `benchmark` | STRING | | 默认 `"Qeubee"`，可选 `"CSI"`（中证算法） |
| `isExercised` | BOOL | | 仅 OptionBond 有效；不传则自动判断是否行权 |

### priceType 说明

| priceType | price 含义 | 典型场景 |
|-----------|-----------|---------|
| `"YTM"` | 到期收益率（小数，如 0.0185） | 已知 YTM → 求净价/全价/应计利息 |
| `"YTE"` | 行权收益率（OptionBond） | 已知 YTE → 求净价/全价/应计利息 |
| `"CleanPrice"` | 净价 | 已知净价 → 反算 YTM |
| `"DirtyPrice"` | 全价（含应计利息） | 已知全价 → 反算 YTM |

> `bond` 的 `instrumentId` 后缀为 `.SH` 或 `.SZ` 时，视为交易所债券，应计利息计算会多加一天。

---

## 返回值

| 键 | 说明 | 条件 |
|----|------|------|
| `dirtyPrice` | 全价（脏价） | 始终返回 |
| `cleanPrice` | 净价 | 始终返回 |
| `accruedInterest` | 应计利息 | 始终返回 |
| `ytm` | 到期收益率 | 始终返回 |
| `yte` | 行权收益率 | 始终返回（OptionBond 有意义） |
| `macaulayDuration` | 麦考利久期 | `calcRisk=true` |
| `modifiedDuration` | 修正久期 | `calcRisk=true` |
| `convexity` | 凸度 | `calcRisk=true` |
| `pvbp` | 基点价值（PVBP / DV01） | `calcRisk=true` |

---

## 使用场景

### 场景 1：已知 YTM，求净价 / 全价 / 应计利息

```dos
ins = parseInstrument(dict(
    `productType`assetType`bondType`instrumentId`start`maturity`coupon`frequency`issuePrice`dayCountConvention,
    ["Cash","Bond","FixedRateBond","240025.IB",2024.10.24,2031.10.24,0.0200,"Semiannual",100.0,"ActualActualISDA"]
))
res = bondInstrumentCalculator(ins, settlement=2026.03.20, price=0.0185, priceType="YTM", calcRisk=false, benchmark="CSI")
// res["cleanPrice"]      — 净价（交易报价用）
// res["dirtyPrice"]      — 全价
// res["accruedInterest"] — 应计利息
// res["ytm"]             — 0.0185（输入确认）
```

### 场景 2：已知净价，反算 YTM + 风险指标

```dos
res = bondInstrumentCalculator(ins, settlement=2026.03.20, price=101.00, priceType="CleanPrice", calcRisk=true, benchmark="CSI")
// res["ytm"]             — 反算出的到期收益率
// res["modifiedDuration"]— 修正久期
// res["pvbp"]            — 基点价值
```

### 场景 3：含权债（OptionBond），行权收益率 + 全量风险指标

```dos
optionBond = dict(STRING, ANY)
optionBond["productType"]        = "Cash"
optionBond["assetType"]          = "Bond"
optionBond["bondType"]           = "OptionBond"
optionBond["version"]            = 0
optionBond["instrumentId"]       = "242659.SH"
optionBond["nominal"]            = 100.0
optionBond["start"]              = 2025.03.26
optionBond["maturity"]           = 2030.03.26
optionBond["coupon"]             = 0.0207
optionBond["frequency"]          = "Annual"
optionBond["exerciseDates"]      = [2028.03.26]
optionBond["hasCallOption"]      = true
optionBond["hasPutOption"]       = true
optionBond["hasCouponAdjust"]    = true
optionBond["dayCountConvention"] = "ActualActualISMA"
insOpt = parseInstrument(optionBond)

res = bondInstrumentCalculator(insOpt, settlement=2025.12.19, price=0.0195216, priceType="YTM", calcRisk=true)
// dirtyPrice       → 101.993837
// cleanPrice       → 100.468275
// accruedInterest  → 1.525562
// ytm              → 0.0195216
// yte              → 0.018528
// macaulayDuration → 2.205531
// modifiedDuration → 2.165411
// convexity        → 6.908517
// pvbp             → 0.022086
```

---

## 与 bondPricer 的配合使用

`bondPricer` 做曲线折现，`bondInstrumentCalculator` 做价格拆分，两者互补：

```dos
// Step 1: 用 bondPricer 从曲线拿到 NPV
npv = bondPricer(inst, pricingDate, curve)
// npv ≈ 101.39（近似等于全价）

// Step 2: 用 bondInstrumentCalculator 拆分净价/全价/YTM
res = bondInstrumentCalculator(inst, settlement=pricingDate, price=npv, priceType="DirtyPrice", benchmark="CSI")
// res["cleanPrice"]      — 净价（交易报价）
// res["accruedInterest"] — 应计利息
// res["ytm"]             — 对应 YTM
```

---

## Demo 脚本

见 [bond_instrument_calculator.dos](bond_instrument_calculator.dos)

---

## 关联文档

- **bondPricer**：[fields.md](fields.md)（曲线折现定价 + Greeks）
- **Instrument（普通债）**：[../instruments/01_bond/fields.md](../instruments/01_bond/fields.md)
- **Instrument（含权债 OptionBond）**：bondType 指定为 `OptionBond`，需填 `exerciseDates` / `hasCallOption` / `hasPutOption` / `hasCouponAdjust`
- **批量定价**：[../instrument_pricer.md](../instrument_pricer.md)
