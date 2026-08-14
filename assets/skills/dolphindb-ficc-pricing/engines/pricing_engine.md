# 流式定价引擎 — createPricingEngine + createMktDataEngine


## 架构

```
 bondMktDataSt (streamTable)
      ↓  subscribeTable
 createMktDataEngine  ("BOND_MKTDATA_ENGINE")
      ↓  handler=pricingEngine  (曲线构建完成自动触发)
 createPricingEngine  ("BOND_PRICING_ENGINE")
      ↓  handler 函数
 pricingResultSt (streamTable 输出)
```

**关键行为（实测）**：
- 每次向 `bondMktDataSt` 插入行情数据 → 自动重新构建曲线 → 自动重新定价 → 结果写入 `pricingResultSt`
- 支持局部更新（只更新一支样本券 YTM）→ 同样触发完整重新定价
- 3次批量插入 = 3条定价结果（每批一条）

---

## createMktDataEngine

### 签名

```
createMktDataEngine(name, referenceDate, mktDataConfig, [handler], [historicalData], [engineConfig])
```

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | STRING | 引擎名称（节点唯一） |
| `referenceDate` | DATE | 参考日期 |
| `mktDataConfig` | DICT / DICT[] | 市场数据构建配置，见下方 |
| `handler` | 可选 | 输出目标：自定义函数 / 共享表 / **PricingEngine** |
| `historicalData` | MKTDATA[] | 预置历史曲线（不需要实时构建时传入） |
| `engineConfig` | DICT | 引擎配置 |

### BondYieldCurve mktDataConfig 配置

```dos
mktCfg = dict(STRING, ANY)
mktCfg["name"]               = "CNY_TREASURY_BOND"   // 曲线名称
mktCfg["type"]               = "BondYieldCurve"
mktCfg["bonds"]              = curveBonds             // INSTRUMENT vector（从 DB 加载或 parseInstrument）
mktCfg["currency"]           = "CNY"
mktCfg["dayCountConvention"] = "ActualActualISDA"
mktCfg["compounding"]        = "Compounded"           // 可选，默认 Compounded
mktCfg["interpMethod"]       = "CubicSpline"          // 可选，默认 Linear
mktCfg["extrapMethod"]       = "Flat"                 // 可选，默认 Flat
```

**注意**：引擎自动用 `referenceDate` 计算每支 bonds 的剩余期限，无需手动传 terms。

### BondYieldCurve 输入数据格式

| 列名 | 类型 | 说明 |
|------|------|------|
| `type` | STRING | 固定为 `"Bond"` |
| `name` | STRING | 债券 instrumentId，须与 `bonds` 中的 `instrumentId` 匹配 |
| `price` | DOUBLE | YTM（小数形式，如 `0.0175`） |

```dos
data = table(["Bond","Bond","Bond"] as type,
             ["250013.XIBE","260004.XIBE","260005.XIBE"] as name,
             [0.0155, 0.0175, 0.0200] as price)
engine.append!(data)
// 或直接通过 subscribeTable 自动推送
```

### engineConfig 常用选项

| 键 | 默认 | 说明 |
|----|------|------|
| `numThreads` | 8 | 工作线程数 |
| `outputTime` | false | 是否向 handler 传递 eventTime |
| `useSystemTime` | true | 使用系统时间作为事件时间 |

---

## createPricingEngine

### 签名

```
createPricingEngine(name, instrument, [handler], [engineConfig])
```

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | STRING | 引擎名称 |
| `instrument` | INSTRUMENT / INSTRUMENT[] | 待定价的金融工具（可以是向量） |
| `handler` | 可选 | 定价结果处理函数 |
| `engineConfig` | DICT | 引擎配置，支持 `outputTime`、`numThreads` 等 |

### handler 签名

```dos
// outputTime=false（默认）
def handler(name, date, npv) { ... }

// outputTime=true
def handler(eventTime, name, date, npv) { ... }
```

### 推荐：输出到共享流表

```dos
share streamTable(1:0, `eventTime`name`date`price,
                  [NANOTIMESTAMP, STRING, DATE, DOUBLE]) as pricingResultSt

def pricingHandler(eventTime, name, date, npv) {
    tableInsert(pricingResultSt, eventTime, name, date, npv)
}

eCfg = dict(STRING, ANY)
eCfg["numThreads"] = 1
eCfg["outputTime"] = true
pricingEngine = createPricingEngine("BOND_PRICING_ENGINE", [targetInst], pricingHandler, eCfg)
```

### 定价债券的 discountCurve 匹配规则

- **显式指定（推荐）**：在 `parseInstrument` 的 dict 中设置 `"discountCurve": "CNY_TREASURY_BOND"`
- **隐式匹配（已验证）**：TREASURY_BOND instrument 的 `discountCurve` 字段为空，且引擎中只有一条 CNY 曲线时，会自动匹配该曲线；推荐显式指定以避免歧义

---

## 完整流式 Pipeline（已验证）

```dos
// ============================================================
// 实时定价 Pipeline：streamTable -> MktDataEngine -> PricingEngine
// ============================================================

referenceDate = 2026.04.20

// ---- 清理 ----
try { unsubscribeTable(tableName="bondMktDataSt", actionName="feedMktDataEngine") } catch(ex) {}
try { dropStreamEngine("BOND_MKTDATA_ENGINE") } catch(ex) {}
try { dropStreamEngine("BOND_PRICING_ENGINE") } catch(ex) {}
try { undef("bondMktDataSt", SHARED) } catch(ex) {}
try { undef("pricingResultSt", SHARED) } catch(ex) {}

// ---- 从 DB 加载曲线构建样本券（替换为实际部署的 Instrument 库路径）----
db = database("dfs://instrument_std")   // ▶ 替换为你的 Instrument 库路径
instTbl = loadTable(db, "Instrument")

// 9支国债：~3M, ~9M, ~3Y, ~5Y, ~7Y, ~10Y, ~13Y, ~20Y, ~30Y
bondIds = ["250013.XIBE", "260001.XIBE", "260004.XIBE",
           "260003.XIBE", "250025.XIBE", "260005.XIBE",
           "2400102.XIBE", "2500004.XIBE", "260002.XIBE"]
bondMeta = select instrumentId, maturity, instrument
           from instTbl where instrumentId in bondIds order by maturity
curveBonds = bondMeta.instrument

// ---- 加载定价目标券（不在曲线构建集合中）----
targetMeta = select instrument from instTbl where instrumentId = "200007.XIBE"
targetInst = targetMeta.instrument[0]   // 50Y 国债 (2070-05-25)

// ---- 创建输出流表 ----
share streamTable(1:0, `eventTime`name`date`price,
                  [NANOTIMESTAMP, STRING, DATE, DOUBLE]) as pricingResultSt

// ---- 创建定价引擎 ----
def pricingHandler(eventTime, name, date, npv) {
    tableInsert(pricingResultSt, eventTime, name, date, npv)
}
eCfg = dict(STRING, ANY); eCfg["numThreads"] = 1; eCfg["outputTime"] = true
pricingEngine = createPricingEngine("BOND_PRICING_ENGINE", [targetInst], pricingHandler, eCfg)

// ---- 创建市场数据引擎 ----
mktCfg = dict(STRING, ANY)
mktCfg["name"]               = "CNY_TREASURY_BOND"
mktCfg["type"]               = "BondYieldCurve"
mktCfg["bonds"]              = curveBonds
mktCfg["currency"]           = "CNY"
mktCfg["dayCountConvention"] = "ActualActualISDA"
mktCfg["compounding"]        = "Compounded"
mktCfg["interpMethod"]       = "CubicSpline"
mktCfg["extrapMethod"]       = "Flat"
mCfg = dict(STRING, ANY); mCfg["numThreads"] = 1; mCfg["outputTime"] = true
mktDataEngine = createMktDataEngine("BOND_MKTDATA_ENGINE", referenceDate, [mktCfg],
                                     handler=pricingEngine, engineConfig=mCfg)

// ---- 创建输入流表并订阅 ----
share streamTable(1:0, `type`name`price, [STRING, STRING, DOUBLE]) as bondMktDataSt
subscribeTable(tableName="bondMktDataSt", actionName="feedMktDataEngine",
               handler=mktDataEngine, msgAsTable=true, reconnect=true)

// ---- 模拟实时行情推送 ----
// 批次1：初始 YTM 报价
nameCol = bondIds
price1  = [1.55, 1.62, 1.75, 1.82, 1.90, 2.00, 2.08, 2.18, 2.35] / 100
insert into bondMktDataSt select take("Bond",9) as type, nameCol as name, price1 as price
sleep(800)
// 结果：200007.XIBE price = 139.21 (50Y 债券，票面 3.73% >> 收益率，溢价)

// 批次2：利率整体上行 10bps
price2 = price1 + 0.001
insert into bondMktDataSt select take("Bond",9) as type, nameCol as name, price2 as price
sleep(800)
// 结果：200007.XIBE price = 135.86 (利率上行，债价下跌，约 -3.35/10bps)

// 批次3：仅更新 10Y 节点
insert into bondMktDataSt values("Bond", "260005.XIBE", 2.05/100)
sleep(800)
// 结果：200007.XIBE price = 135.86 (10Y 变化对 44Y 债影响极小)

print(select * from pricingResultSt)
```

### 实测结果

| 批次 | 操作 | 200007.XIBE 价格 | 变化 |
|------|------|-----------------|------|
| 1 | 初始报价 | 139.2096 | — |
| 2 | 全线 +10bps | 135.8604 | -3.35 |
| 3 | 仅 10Y +5bps | 135.8597 | -0.0007 |

---

## 使用 appendMktData 直接定价（非流式）

```dos
// 一次性定价，不需要流表订阅
try { dropStreamEngine("PRICING_ENGINE") } catch(ex) {}

bondDict = {
    "productType": "Cash", "assetType": "Bond", "bondType": "FixedRateBond",
    "instrumentId": "240025.IB", "start": 2024.12.25, "maturity": 2031.12.25,
    "issuePrice": 100.0, "coupon": 0.0149, "frequency": "Annual",
    "dayCountConvention": "ActualActualISDA"
}
instrument = parseInstrument(bondDict)

share streamTable(1:0, `name`date`price, [STRING, DATE, DOUBLE]) as st
def myHandler(name, date, price) { tableInsert(st, name, date, price) }

engine = createPricingEngine("PRICING_ENGINE", [instrument], myHandler)
appendMktData(engine, discountCurve)   // discountCurve 是预先构建好的 MKTDATA 对象
select * from st
```

---

## 注意事项

1. **清理顺序**：先 `unsubscribeTable`，再 `dropStreamEngine`，再 `undef` 共享表
2. **sleep**：引擎异步执行，写入后需 `sleep(500+)` 再查结果
3. **Bond name 匹配**：stream table 中 `name` 列必须与 `mktCfg["bonds"]` 中各 instrument 的 `instrumentId` 完全一致
4. **多定价目标**：`createPricingEngine` 的 `instrument` 参数可以是向量 `[inst1, inst2, ...]`，每次曲线更新会触发所有目标重新定价
5. **重复 drop**：`dropStreamEngine` 必须在每次重新创建同名引擎前调用，否则报错
6. **dict 构建 config**：`{}` 字面量有时解析问题，推荐用 `dict(STRING, ANY)` 逐项赋值
