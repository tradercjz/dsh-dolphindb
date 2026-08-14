# 场景 06：对整列数据进行清洗、修复与类型转换时，仍逐值处理

场景介绍：

代码的主任务已经变成把数据修干净、修正确、修成可继续计算的形态。常见外观是手工统计、事后去重、逐列改类型、逐值解析时间、逐行做字符串清理。这个场景优先检查：批量统计入口、空值与重复值处理、整列类型修复、整列时间恢复、整列字符串处理。

以下是一些典型的例子：

## 1. 批量描述统计仍手工汇总

目标：快速拿到一列或一张表的统计特征。

低效写法：

```dos
mn = min(v)
mx = max(v)
ct = count(v)
av = avg(v)
sd = std(v)
```

分析：代码把一组常见统计量拆成了多次单独计算。表和数据源场景里，这种拆法会更明显。

解决方案：

```dos
re = stat(v)
```

表或数据源场景可以写成：

```dos
re = summary(t)
```

分析：统计入口已经很成熟。遇到成组统计项，优先查 `stat` 或 `summary`。

## 2. 去重仍靠事后扫描

目标：保证键值唯一，或把重复值处理掉。

低效写法：

```dos
t = table(1 1 2 3 3 4 as id, 10 11 12 13 14 15 as val)
keep = array(BOOL, t.size())
seen = dict(INT, BOOL)
for(i in 0:t.size()-1){
    if(seen.hasKey(t.id[i]))
        keep[i] = false
    else{
        seen[t.id[i]] = true
        keep[i] = true
    }
}
re = t[keep]
```

分析：去重被推迟到了后处理阶段。脚本里会再多出一段扫描、排序和回填。

解决方案：

```dos
t = table(1 1 2 3 3 4 as id, 10 11 12 13 14 15 as val)
re = t[!isDuplicated(t.id)]
```

分析：检测重复和筛重复值都能直接走批量函数。若唯一性本来就该在结构层保证，再继续看 `keyedTable` 和 `upsert!`。

## 3. 整列表的类型修复仍逐值处理

目标：把表里某一列从字符串改成数值。

低效写法：

```dos
for(i in 0:t.size()-1){
    t.val[i] = double(t.val[i])
}
```

分析：这是整列改类型，代码却还在逐值改写。

解决方案：

```dos
replaceColumn!(t, "val", double(t.val))
```

分析：整列替换一次完成。遇到整列改类型，优先查 `replaceColumn!`。

## 4. 时间列修复仍逐值解析

目标：把数值日期列和数值时间列恢复成真正的日期时间类型。

低效写法：

```dos
for(i in 0:t.size()-1){
    t.date[i] = temporalParse(string(t.date[i]), "yyyyMMdd")
    t.time[i] = temporalParse(format(t.time[i], "000000000"), "HHmmssSSS")
}
```

分析：日期列和时间列本来就是整列转换任务。循环里逐值格式化、逐值解析，脚本负担很重。

解决方案：

```dos
t.replaceColumn!(`date, t.date.string().temporalParse("yyyyMMdd"))
t.replaceColumn!(`time, t.time.format("000000000").temporalParse("HHmmssSSS"))
```

分析：转换直接在整列上完成。列替换也一次完成。

## 5. 字符串清洗仍逐行 `UDF`

目标：统一清理字符串列中的空格、固定文本或模式。

低效写法：

```dos
for(i in 0:tb.size()-1){
    tb.username[i] = trim(tb.username[i])
}
```

分析：字符串清洗只是整列文本函数的应用，没必要自己逐行写。

解决方案：

```dos
tb[`username] = trim(tb.username)
tb[`id] = regexReplace(tb.id, "因子", "factor")
```

分析：文本清洗优先用整列字符串函数。不要先写逐行 `UDF`。

## 6. 函数索引

| 函数 / 模式 | 什么时候查 | 解决什么问题 |
| --- | --- | --- |
| `summary` | 表或数据源统计仍手工汇总 | 表级统计入口 |
| `stat` | 向量、矩阵统计仍拆成多步 | 向量或矩阵统计入口 |
| `dropna` / `nullFill` | 空值处理还在逐值写 | 批量空值清理与填补 |
| `isDuplicated` / `groups` | 只想检测或定位重复 | 重复值检测 |
| `keyedTable` / `indexedTable` | 唯一性可以交给结构维护 | 主键或索引约束 |
| `upsert!` | 写入阶段可以直接覆盖 | 写入时去重或更新 |
| `clip` / `winsorize` | 异常值修正还在脚本层散着写 | 批量异常值修正 |
| `replaceColumn!` | 整列改类型或整列替换还在逐值做 | 整列替换 |
| `temporalParse` | 时间列恢复仍逐值解析 | 批量时间解析 |
| `format` / `string` | 时间解析前需要统一格式 | 批量格式准备 |
| `trim` / `strip` | 字符串首尾清理 | 文本清理 |
| `strReplace` / `regexReplace` | 文本替换或模式替换 | 批量字符串替换 |
