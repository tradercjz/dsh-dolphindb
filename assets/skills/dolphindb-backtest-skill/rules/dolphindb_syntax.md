# DolphinDB Syntax Rules

Follow these rules for every generated DolphinDB script.

1. Do not use highly abstract functions or DolphinDB functions that are not documented in bundled refs or common DolphinDB syntax.
2. Boolean conditions must be scalar expressions.
3. Do not use `isNull` for dictionary or vector non-empty checks, use `size(value) != 0`.
4. For non-table null checks, use `isNull(value).any()`.
5. For table non-empty checks, use `count(table) != 0`.
6. LONG literals use the `l` suffix, for example `100l`.
7. Create empty vectors with `array(TYPE, 0)`.
8. Do not use `while {}` loops; use `do { ... } while (bool_expression)` if a loop is necessary.
9. `for` syntax is `for (expression) { loop_body }`.
10. Do not use `concat` to concatenate numeric vectors.
11. Do not use `replace` for substring replacement, use `strReplace(str, oldSubstr, newSubstr)` instead(e.g., `.SH` → `.XSHG`).`replace` does whole-string exact match only; `strReplace` does substring replacement.
12. Use `.XSHG` for Shanghai symbols and `.XSHE` for Shenzhen symbols.
13. Callback code must not perform boolean checks on entire first-level nested dictionaries such as `msg` or `indicator`.
14. Callbacks that process market time should filter data earlier than `config["startDate"]` when applicable.
15. Do not mix Python, pandas, JavaScript, SQLAlchemy, or shell syntax into DolphinDB scripts.
16. Do not include code that calls this repository's Python runtime, HTTP API, or LLM client.
