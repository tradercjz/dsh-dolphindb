# DolphinDB plot() Examples

参考 DolphinDB 官方 `plot` 文档：https://docs.dolphindb.com/en/Functions/p/plot.html

## 表 - 折线图

```dos
x = 0.1 * (1..100)
y = 0.1 * (100..1)
t = table(x, y)
plot(t, title="x 与 y 趋势", extras={multiYAxes: false})
```

也可以只选择部分列：

```dos
plot(t[`x`y], title="x 与 y 趋势", extras={multiYAxes: false})
```

## 矩阵 - 三角函数曲线

```dos
x = 0.1 * (1..100)
plot([sin, cos](x), x, "cos and sin curve", extras={multiYAxes: false})
```

函数名 `sin`、`cos` 会作为系列名。

## 向量 - 累计值

```dos
x = 0.1 * (1..100)
plot(cumsum(x) as cumsumX, 2012.10.01 + 1..100, "cumulative sum of x", extras={multiYAxes: false})
```

`cumsumX` 会作为系列名。

## 元组 - 多系列

```dos
plot([1..10 as x, 10..1 as y], 1..10, "x 与 y 对比", LINE, false, {multiYAxes: false})
```

`x` 和 `y` 会作为系列名。

## 条形图

```dos
plot(1..5 as value, `IBM`MSFT`GOOG`XOM`C, `rank, BAR)
```

## 柱形图

```dos
plot(99 128 196 210 312 as sales, `IBM`MSFT`GOOG`XOM`C, `sales, COLUMN)
```

## 饼图

```dos
plot(99 128 196 210 312 as sales, `IBM`MSFT`GOOG`XOM`C, `sales, PIE)
```

## 散点图

```dos
x = rand(1.0, 1000)
y = x + norm(0.0, 0.2, 1000)
plot(x, y, "x 与 y 相关性", SCATTER)
```

## 多 Y 轴折线图

```dos
t = table(1 2 3 4 5 as y1, 1200 1300 1400 1500 1600 as y2, 100 300 500 800 900 as y3, 10 20 30 40 50 as date)
plot([t.y1, t.y2, t.y3], t.date, "多量纲指标趋势", LINE, false, {multiYAxes: true})
```

`y1`、`y2`、`y3` 分别对应不同 Y 轴。

## 三维曲面图

```dos
m = matrix(1.0 2.0 3.0, 2.0 4.0 6.0, 3.0 6.0 9.0)
plot(m, title=["曲面图", "X", "Y", "Z"], chartType=SURFACE)
```

只在目标环境支持 `SURFACE` 时使用。`SURFACE` 的 `data` 必须是数值矩阵；矩阵行标签和列标签会作为 X/Y 轴刻度，不传 `labels`、`stacking` 或 `extras`。
