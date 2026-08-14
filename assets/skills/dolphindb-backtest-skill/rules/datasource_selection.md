# Datasource Selection Rules

Use the smallest bundled datasource and helper function set that satisfies the strategy.

## Required base fields

The final `data` table for backtest quotation insertion must contain:

- `symbol`
- `tradeTime`
- `open`
- `low`
- `high`
- `close`
- `volume`
- `amount`
- `upLimitPrice`
- `downLimitPrice`
- `prevClosePrice`

## Signal fields

Add extra datasource `signal` fields only when the strategy explicitly requires raw fields or labels that cannot be derived from base fields or initialize indicators.

Every extra signal must be declared in datasource generation `signal_schema.columns` with a zero-based `index`, `name`, and `desc`.

## dataType semantics

- `dataType=3`: minute K-line data.
- `dataType=4`: daily K-line data.

Use `manifests/datatypes.json` to find the relevant bundled refs for the selected asset and dataType.

## Stock conventions

- Convert stock symbols to `.XSHG` for Shanghai and `.XSHE` for Shenzhen before feeding the backtest engine.
- Preserve `symbol`, `tradeTime`, OHLCV, amount, limit prices, and previous close fields in the final `data` table.
- Handle forward-adjusted prices when the strategy or selected refs require adjusted price semantics.

## Sector rotation constraints

For stock sector or industry rotation, use only classification methods proven by the selected datasource helper refs. Do not put a sector classification limit at the asset level.

When using sector rotation helper resources such as `gen_bk_singal`:

- Follow the classification scope documented in that helper ref.
- Keep generated sector label signals in datasource `signal_schema`.
- Preserve datasource constraints such as `bk_map_dict_reverse`.
- Make required constraints available through `config["context"]` during final assembly.

## Unsupported data

Do not invent databases, tables, fields, helper functions, sector standards, or raw signal fields. If bundled refs do not prove an item exists, either ask the user or list it under assumptions and avoid claiming it is verified.
