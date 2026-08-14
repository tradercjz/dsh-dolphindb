# Temporal And Formatting

Read this file when code needs complex temporal parsing, formatting, import schemas, or integer-to-time conversion.

## Temporal Types

| Type | Example |
|---|---|
| DATE | `2013.06.13` |
| MONTH | `2012.06M` |
| TIME | `13:30:10.008` |
| MINUTE | `13:30m` |
| SECOND | `13:30:10` |
| DATETIME | `2012.06.13 13:30:10` or `2012.06.13T13:30:10` |
| TIMESTAMP | `2012.06.13 13:30:10.008` or `2012.06.13T13:30:10.008` |
| NANOTIME | `09:00:01.000100001` |
| NANOTIMESTAMP | `2016.12.30T09:00:01.000100001` |

Use constructors for conversion:

```dos
month(2016.02.14)
date(2012.06.13T13:30:10)
second(2012.06.13T13:30:10)
timestamp(2012.06.13T13:30:10)
```

## Parse And Format

Use `temporalParse(text, format)` for strings and `temporalFormat(value, format)` or `.format(format)` for temporal values.

```dos
d = temporalParse("20180214", "yyyyMMdd")
ts = temporalParse("2018/2/6 13:30:10.001", "y/M/d H:m:s.SSS")
out = ts.temporalFormat("yyyy.MM.dd HH:mm:ss.SSS")
```

Format symbols:

- `yyyy` or `yy` for year. With `yy`, `00-39` maps to `2000-2039`, `40-99` maps to `1940-1999`.
- `MM` for month number, `MMM` for month name such as `JAN`.
- `dd` for day.
- `HH` for 24-hour clock, `hh` for 12-hour clock, `aa` for AM/PM.
- `mm` for minute, `ss` for second.
- `SSS` for millisecond.
- `nnnnnn` for microsecond.
- `nnnnnnnnn` for nanosecond.

Rules:

- Separators in the format must match separators in the input string.
- Single-letter simplifications such as `y/M/d` are allowed for year/month/day/hour/minute/second.
- `MMM`, `SSS`, `nnnnnn`, and `nnnnnnnnn` cannot be reduced to single letters.
- Millisecond digits must be exactly 3 for `SSS`.
- Microsecond digits must be exactly 6 for `nnnnnn`.
- Nanosecond digits must be exactly 9 for `nnnnnnnnn`.
- Without separators, use full format symbols such as `yyyyMMdd` or `HHmmss`.

Examples:

```dos
temporalParse("14-02-2018", "dd-MM-yyyy")
temporalParse("2-4-18", "d-M-y")
temporalParse("155950", "HHmmss")
temporalParse("02062018155956001000001", "MMddyyyyHHmmssnnnnnnnnn")
```

## Integer Time Conversion

For integer time stored as `93021`, numeric conversion is usually clearer and faster than string reconstruction:

```dos
raw = 93021
sec = second(raw / 10000 * 3600 + (raw % 10000 / 100) * 60 + (raw % 100))
```

When readability matters more than speed:

```dos
sec = temporalParse(raw.format("000000"), "HHmmss")
```

## Import Schema Format

Use `format` in load schema for non-standard temporal text:

```dos
schema = table(
    `id`sym`ts`price as name,
    `INT`SYMBOL`TIMESTAMP`DOUBLE as type,
    ["", "", "yyyy-MM-dd HH:mm:ss.SSS", ""] as format
)
```

Rules:

- Keep `schema.col` indexes sorted when loading selected columns.
- Use explicit schema for SYMBOL and temporal columns.
- For invalid temporal input, DolphinDB may produce typed null values. Verify row counts and `isNull` counts after import when data quality matters.
