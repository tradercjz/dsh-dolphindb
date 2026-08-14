# Core Syntax

Use this reference when writing or fixing DolphinDB / DolphinScript code before considering SQL optimization, functional style, or vectorization.

## File And Statement Basics

- DolphinScript is case-sensitive. Variable names, function names, class names, and keywords must match exact case.
- Separate statements by newline or `;`. Use `;` for multiple statements on one line.
- Comments use `// line comment` and `/* block comment */`.
- Use `{}` for statement blocks. Do not rely on indentation.
- Use `go` when a later statement refers to a name dynamically registered earlier in the same submitted script, such as after `share`, `run`, `runScript`, or `undef`. `go` cannot appear inside functions, loops, or conditionals.
- Use `assert expr` or `assert "case", expr` for script checks.
- `timer { ... }` and `timer(n) { ... }` print server-side elapsed time to stdout. They do not return a timing value.

## Assignment

- `x = y` binds or assigns by value for ordinary vectors. Changing `x` after `x = y` does not mutate `y`.
- `&x = y` makes `x` reference the same object as `y`. Later in-place changes through `x` can affect `y`.
- `const x = value` declares a constant.
- Release a variable with `x = NULL` or `undef("x")`.
- Multi-assignment can receive multiple return values, matrix columns, and table rows.

```dos
x = 1 2 3
y = x
y[0] = 9        // x is unchanged

&z = x
z[0] = 8        // x is changed

m = 1..6$2:3
a, b, c = m     // a, b, c are matrix columns

t = table(1 2 as id, `A`B as sym)
r1, r2 = t      // r1, r2 are row dictionaries
```

## Functions

- Named function:

```dos
def addQty(qty, delta) {
    return qty + delta
}
```

- Single-statement function:

```dos
def addOne(x): x + 1
```

- Lambda has one expression only:

```dos
square = x -> x * x
(1..3).{x -> x * x}()
```

- Function parameters are passed by reference, but are immutable unless declared `mutable`.
- Use `mutable` only when the function intentionally changes the caller's object.
- Default argument values must be constants. Once one argument has a default value, all following arguments must have defaults.
- `mutable` arguments cannot have defaults.
- `defg` creates a user aggregate function and returns scalar form.

```dos
def incFirst(mutable v) {
    v[0] += 1
}
```

## Function Calls

DolphinDB supports several call forms:

```dos
sum(x)
x.sum()
sum x

add(x, y)
x.add(y)
x add y
```

For multi-argument calls, once one argument uses a keyword, following arguments should also use keywords.

```dos
def f(a=1, b=2): a + b
f(, 3)
f(b=3, a=2)
```

## Operators

- `a..b` is an inclusive sequence.
- `a:b` is a pair, not a sequence. In indexing and `for` ranges, the upper bound is not included.
- Integer `/` is integer division. Use `\` for ratio division.
- `&&` and `||` work on scalars, pairs, vectors, and matrices; vectors and matrices are processed elementwise.
- Parenthesize unary function results before comparison. `sum 1 2 3 == 6` is parsed as `sum(1 2 3 == 6)`, not `(sum(1 2 3)) == 6`.

```dos
sum(1..3)              // 6
form(1:3)              // pair form
5 / 2                  // 2
5 \ 2                  // 2.5
(sum(1 2 3)) == 6      // true
```

## Control Flow

- `if` and `for` require parentheses.
- Use `{}` for multi-statement branches or loop bodies.
- `if(NULL)` and `if(!NULL)` both behave as false.
- `for(s in 1:4)` visits `1, 2, 3`; the upper bound is excluded.
- `for` over a matrix returns columns.
- `for` over a table returns row dictionaries.
- `do { ... } while(condition)` runs at least once. `NULL` and `!NULL` conditions behave as false.
- `break` exits one loop. `continue` skips the remaining statements in the current iteration.
- `try { ... } catch(ex) { ... }` captures an exception object. In the verified runtime, `typestr(ex)` was `STRING PAIR`.

```dos
if(isNull(x)) {
    x = 0
} else {
    x += 1
}

total = 0
for(i in 1:4) {
    total += i
}

try {
    1 / 0
} catch(ex) {
    err = string(ex)
}
```

## NULL

- `NULL` has type `VOID`.
- Typed null values include `int()`, `double()`, `date()`, and similar constructor calls.
- `NULL == NULL` is true.
- `!NULL == NULL` is also true.
- `NULL != NULL` is false.
- `isNull(x)` is the preferred null check. It preserves the shape of the input.
- Comparisons treat NULL as the minimum value by default.
- Common aggregate functions usually ignore NULL.
- Ascending sort places NULL first; descending sort places NULL last.

## Modules And Includes

- A module file starts with `module namespace::name` on the first line.
- A module file should contain function definitions.
- Use `use namespace::name` to load a module.
- `#include "path"` imports a server-side script file and cannot be used from the command line.
- Do not invent server file paths. Ask for or inspect the real path first.
