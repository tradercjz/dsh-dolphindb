# Pipeline Stage Output Templates

Use these templates when you need reviewable intermediate artifacts. They are conversation artifacts, not files to write during normal script generation.

## Config complete

```json
{
  "status": "completed",
  "config": {
    "strategyGroup": "stock",
    "startDate": "YYYY.MM.DD",
    "endDate": "YYYY.MM.DD",
    "cash": 1000000,
    "dataType": 4,
    "tradingLogic": {
      "buy": "...",
      "sell": "..."
    }
  },
  "missing_required_fields": [],
  "question": ""
}
```

## Datasource table selection

```json
{
  "status": "completed",
  "required_fields": [
    {"name": "symbol", "desc": "证券代码"}
  ],
  "signal_fields": [],
  "selected_tables": [
    {"db_name": "...", "tb_name": "...", "reason": "..."}
  ],
  "reason": "..."
}
```

## Datasource generation

```json
{
  "status": "completed",
  "signal_schema": {
    "size": 0,
    "columns": []
  },
  "used_functions": [],
  "datasource_constraints": [],
  "script": "...",
  "reason": "...",
  "question": ""
}
```

## Initialize planning

```json
{
  "status": "completed",
  "reason": "...",
  "functions": [],
  "signals": [],
  "indicator_graph": [],
  "output_indicators": [],
  "question": ""
}
```

## Initialize generation

```json
{
  "status": "completed",
  "reason": "...",
  "context": [],
  "datasource_signals": [],
  "initialize_indicators": [],
  "initialize_code": "...",
  "question": ""
}
```

## Callback planning

```json
{
  "status": "completed",
  "reason": "...",
  "callbacks": [
    {"name": "onBar", "reason": "K-line strategy logic runs on each bar"}
  ],
  "question": ""
}
```

## Callback generation: completed

```json
{
  "status": "completed",
  "reason": "...",
  "callbacks": [
    {
      "name": "onBar",
      "context_fields": [],
      "datasource_signal_reads": [],
      "initialize_indicator_reads": [],
      "callback_code": "def onBar(mutable context, msg, indicator){\n    ...\n}"
    }
  ],
  "question": "",
  "dependency_gap": {
    "missing_initialize_indicators": []
  }
}
```

## Callback generation: blocked_by_upstream

```json
{
  "status": "blocked_by_upstream",
  "reason": "callback needs missing initialize indicators",
  "callbacks": [],
  "question": "",
  "dependency_gap": {
    "missing_initialize_indicators": [
      {
        "name": "indicatorName",
        "reason": "why it is needed",
        "required_by": ["onBar"]
      }
    ]
  }
}
```
