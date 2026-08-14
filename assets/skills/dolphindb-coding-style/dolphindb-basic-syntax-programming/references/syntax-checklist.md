# Syntax Checklist

Use this checklist before returning DolphinScript code.

## Script Shape

- The script has explicit input/setup, computation, and final output.
- The final line returns a useful scalar, vector, table, dictionary, or verification object.
- Statements are separated by newlines or `;`.
- Parentheses `()`, brackets `[]`, braces `{}`, quotes, and metacode brackets `<...>` are balanced.
- Multi-statement branches, loops, functions, `try`, `catch`, `timer`, and `transaction` use `{}`.
- `if` and `for` have required parentheses.

## Names And Scope

- Every variable is defined before use.
- Variable names are not confused with table column names.
- DolphinDB keywords and function names use exact case.
- Any `share` or dynamic server object registration that is reused later in the same submitted script has a `go` boundary when needed.
- No invented module path, include path, local file path, DFS database path, or table name appears without being marked as an assumption.

## Functions

- Multi-statement logic uses `def name(args) { ... }`.
- Lambda expressions contain one expression only.
- Parameters that are modified inside a function are declared `mutable`.
- Default argument values are constants.
- After one default argument, all following arguments have defaults.
- No `mutable` argument has a default value.
- Function call argument order is documented by known API usage or uses keyword arguments.

## Literals And Operators

- Vectors use `1 2 3` or `[1,2,3]`, not accidental `[1 2 3]`.
- SYMBOL vectors are explicitly cast with `$SYMBOL` when target schema needs SYMBOL.
- CHAR uses single quotes only for a single character; strings use backticks or double quotes.
- Strings with spaces do not use backticks.
- Temporal literals and `temporalParse` formats match expected type, separators, and fractional precision.
- Inclusive sequences use `a..b`; pairs use `a:b`.
- Division uses `/` for integer division and `\` when fractional division is intended.
- Unary function results are parenthesized before comparison, for example `(sum(x)) == expected`.
- NULL checks use `isNull(x)` unless the false-like behavior of NULL is intended.

## Data Structures

- `typestr`, `form`, and `schema(...).colDefs` are used when the type/form is uncertain.
- Table constructors have aligned column names, column types, and vector lengths.
- Typed empty tables use `table(capacity:size, colNames, colTypes)`.
- Special column names use `t["name"]` or `t."name"` outside SQL and `_\"name\"` inside SQL.
- Matrix shapes are written as pairs such as `2:3`.
- Array vectors are read with `.row(index)` when row access is intended.
- Dictionary writes use `d[key] = value`; dotted writes are avoided.
- Dictionary vector values are assigned back after local mutation.
- Vector/table/matrix/pair indexes are zero-based.
- Pair ranges in indexing exclude the end.
- Matrix row access uses `m.row(i)` or `m[i,]`, not `m[i]`.
- Array vector row access uses `av.row(i)`, not `av[i]`.

## Tables, Import, And Databases

- `append!` between tables is only used after checking column order, because it appends by position.
- `tableInsert` arguments match target schema types and column order.
- `update!` uses metacode expressions, for example `<qty + 1>` and `<id <= 2>`.
- `select top` uses integer constants only.
- `select` output is treated as a table; `exec` is used when scalar or vector output is needed.
- SQL `delete` and broad `update` are absent unless explicitly requested.
- Metacode arguments use `<...>` for APIs such as `update!`, not quoted strings.
- `loadText` uses explicit schema when column types matter.
- `loadText` paths are server-visible paths, not unstated local client paths.
- `loadTextEx` uses empty `tableName` for memory databases and non-empty `tableName` for DFS databases.
- `loadTable` is used for DFS or local disk databases, not as the default way to read in-memory database tables.
- `createPartitionedTable` is followed by explicit insertion when data rows are needed.
- `createTable` is not used for in-memory database examples.
- Existing server state is probed with `existsDatabase`, `existsTable`, `getClusterDFSDatabases`, `getClusterDFSTables`, or `getDFSTablesByDatabase` before reads or writes.

## Safety

- The code does not include `dropDatabase`, `dropTable`, broad `delete`, or broad `update` unless the user explicitly asked for it and the target path/table is named.
- External files, DFS paths, and table names are either supplied by the user or clearly listed as assumptions.
- Expected failures are isolated into separate negative scripts, not mixed into the main runnable script.
- `timer` output is treated as stdout, not as a returned value.
- `transaction` is only used for supported table SQL operations, not arbitrary script rollback.
- If a DolphinDB executor, compile probe, or syntax probe is available, the script has been verified; otherwise the response states that it was not verified.

## Routing

- If the task is mainly SQL semantics, joins, grouping, context windows, or query tuning, also use `dolphindb-sql-programming`.
- If the task is mainly higher-order functions, function views, modules, or partial application, also use `dolphindb-functional-programming`.
- If the task is mainly performance, batch execution, loops-to-vectorization, or matrix/vector rewrite, also use `dolphindb-vectorization-programming`.
