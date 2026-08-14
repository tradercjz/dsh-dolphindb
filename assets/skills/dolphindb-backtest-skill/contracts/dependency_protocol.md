# Dependency and Revision Protocol

This protocol preserves the Python pipeline's handoff and revision behavior in a standalone skill. Apply it manually by inspecting stage artifacts; do not run project Python.

## Artifact boundaries

### Datasource fields

Fields in `data` are read directly from the quotation table assembled by datasource code. Required base fields are governed by `rules/datasource_selection.md`.

### Datasource signals

Extra values packed by datasource into `msg[symbol]["signal"]` must be declared in datasource generation output:

```json
{"index": 0, "name": "signalName", "desc": "meaning"}
```

Callbacks and initialize handoff must read the signal only with:

```dos
msg[symbol]["signal"][0]
```

The `access_path` string in generated stage artifacts must exactly match the signal index.

### Initialize indicators

Values produced by `initialize` for callback use must be declared in initialize generation output:

```json
{"name": "indicatorName", "key": "indicatorKey", "expression": "summary", "access_path": "indicator[symbol][\"indicatorKey\"]"}
```

Callbacks must read the indicator only with:

```dos
indicator[symbol]["indicatorKey"]
```

### Context values

Global lookup maps, state, and strategy parameters used by callbacks must be assigned in `config["context"]` or initialized by `initialize`. Callback `context_fields` must list every context key it reads.

## Callback read rules

- Do not read undeclared `msg[symbol]["signal"][i]` values.
- Do not read undeclared `indicator[symbol]["key"]` values.
- Do not read unbound `context` keys.
- Do not perform boolean checks on whole first-level nested dictionaries such as `msg` or `indicator`.
- If market time is processed in callbacks, filter data earlier than `config["startDate"]` when applicable.

## Upstream blocking protocol

If callback generation needs an initialize indicator that is not present in `initialize_indicators`, do not invent it inside callback code and do not emit a final script. Return a callback generation artifact with:

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
        "reason": "why the callback needs this value",
        "required_by": ["onBar"]
      }
    ]
  }
}
```

Then revise in this order:

1. Re-run initialize planning with each missing indicator as a downstream requirement.
2. Re-run initialize generation and expose those indicators in `initialize_indicators`.
3. Re-run callback generation using the revised initialize handoff.
4. Assemble the final script only when callback generation reaches `completed`.

## Downstream invalidation

When an upstream artifact changes, treat all downstream artifacts as stale:

- Datasource change invalidates initialize planning, initialize generation, callback planning, callback generation, and final assembly.
- Initialize planning change invalidates initialize generation, callback generation, and final assembly.
- Initialize generation change invalidates callback generation and final assembly.
- Callback planning change invalidates callback generation and final assembly.

Record revisions in the intermediate state template so future refinement can continue from the right stage.
