# Core Data And Access

Read this file before writing DolphinScript that constructs, reads, or mutates values. It covers the data rules that should be available by default in first-draft code.

## Inspect First

Use these when an object's form, type, or schema matters:

```dos
typestr(x)          // type name
type(x)             // type id
form(x)             // form id
schema(t).colDefs   // table columns and types
```

Common form ids:

| Form | ID |
|---|---:|
| scalar | 0 |
| vector | 1 |
| pair | 2 |
| matrix | 3 |
| set | 4 |
| dict | 5 |
| table | 6 |

## Scalars And Literals

- `3` is INT, `3l` is LONG, `3f` is FLOAT, `3F` is DOUBLE.
- `` `IBM `` and `"IBM"` are STRING scalar.
- `'C'` is CHAR scalar.
- Backtick strings cannot contain spaces. Use double or single quotes for strings with spaces.
- `` `IBM`MSFT`GOOG `` creates a STRING VECTOR. Cast to SYMBOL when the target column or API needs SYMBOL.
- Use typed nulls in typed columns: `int()`, `long()`, `double()`, `date()`, `timestamp()`.

```dos
sym = `IBM`MSFT`GOOG$SYMBOL
name = "IBM US"
emptyQty = int()
```

High-frequency temporal literals:

```dos
d = 2024.01.31
m = 2024.01M
tm = 09:30:00.000
sec = 09:30:00
dt = 2024.01.31T09:30:00
ts = 2024.01.31T09:30:00.000
```

Use [temporal-and-formatting.md](temporal-and-formatting.md) for complex parsing, formatting, and schema `format`.

## Vectors, Tuples, And Array Vectors

```dos
v1 = 3 6 1          // FAST INT VECTOR
v2 = [3,6,1]        // FAST INT VECTOR
bad = [3 6 1]       // ANY VECTOR with one element
tp = (1, 2024.01.01, `IBM)
```

Rules:

- `[3 6 1]` is not a three-element vector. Use `3 6 1` or `[3,6,1]`.
- `(1,2,3)` creates an ANY VECTOR, not a typed INT vector.
- Mixed-type space expressions create ANY VECTOR.
- Array vector elements are same-typed vectors.

```dos
av = array(INT[], 0, 10).append!([1 2 3, 4 5])
av[1]       // column-like slice
av.row(1)   // row 1
```

Do not treat array vector row access as `av[i]`; use `av.row(i)`.

## Indexing Rules

- Positional indexes start at 0.
- Pair ranges such as `a:b` exclude the end index in loops and indexing.
- `a..b` is an inclusive sequence.
- Boolean index vectors must match the source vector length.
- Integer index vectors select positions in the specified order.

```dos
x = 3 6 1 5 9
x[1]       // 6
x[x > 3]   // [6,5,9]
x[4 0 2]   // [9,3,1]
x[1:3]     // [6,1]
x[1:]      // from position 1 to end
x[:3]      // first 3 elements
```

## Matrix

```dos
m = 1..12$3:4
rows(m)
cols(m)
```

Rules:

- Matrix data fills by column.
- Iterating a matrix returns columns.
- `m[index]` reads columns.
- `m.row(index)` or `m[index,]` reads rows.
- `m[row, col]` reads a cell.
- Pair ranges exclude the end.

```dos
m[1]           // column 1 as vector
m[, 1]         // column 1 as matrix
m.row(2)       // row 2 as vector
m[1:3, 0:2]    // submatrix
```

## Pair And Set

- `a:b` creates a pair.
- Pair is used for ranges, matrix shape, table capacity and initial size.
- `set(x)` stores unique elements.

```dos
p = 1:4
s = set([5,5,3,4])
```

## Table Construction And Access

Common memory table forms:

```dos
t1 = table(1 2 3 as id, `A`B`C$SYMBOL as sym)
t2 = table(id, sym)
empty = table(100:0, `id`sym`qty, [INT, SYMBOL, INT])
```

Rules:

- `table(capacity:size, colNames, colTypes)` creates a typed table. `size=0` creates an empty table.
- Ordinary column names should start with a Chinese or English letter and then use Chinese or English letters, digits, or `_`.
- Special column names can be accessed by `t["2 ab"]` or `t."2 ab"`.
- In SQL, special column names use `_\"...\"`.
- `rows(t)` and `size(t)` return row count for a table.
- `cols(t)` returns column count.
- `schema(t).colDefs` shows column names and types.

Access:

```dos
t[`qty]
t.qty
t[0,]          // first row as table
t[0, `qty]     // one cell
t[0:2, `qty]   // one column over rows 0 and 1
t[t.qty > 10]  // filter rows
```

Remember `t[X,Y]`: rows first, columns second.

## Table Mutation

Use `update!` for contained in-place memory-table updates:

```dos
t.update!(`qty, <qty + 1>, <id <= 2>)
t.update!(`notional, <qty * price>)
```

Use `replaceColumn!` to replace values and possibly column type:

```dos
t.replaceColumn!(`sym, symbol(exec sym from t))
```

Use `addColumn` to add columns:

```dos
addColumn(t, `flag, BOOL)
t.update!(`flag, <qty > 0>)
```

Use `tableInsert` when the inserted row count matters:

```dos
inserted = tableInsert(t, 4, `D, 40, true)
tableInsert(pt, table(1 2 as id, `A`B$SYMBOL as sym))
```

For partitioned tables, batch insertion should usually pass a table object.

## Dict

```dos
d1 = dict(1 2 3, 10 20 30)
d2 = dict(INT, DOUBLE)
d3 = dict(STRING, ANY)
```

Rules:

- Keys must be scalars.
- Supported key categories include Integral, Temporal, Floating, and Literal.
- Values can use any form and type.
- Duplicate keys keep the last value.
- Ordered dictionaries preserve input key order when `ordered=true`.

Read and write:

```dos
d1[2]
d1[1 3]
keys d1
values d1

d2[1] = 7.9
d2[1] = 6.3
d2[1 2] = 9.2 8.3
erase!(d2, 1)
clear!(d2)
```

Use `dictUpdate!` for function-based updates:

```dos
d = dict(1 2 3, 1 1 1)
d.dictUpdate!(add, 2 3, 1 2)
```

For dictionary values that are vectors, local mutation does not automatically write back:

```dos
d = dict(STRING, ANY)
d[`IBM] = 1 2 3
v = d[`IBM]
v[1] = 20
d[`IBM] = v
```

For append-style updates, prefer `dictUpdate!`:

```dos
d = dict(`IBM`MSFT, [1 2, 3 4])
msg = table(`IBM`GOOG as symbol, 5 7 as ap)
d.dictUpdate!(append!, msg.symbol, msg.ap, x -> array(x.type(), 0, 128).append!(x))
```

Avoid dotted writes such as `z.2 = 5`. Use `z[2] = 5` for portable code.
