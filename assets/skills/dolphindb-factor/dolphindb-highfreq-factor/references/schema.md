# Reference Data Schema — High-Frequency Tables

These schemas document the **field names and types** from common high-frequency data tables. They are for **reference only** — always probe the user's actual cluster to confirm what tables and fields exist. Do NOT use these to create tables.

---

## Level2 Snapshot (`dfs://Level2` / `snapshot`)

Partition columns: `TradeDate`, `SecurityID`

| Column | Type | Meaning |
|--------|------|---------|
| `Market` | SYMBOL | Market |
| `TradeDate` | DATE | Trading date (partition) |
| `TradeTime` | TIME | Trading time |
| `MDStreamID` | SYMBOL | Market data stream ID |
| `SecurityID` | SYMBOL | Stock code (partition) |
| `SecurityIDSource` | SYMBOL | Security ID source |
| `TradingPhaseCode` | SYMBOL | Trading phase code |
| `ImageStatus` | INT | Image status |
| `PreCloPrice` | DOUBLE | Previous close |
| `NumTrades` | LONG | Number of trades |
| `TotalVolumeTrade` | LONG | Total volume traded |
| `TotalValueTrade` | DOUBLE | Total value traded |
| `LastPrice` | DOUBLE | Last price |
| `OpenPrice` | DOUBLE | Open price |
| `HighPrice` | DOUBLE | High price |
| `LowPrice` | DOUBLE | Low price |
| `ClosePrice` | DOUBLE | Close price |
| `UpLimitPx` | DOUBLE | Upper limit price |
| `DownLimitPx` | DOUBLE | Lower limit price |
| `BidPrice` | DOUBLE[] | Bid prices (10 levels) |
| `OfferPrice` | DOUBLE[] | Offer prices (10 levels) |
| `BidOrderQty` | LONG[] | Bid order quantities (10 levels) |
| `OfferOrderQty` | LONG[] | Offer order quantities (10 levels) |
| `BidNumOrders` | INT[] | Number of bid orders (10 levels) |
| `OfferNumOrders` | INT[] | Number of offer orders (10 levels) |
| `TotalBidQty` | LONG | Total bid quantity |
| `WeightedAvgBidPx` | DOUBLE | Weighted average bid price |
| `TotalOfferQty` | LONG | Total offer quantity |
| `WeightedAvgOfferPx` | DOUBLE | Weighted average offer price |
| `WithdrawBuyNumber` | INT | Withdraw buy number |
| `WithdrawBuyAmount` | LONG | Withdraw buy amount |
| `WithdrawBuyMoney` | DOUBLE | Withdraw buy money |
| `WithdrawSellNumber` | INT | Withdraw sell number |
| `WithdrawSellAmount` | LONG | Withdraw sell amount |
| `WithdrawSellMoney` | DOUBLE | Withdraw sell money |

Key computation fields:
- Price: `LastPrice`, `OpenPrice`, `HighPrice`, `LowPrice`, `ClosePrice`, `PreCloPrice`, `BidPrice`, `OfferPrice`
- Volume/Amount: `TotalVolumeTrade`, `TotalValueTrade`, `NumTrades`, `BidOrderQty`, `OfferOrderQty`
- Order book: `BidPrice`, `OfferPrice`, `BidOrderQty`, `OfferOrderQty`, `BidNumOrders`, `OfferNumOrders`

---

## Level2 Entrust (`dfs://Level2` / `entrust`)

Partition columns: `TradeDate`, `SecurityID`

| Column | Type | Meaning |
|--------|------|---------|
| `ChannelNo` | INT | Channel number |
| `ApplSeqNum` | LONG | Application sequence number |
| `MDStreamID` | SYMBOL | Market data stream ID |
| `SecurityID` | SYMBOL | Stock code (partition) |
| `SecurityIDSource` | SYMBOL | Security ID source |
| `Price` | DOUBLE | Order price |
| `OrderQty` | LONG | Order quantity |
| `Side` | SYMBOL | Side (buy/sell) |
| `TradeDate` | DATE | Trading date (partition) |
| `TradeTime` | TIME | Trading time |
| `OrderType` | SYMBOL | Order type |
| `OrderNO` | LONG | Order number |
| `DataStatus` | INT | Data status |
| `BizIndex` | LONG | Business index |
| `Market` | SYMBOL | Market |

Key computation fields:
- Order: `Price`, `OrderQty`, `Side`, `OrderType`

---

## Level2 Trade (`dfs://Level2` / `trade`)

Partition columns: `TradeDate`, `SecurityID`

| Column | Type | Meaning |
|--------|------|---------|
| `ChannelNo` | INT | Channel number |
| `ApplSeqNum` | LONG | Application sequence number |
| `MDStreamID` | SYMBOL | Market data stream ID |
| `BidApplSeqNum` | LONG | Bid application sequence number |
| `OfferApplSeqNum` | LONG | Offer application sequence number |
| `SecurityID` | SYMBOL | Stock code (partition) |
| `SecurityIDSource` | SYMBOL | Security ID source |
| `TradePrice` | DOUBLE | Trade price |
| `TradeQty` | LONG | Trade quantity |
| `ExecType` | SYMBOL | Execution type |
| `TradeDate` | DATE | Trading date (partition) |
| `TradeTime` | TIME | Trading time |
| `TradeMoney` | DOUBLE | Trade money (amount) |
| `TradeBSFlag` | SYMBOL | Trade buy/sell flag |
| `BizIndex` | LONG | Business index |
| `OrderKind` | SYMBOL | Order kind |
| `Market` | SYMBOL | Market |

Key computation fields:
- Trade: `TradePrice`, `TradeQty`, `TradeMoney`, `TradeBSFlag`, `ExecType`

---

## Minute K-Line (`dfs://stockMinKSH` / `stockMinKSH`)

Partition column: `DateTime`

| Column | Type | Meaning |
|--------|------|---------|
| `SecurityID` | SYMBOL | Stock code |
| `DateTime` | TIMESTAMP | Date time (partition) |
| `PreClosePx` | DOUBLE | Previous close |
| `OpenPx` | DOUBLE | Open price |
| `HighPx` | DOUBLE | High price |
| `LowPx` | DOUBLE | Low price |
| `LastPx` | DOUBLE | Last price |
| `Volume` | LONG | Volume |
| `Amount` | DOUBLE | Amount |
| `IOPV` | DOUBLE | IOPV |

Key computation fields:
- Price: `OpenPx`, `HighPx`, `LowPx`, `LastPx`, `PreClosePx`
- Volume/Amount: `Volume`, `Amount`
- Time: `DateTime` — use `date(DateTime)` for TradeDate, `time(DateTime)` for TradeTime

---

## Factor Day Table (`dfs://factor_day` / `factor_day`)

Partition columns: `TradeDate`, `FactorName`

| Column | Type | Meaning |
|--------|------|---------|
| `SecurityID` | SYMBOL | Stock code |
| `TradeDate` | DATE | Trading date (partition) |
| `Value` | DOUBLE | Factor value |
| `FactorName` | SYMBOL | Factor name (partition) |
| `UpdateTime` | TIMESTAMP | Update timestamp |
