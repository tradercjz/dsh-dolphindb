# Common Errors

Use this reference when fixing generated DolphinScript or reviewing first-draft code.

## Language Leakage

- Do not use Python list/dict syntax as DolphinDB syntax. Use `1 2 3`, `[1,2,3]`, `dict(keys, values)`, and `table(...)`.
- Do not use standard SQL DDL or Python file APIs. Use DolphinDB `database`, `createPartitionedTable`, `loadText`, `loadTextEx`, and `saveText` patterns.
- Do not assume local OS paths are visible to the DolphinDB server. Server-side functions read server paths.

## Assignment And Mutability

- `y = x` copies ordinary vectors. If code expects shared mutation, use `&y = x`.
- Function parameters cannot be modified unless declared `mutable`.

```dos
def bad(a) {
    a[0] = 9       // compile error: constant variable cannot be modified
}

def ok(mutable a) {
    a[0] = 9
}
```

- Mutating a vector fetched from a dictionary does not automatically write it back:

```dos
v = d[key]
v[1] = newValue
d[key] = v
```

## Literals And Data Forms

- `[3 6 1]` is an ANY VECTOR with one vector element. Use `3 6 1` or `[3,6,1]` for a three-element INT vector.
- `(1,2,3)` is an ANY VECTOR, not a typed INT vector.
- `` `IBM`MS`GOOG `` is a STRING VECTOR. Cast with `$SYMBOL` when a SYMBOL vector is required.
- `` `C `` and `"C"` are STRING. `'C'` is CHAR.
- Backtick strings cannot contain spaces. Use quotes for strings with spaces.
- Temporal parsing formats must match separators and fractional precision. `SSS` requires exactly three digits, `nnnnnn` six, and `nnnnnnnnn` nine.
- `a:b` is a pair, not an inclusive sequence. Use `a..b` for an inclusive sequence.
- Integer `/` is integer division. Use `\` for ratio division.

## Function And Operator Parsing

- Lambda has one expression only. Use `def f(...) { ... }` for multi-statement logic.
- Parenthesize unary function results before comparison:

```dos
(sum(1 2 3)) == 6
```

Do not write `sum 1 2 3 == 6` when you mean to compare the sum.

- When one argument uses a keyword in a multi-argument call, following arguments should also use keywords.
- Default argument values must be constants. After one default argument, all following arguments need defaults.
- `mutable` parameters cannot have default values.

## Control Flow

- `if` and `for` require parentheses.
- Use `{}` for multi-statement branches or loop bodies.
- `if(NULL)` and `if(!NULL)` both behave as false. Use `isNull(x)` when testing nulls.
- `do { ... } while(condition)` runs at least once, even when the condition is false or NULL.
- `for(i in 1:4)` visits `1`, `2`, and `3`; the upper bound is excluded.
- Iterating a matrix returns columns; iterating a table returns row dictionaries.

## NULL

- `NULL == NULL` is true, `!NULL == NULL` is true, and `NULL != NULL` is false.
- Aggregates commonly ignore NULL values.
- Comparisons treat NULL as the minimum value by default.
- Ascending sort places NULL first; descending sort places NULL last.

## Table And SQL

- `select` always returns a table. Use `exec` for scalar or vector output.
- `exec` returns a table when selecting multiple columns.
- Special column names in SQL require `_\"...\"`. Outside SQL, use `t["col name"]` or `t."col name"`.
- `append!` appends tables by column position, not by matching column names. Align column order before appending.
- `tableInsert` is type-sensitive. Check `schema(t).colDefs` before inserting strings, symbols, temporal values, or mixed numeric types.
- `update!` uses metacode expressions:

```dos
t.update!(`qty, <qty + 1>, <id <= 2>)
```

- `select top n * from t` requires integer constants. Variables and expressions such as `top n` or `top (1+2)` fail.
- `top a:b` uses a zero-based range and excludes the end index.
- Table multi-assignment reads rows as row dictionaries, not columns.
- `delete from t` without `where` deletes all rows. Do not generate it as example cleanup.
- SQL `update` cannot change an existing column type. Use `replaceColumn!` for memory table column type replacement.

## Indexing And Access

- Positional indexes start at 0.
- Pair ranges exclude the end index in vector, matrix, table, and `top` range access.
- `m[index]` reads matrix columns. Use `m.row(index)` or `m[index,]` for rows.
- Array vector `av[index]` reads a column-like slice. Use `av.row(index)` for row access.
- Boolean vector indexes must match the source vector length.
- Table object access `t[X,Y]` uses rows first and columns second.
- `@` / `eachAt` is valid but less clear than `x[index]` for first-draft code; parenthesize low-precedence expressions such as `sum @ (1..10)`.

## Dict

- Dictionary keys must be scalars.
- Use `d[key] = value` for portable writes.
- Avoid dotted writes such as `d.2 = 5`: one verified runtime accepted it, but official docs reject it.
- Use `dictUpdate!` when updating existing vector values or creating missing keys with an init function.
- Use `erase!(d, keys)` for deletion and `clear!(d)` to empty a dictionary.

## Array Vector

- Array vectors and tuples can print similarly. Check `typestr(x)`.
- `av[index]` reads a column-like slice; use `av.row(index)` to read one row.

## Database And Table APIs

- `createPartitionedTable` creates an empty table from schema. It does not copy source rows.
- Insert into a partitioned table after creation using `tableInsert(pt, data)` or another explicit write.
- `loadTable` is for DFS or local disk databases. Do not use it as the generic way to read an in-memory database table.
- `createTable` failed against an in-memory database in the verified runtime with `dbHandle must be a dfs database handle`; use it only for DFS table creation examples.
- `getTables(db)` is not reliable as an in-memory database table inventory in the verified runtime.
- Do not emit `dropDatabase` from examples unless the user explicitly asks for destructive cleanup.

## LoadText And Import

- `loadText` type inference is sample-based. Prefer explicit schema or inspect with `extractTextSchema`.
- Time columns with custom formats need `schema.format`.
- When loading selected columns using `schema.col`, indexes must be sorted.
- For memory databases, `loadTextEx` uses empty `tableName` or omits it. For DFS databases, `tableName` must be non-empty.
- `transform` for `loadTextEx` must be a unary function that accepts a table.

## Statements

- `timer { ... }` and `timer(n) { ... }` print elapsed time to stdout. They do not return a timing value.
- `transaction { ... }` should only be used for SQL operations against one mvccTable, shared memory table, or OLTP table. Do not wrap arbitrary script blocks and assume database-like transaction behavior.
- Use `go` after `share`, `run`, `runScript`, or `undef` when later statements in the same submitted script refer to names registered dynamically.
