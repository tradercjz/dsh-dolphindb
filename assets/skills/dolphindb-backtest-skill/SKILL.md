---
name: dolphindb-backtest-skill
description: Generate, review, or refine standalone DolphinDB backtest .dos scripts from natural-language quant strategy requirements, using bundled datasource, initialize, callback refs, contracts, manifests, rules, and templates;
---

# DolphinDB Backtest Skill

Use this skill when the user wants to generate, review, or refine a standalone DolphinDB backtest script from a natural-language quantitative strategy.

## Hard boundaries

- Do not depend on absolute paths from the original repository.
- Use only files under `${SKILL_DIR}` as bundled skill resources.
- Generate reviewable DolphinDB `.dos` code; do not claim the script was executed unless it actually was.
- Do not invent DolphinDB tables, fields, callback APIs, helper functions, or sector standards. If bundled refs do not prove something exists, mark it as an assumption or ask the user.

## Resource layout

Before generating code, inspect relevant bundled resources when available:

- `manifests/stages.json` — stage order and required resource map.
- `manifests/assets.json` — supported assets and asset-level defaults.
- `manifests/datatypes.json` — dataType meanings and refs mapping.
- `manifests/callback_registry.json` — callback availability by asset and dataType.
- `contracts/pipeline_contracts.md` — stage output shapes and status semantics.
- `contracts/dependency_protocol.md` — datasource/initialize/callback handoff and revision protocol.
- `contracts/assembly_order.md` — final script assembly order and blockers.
- `rules/dolphindb_syntax.md` — DolphinDB syntax and portability rules.
- `rules/datasource_selection.md` — datasource field, signal, dataType, and sector rotation rules.
- `refs/config_complete` — per-asset configuration field definitions copied from the pipeline's config-complete refs.
- `refs/datasource` — datasource table metadata and helper function refs.
- `refs/initialize` — initialize specs, indicator docs, market data fields, and interface refs.
- `refs/callback` — callback specs, callback interfaces, and helper function refs.
- `templates/strategy_requirements.md` — strategy requirement extraction template.
- `templates/pipeline_stage_outputs.md` — stage artifact templates.
- `templates/intermediate_state.md` — conversation-local continuation state template.
- `templates/final_script_skeleton.dos` — final script assembly skeleton.
- `templates/review_checklist.md` — post-generation review checklist.

If a required resource is missing, continue only with explicit assumptions; do not require Python.

## Workflow

### 1. Normalize requirements

Use the strategy requirement template plus asset, dataType, and per-asset config refs to extract or assume:

- Asset type and account type.
- Data frequency and `dataType` preference.
- Symbol universe.
- Backtest start and end date.
- Initial capital, commission, slippage, and matching assumptions.
- Buy logic.
- Sell logic.
- Rebalance frequency.
- Risk controls.
- Required output indicators.
- Any dependency on index, sector, industry, fundamentals, factors, or custom signals.

Read `refs/config_complete/<assetCategory>.jsonl` for the selected asset before deciding which config fields are required. If fields are missing, prefer reasonable assumptions and list them under “假设与待确认项”. Ask the user only when missing information changes the core strategy semantics or a required config field cannot be determined.

### 2. Produce stage artifacts using contracts

Follow `manifests/stages.json` for stage order. For every stage you reason through, keep the artifact shape aligned with `contracts/pipeline_contracts.md`.

At minimum, preserve these handoff concepts:

- `config` and `missing_required_fields` from config completion.
- `signal_schema` from datasource generation.
- `datasource_constraints` from datasource generation.
- `datasource_signals` from initialize generation.
- `initialize_indicators` from initialize generation.
- `context_fields`, `datasource_signal_reads`, and `initialize_indicator_reads` from callback generation.
- `dependency_gap` when callbacks are blocked by missing initialize indicators.

Use `templates/pipeline_stage_outputs.md` when a reviewable intermediate artifact is useful.

### 3. Resolve dependencies before assembly

Apply `contracts/dependency_protocol.md`:

- Callback reads of `msg[symbol]["signal"][i]` must be declared by datasource `signal_schema`.
- Callback reads of `indicator[symbol]["key"]` must be declared by initialize `initialize_indicators`.
- Callback reads of `context` keys must be bound in `config["context"]` or initialized before use.
- If callback generation needs a missing initialize indicator, return `blocked_by_upstream` with `dependency_gap.missing_initialize_indicators`; then revise initialize planning and generation before regenerating callbacks.

Do not assemble a final script while any stage is `need_more_info`, `unsupported`, or `blocked_by_upstream`.

### 4. Assemble final script

Use `contracts/assembly_order.md` and `templates/final_script_skeleton.dos`.

Final script sections must appear in this order:

1. Helper functions used by datasource.
2. Datasource query and transformation script.
3. `config = dict(STRING, ANY)` assignments.
4. `config["context"]` bindings.
5. `initialize` function.
6. Callback functions.
7. Callback dictionary.
8. Backtest engine creation.
9. `Backtest::appendQuotationMsg(engine, data)`.
10. `Backtest::appendEndMarker(engine)`.
11. `Backtest::getReturnSummary(engine)`.

If datasource uses a helper such as `gen_bk_singal` and exposes `bk_map_dict_reverse`, bind it through `config["context"]` before callbacks run.

### 5. Maintain continuation state when useful

For multi-turn refinement, use `templates/intermediate_state.md` to keep a compact state summary in the conversation. This replaces Python `PipelineState` for skill runtime use.

## Required response format

When generating a script, respond with:

````markdown
## 策略理解

## 假设与待确认项

## 配置摘要

## 数据源选择

## Initialize / Callback 依赖

## DolphinDB 回测脚本

```dos
...
```

## 自检结果

## 使用说明
````

If the user asks to save the script to a file, write only after confirming the desired path unless the path is already specified.

## Self-check before final answer

Use `templates/review_checklist.md` and verify:

- Every table and field is supported by refs or explicitly marked as an assumption.
- Every callback-read `signal` index is defined by datasource `signal_schema`.
- Every callback-read indicator is produced in `initialize_indicators`.
- Every callback-read context key is bound or initialized.
- `blocked_by_upstream` gaps are resolved before final script assembly.
- The final script follows `contracts/assembly_order.md`.
- No Python runtime, uv command, FastAPI server, OpenAI SDK, or project import is required.
