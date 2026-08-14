# Pipeline Stage Contracts

These contracts mirror the stage handoff shapes used by the project pipeline, but the skill must apply them by reading this document only. Do not import or run project Python validators.

## Status semantics

- `completed`: the stage produced usable handoff artifacts.
- `need_more_info`: the stage cannot continue without user input; `question` or `reason` must explain what is missing.
- `unsupported`: datasource or asset support is not proven by bundled refs; stop final assembly.
- `blocked_by_upstream`: callback generation found missing initialize artifacts; do not assemble the final script until the upstream stage is revised.

## config complete

Allowed status: `completed`, `need_more_info`.

Before producing this artifact, read the selected asset's config definition from `refs/config_complete/<assetCategory>.jsonl`. Each line defines a field with `name`, `type`, `desc`, and `is_required`. Only required fields determine the minimum usable config; optional fields should not be actively requested unless the strategy needs them.

Required output keys:

```json
{
  "status": "completed | need_more_info",
  "config": {
    "fieldName": "fieldValue",
    "tradingLogic": {
      "buy": "1-2 sentence buy logic summary",
      "sell": "1-2 sentence sell logic summary"
    }
  },
  "missing_required_fields": [
    {"name": "fieldName", "type": "field type", "desc": "field requirement"}
  ],
  "question": "question for user, or empty string"
}
```

Rules:

- Fixed fields described by the config ref, such as `strategyGroup`, should be filled directly.
- `config.tradingLogic.buy` and `config.tradingLogic.sell` must both be clear non-empty summaries when `status=completed`.
- If buy or sell logic is missing, use `tradingLogic.buy` or `tradingLogic.sell` in `missing_required_fields`.
- If a field value violates its `desc` constraint, treat the field as missing and ask the user to correct it.
- On `completed`, `missing_required_fields` must be empty and `question` must be empty.
- On `need_more_info`, `missing_required_fields` and `question` must be non-empty.
- Asset-specific constraints live in that asset's config ref, not in the global stock rules.

## datasource table selection

Allowed status: `completed`, `unsupported`, `need_more_info`.

Required output keys:

```json
{
  "status": "completed | unsupported | need_more_info",
  "required_fields": [
    {"name": "fieldName", "desc": "why this base field is required"}
  ],
  "signal_fields": [
    {"name": "fieldName", "desc": "why this extra signal field is required"}
  ],
  "selected_tables": [
    {"db_name": "database name", "tb_name": "table name", "reason": "why selected"}
  ],
  "reason": "selection explanation or blocking reason"
}
```

Rules:

- On `completed`, `required_fields` and `selected_tables` must be non-empty.
- On non-completed status, `selected_tables` must be empty and `reason` must be explicit.

## datasource generation

Allowed status: `completed`, `unsupported`, `need_more_info`.

Required output keys:

```json
{
  "status": "completed | unsupported | need_more_info",
  "signal_schema": {
    "size": 0,
    "columns": [
      {"index": 0, "name": "signalName", "desc": "signal meaning"}
    ]
  },
  "used_functions": ["functionName"],
  "datasource_constraints": [
    {"type": "context_binding", "name": "bk_map_dict_reverse", "reason": "callback needs reverse sector mapping"}
  ],
  "script": "DolphinDB datasource script that creates data",
  "reason": "generation explanation",
  "question": "question for user, or empty string"
}
```

Rules:

- `signal_schema.size` must equal the number of `columns`.
- Signal column indexes must be zero-based and consecutive.
- `used_functions` must name only helper functions proven by bundled refs.
- `datasource_constraints` names must be unique.

## initialize planning

Allowed status: `completed`, `need_more_info`.

Required output keys:

```json
{
  "status": "completed | need_more_info",
  "reason": "planning explanation",
  "functions": [
    {"name": "functionName", "reason": "why needed"}
  ],
  "signals": [
    {"name": "signalName", "signal_index": 0, "reason": "why needed"}
  ],
  "indicator_graph": [
    {
      "name": "indicatorName",
      "reason": "why computed",
      "plan": {
        "step": 1,
        "function": "indicator function or empty string",
        "expression": "DolphinDB expression plan",
        "depends_on": [
          {"kind": "field | signal | indicator", "name": "dependencyName"}
        ],
        "reason": "dependency and computation reason"
      }
    }
  ],
  "output_indicators": ["indicatorName"],
  "question": "question for user, or empty string"
}
```

Rules:

- Dependency `kind` is only `field`, `signal`, or `indicator`.
- `signal` dependencies must exist in datasource `signal_schema`.
- `indicator` dependencies must point to another node in `indicator_graph` and must not create cycles.
- Every `output_indicators` name must exist in `indicator_graph`.
- Downstream-required initialize indicators must be included in `output_indicators`.

## initialize generation

Allowed status: `completed`, `need_more_info`.

Required output keys:

```json
{
  "status": "completed | need_more_info",
  "reason": "generation explanation",
  "context": [
    {"key": "contextKey", "value": "DolphinDB expression or literal"}
  ],
  "datasource_signals": [
    {"name": "signalName", "signal_index": 0, "access_path": "msg[symbol][\"signal\"][0]"}
  ],
  "initialize_indicators": [
    {"name": "indicatorName", "key": "indicatorKey", "expression": "expression summary", "access_path": "indicator[symbol][\"indicatorKey\"]"}
  ],
  "initialize_code": "DolphinDB initialize function code",
  "question": "question for user, or empty string"
}
```

Rules:

- Each datasource signal access path must exactly match its index.
- Each initialize indicator access path must exactly match its key.
- If initialize planning specified expected output indicators, `initialize_indicators[*].name` must match them exactly.

## callback planning

Allowed status: `completed`, `need_more_info`.

Required output keys:

```json
{
  "status": "completed | need_more_info",
  "reason": "planning explanation",
  "callbacks": [
    {"name": "onBar", "reason": "why this callback is needed"}
  ],
  "question": "question for user, or empty string"
}
```

Rules:

- Callback names must be unique.
- Do not include `initialize` in callback planning; initialize is added separately during final assembly.
- Callback names must be supported by bundled callback refs or explicitly marked as assumptions.

## callback generation

Allowed status: `completed`, `need_more_info`, `blocked_by_upstream`.

Required output keys:

```json
{
  "status": "completed | need_more_info | blocked_by_upstream",
  "reason": "generation explanation or upstream blocker",
  "callbacks": [
    {
      "name": "onBar",
      "context_fields": ["contextKey"],
      "datasource_signal_reads": [
        {"name": "signalName", "signal_index": 0, "access_path": "msg[symbol][\"signal\"][0]"}
      ],
      "initialize_indicator_reads": [
        {"name": "indicatorName", "key": "indicatorKey", "access_path": "indicator[symbol][\"indicatorKey\"]"}
      ],
      "callback_code": "DolphinDB callback function code"
    }
  ],
  "question": "question for user, or empty string",
  "dependency_gap": {
    "missing_initialize_indicators": [
      {"name": "indicatorName", "reason": "why callback needs it", "required_by": ["onBar"]}
    ]
  }
}
```

Rules:

- On `completed`, callbacks must be non-empty and each `callback_code` must define `def <callbackName>`.
- On `need_more_info`, callbacks should be empty or partial only if the question explains what is missing.
- On `blocked_by_upstream`, callbacks must be empty, `question` must be empty, and `dependency_gap.missing_initialize_indicators` must be non-empty.
