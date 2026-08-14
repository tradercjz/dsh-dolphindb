# Final Assembly Order

Assemble a final DolphinDB `.dos` script only when datasource generation, initialize generation, and callback generation all have `status=completed` and no dependency gap remains.

## Required order

1. Helper function bodies used by datasource.
   - For each `datasource_result.used_functions`, include the corresponding bundled helper function `body` before datasource code.
   - Do not include helper functions that are not used.
2. Datasource script.
   - Must create `data` for `Backtest::appendQuotationMsg(engine, data)`.
   - For `strategyGroup=securityCreditAccount`, must also create `securityReference` using bundled datasource helper refs before engine creation.
3. Config dictionary.
   - Start with `config = dict(STRING, ANY)`.
   - Render scalar/list config values as DolphinDB values.
   - Render date strings for `startDate` and `endDate` as DolphinDB date expressions, not quoted strings, when already normalized that way.
4. Context bindings.
   - Always define `config["context"] = dict(STRING, ANY)`.
   - Bind global variables required by callbacks under `config["context"]`.
5. `initialize` function code from initialize generation.
6. Callback function code from callback generation.
7. Callback dictionary.
   - `callbacks = dict(STRING, ANY)`.
   - `callbacks["initialize"] = initialize`.
   - Add each generated callback by name.
8. Backtest engine creation.
   - Define `engine_name`.
   - Drop existing engine with the same name when present.
   - Use `Backtest::createBacktester(engine_name, config, callbacks)` for normal stock strategies.
   - Use `Backtest::createBacktester(engine_name, config, callbacks, false, securityReference)` for `strategyGroup=securityCreditAccount`.
9. Run backtest.
   - `Backtest::appendQuotationMsg(engine, data)`.
   - `Backtest::appendEndMarker(engine)`.
10. Return summary.
   - `Backtest::getReturnSummary(engine)`.

## Context binding conventions

If datasource generation uses `gen_bk_singal`, the datasource script is expected to provide `bk_map_dict_reverse`. Bind it before callbacks run:

```dos
config["context"]["bk_map_dict_reverse"] = bk_map_dict_reverse
```

If callback code reads any context key, either bind it in config context or initialize it in `initialize`; otherwise treat the callback artifact as invalid.

## Assembly blockers

Do not assemble the final script if any condition is true:

- A stage has `status=need_more_info`, `unsupported`, or `blocked_by_upstream`.
- Callback `dependency_gap.missing_initialize_indicators` is non-empty.
- Any callback signal read is absent from datasource `signal_schema`.
- Any callback initialize indicator read is absent from initialize `initialize_indicators`.
- Any callback context field is neither bound in config context nor initialized by initialize code.
- A used helper function body is not available in bundled refs.
- `strategyGroup=securityCreditAccount` but `securityReference` is not generated before engine creation.
