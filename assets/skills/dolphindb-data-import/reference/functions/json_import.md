# JSON Import Functions

## fromStdJson

Converts standard JSON text to DolphinDB objects.

### Conversion Rules

| JSON Type | DolphinDB Type |
|-----------|---------------|
| Object | Dictionary |
| Array | Vector |
| String | Temporal type (priority), then STRING |
| Number | DOUBLE |
| Boolean | BOOL |
| null | NULL |

## parseJsonTable

Parses JSON objects into an in-memory table.

### Syntax

```sql
parseJsonTable(json, [schema], [keyCaseSensitive=true])
```

- Supports a string containing multiple JSON objects or a string vector.
- Use `schema` to specify field types.
- `keyCaseSensitive` controls whether JSON keys are case-sensitive.

### Example

```sql
// Parse JSON array into table
jsonStr = '[{"id":1,"name":"Alice","age":30},{"id":2,"name":"Bob","age":25}]'
t = parseJsonTable(jsonStr)
```

## jsonExtract

Extracts data at a specified position from a JSON object with type conversion.

```sql
jsonExtract(json, path, resultType)
```
