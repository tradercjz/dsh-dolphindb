---
name: dolphindb-finance-dataimport
description: 金融数据导入 — 将 CSV 文件导入到已存在的 DolphinDB 表中
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - AskUserQuestion
---

# /dolphindb-finance-dataimport — 金融数据导入

适用于：已有建好的 DolphinDB 数据库和表，需要将 CSV 文件导入到表中。

> **本 skill 只负责导入数据**，不负责建库建表。建库建表请调用 `/dolphindb-finance-dbtbcreate`。

## 执行流程

### Step 1: 收集用户输入

用 `AskUserQuestion` 收集以下参数。每个问题独立调用，纯文本输入（**不要设置 options**），用户通过"Other"填写。

**问题 1 — CSV 文件路径**（必填）
- 直接提问："请输入 CSV 文件在 DDB 服务器上的绝对路径"
- 不设 options，用户通过"Other"填写路径

**问题 2 — 数据库路径**（必填）
- 直接提问："请输入目标数据库路径，例如 dfs://DB_split_SH"

**问题 3 — 表名**（必填）
- 直接提问："请输入目标表名，例如 TB_split_SH_entrust"

### Step 2: 验证目标库表存在

#### 2.1 执行验证

直接提交以下代码给 DolphinX 平台执行：

```dos
print("=== VERIFY ===");
print("DB_EXISTS=" + string(existsDatabase("{数据库路径}")));
print("TB_EXISTS=" + string(existsTable("{数据库路径}", "{表名}")));
```

读取 `=== VERIFY ===` 后的 `DB_EXISTS` 和 `TB_EXISTS` 值。

#### 2.2 检查结果

- 任一为 `False` → 报错终止，提示用户先运行 `/dolphindb-finance-dbtbcreate` 建库建表
- 均为 `True` → **做 schema 对比，检查表结构是否与 CSV 兼容**：

  直接提交以下代码给 DolphinX 平台执行：

  ```dos
  print("=== CSV_COLUMNS ===");
  print(extractTextSchema("{CSV路径}"));
  print("=== TABLE_COLUMNS ===");
  colDefs = schema(loadTable("{数据库路径}", "{表名}")).colDefs;
  print(select name, typeString from colDefs);
  print("=== TABLE_COLUMN_ORDER ===");
  print(select name from colDefs);
  ```

  AI 助手读取三条输出后推理判断兼容性：

  - `order_mismatch=true` → **表结构与 CSV 列顺序不兼容**，说明库表名已存在但可能是旧表（公共列相对顺序不一致）
  - 其他情况（仅有 `type_mismatches`、`leading_table_only`、`trailing_table_only`）→ 直接进入 Step 3，这些差异由导入脚本自动处理

#### 2.3 处理不兼容

当 `order_mismatch=true` 时，用 `AskUserQuestion` 询问用户：

```
目标库 {数据库路径} 和表 {表名} 已存在，但其结构与当前 CSV 不兼容。
请选择处理方式：
  1. 删除已有库表并重建（原数据将丢失）
  2. 更换库名/表名（输入新的名称）
  3. 取消导入
```

- 选 1 → 执行 `dropDatabase("{数据库路径}")`（通过 `.dos` 脚本）删除，然后运行 `/dolphindb-finance-dbtbcreate` 重建，重建后回到 Step 2
- 选 2 → 提示用户输入新库名/表名，重新从 Step 2.1 开始验证
- 选 3 → 报告后终止

### Step 3: CSV 与表结构对比

#### 3.1 执行结构对比

如 Step 2.2 已执行过 schema 对比则跳过此步。否则同 Step 2.2 直接提交对比代码给 DolphinX 平台执行。

AI 助手解析输出的三条标记段，向用户展示完整结构对比（**含列顺序和列索引**）：

```
CSV 与表结构对比：
  目标表列顺序 (14): TradeDate, ChannelNo, ApplSeqNum, ...
  CSV 列顺序 (13):   ChannelNo, ApplSeqNum, ...

  → 需要前置添加的列 (1): TradeDate（位于表的第一列，CSV 中不存在）
  → 需要后置填充的列 (0):
  → 列顺序匹配: ✓（公共列相对顺序一致）

  匹配的列 (13): ChannelNo, ApplSeqNum, ...
  CSV 独有的列 (0):
  表有但 CSV 没有的列 (0):
  类型不匹配 (2):
    [4] SecurityIDSource: INT → SYMBOL（CSV 列索引 4）
    [7] ExecType: INT → SYMBOL（CSV 列索引 7）

  注：列索引基于 CSV 文件列顺序，从 0 开始。AI 助手通过 `csv_column_order` 列表确定各列索引。
```

如果 `type_mismatches` 为空，则直接跳到 Step 3.4 确认导入。

#### 3.3 确定列类型转换方案

如果存在类型不匹配，AI 助手根据 `csv_column_order`（CSV 列顺序列表）找到每个不匹配列在 CSV 中的索引位置，然后按以下映射表确定 `array(ANY)` 转换表达式。**不再使用 `update` 语句做类型转换**（DDB 禁止 `update` 更改列类型）。

| csv_type → table_type | array(ANY) 转换表达式 |
|---|---|
| INT/LONG → SYMBOL | `symbol(raw[cols[i]])` |
| STRING → SYMBOL | `symbol(raw[cols[i]])` |
| STRING → DATE | `date(temporalParse(raw[cols[i]], "yyyy-MM-dd"))` |
| INT → DATE | `date(temporalParse(string(raw[cols[i]]), "yyyyMMdd"))` |
| INT → TIME | `time(temporalParse(format(raw[cols[i]], "0"->"000000"), "HHmmss"))` |
| STRING → TIME | `time(temporalParse(raw[cols[i]], "HH:mm:ss"))` |
| (任意) → DOUBLE | `double(raw[cols[i]])` |
| (任意) → LONG | `long(raw[cols[i]])` |
| (任意) → INT | `int(raw[cols[i]])` |
| (任意) → SHORT | `short(raw[cols[i]])` |

生成以下转换配置变量（带入 Step 4）：
- `symbol_cols = [索引列表]` — 需要 `symbol()` 转换的列索引，如 `[4, 5, 7, 8, 9, 29, 30, 31, 35]`
- `date_cols = [(索引, "格式"), ...]` — 需要 `date(temporalParse())` 的列索引及格式，如 `[(25, "yyyy-MM-dd"), (26, "yyyy-MM-dd")]`
- `long_cols = [索引列表]` — 需要 `long()` 转换的列索引
- `double_cols = [索引列表]` — 需要 `double()` 转换的列索引

向用户展示转换方案：

```
自动类型转换方案：
  [4] SecurityIDSource: INT → SYMBOL
  [7] ExecType: INT → SYMBOL
  [25] 上市交易日: STRING → DATE
```

#### 3.4 用户确认

用 `AskUserQuestion` 确认是否继续，展示完整的转换方案（包含类型转换和列忽略信息），options 如下：
- `继续导入`
- `取消`

用户选择"取消"则报告后终止；选择"继续导入"则将 `symbol_cols`、`date_cols`、`leading_exprs`、`trailing_exprs` 等配置带入 Step 4。

### Step 4: 生成并执行导入脚本

#### 4.1 生成导入脚本

写入 `generated/import_{表名}_{时间戳}.dos`。**使用 `array(ANY)` 模式**：

```dos
// import_{表名}_{时间戳}.dos — CSV 导入（array(ANY) 模式）
raw = loadText("{CSV路径}");
cols = raw.columnNames();
rows_before = exec count(*) from loadTable("{数据库路径}", "{表名}");

// 在 array(ANY) 循环中逐列进行类型转换
v = array(ANY, 0, {总列数});
for (i in 0..(cols.size()-1)) {
    if (i == {列A} || i == {列B}) {                // ← 替换为 symbol_cols
        v.append!(symbol(raw[cols[i]]));
    } else if (i == {列C} || i == {列D}) {           // ← 替换为 date_cols
        v.append!(date(temporalParse(raw[cols[i]], "格式")));
    } else if (i == {列E}) {                         // ← 替换为 double_cols
        v.append!(double(raw[cols[i]]));
    } else {
        v.append!(raw[cols[i]]);
    }
}

// 增量构建内存表
t = table(v[0] as `c0);
for (i in 1..(cols.size()-1)) {
    t["c" + string(i)] = v[i];
}

// 过滤分区列中的 NULL 行
t_valid = select * from t where isValid(c{分区列索引});
n_valid = t_valid.size();

// 分批导入，每批 100 万行
batch_size = 1000000;
batch_no = 0;
start = 0;
while (start < n_valid) {
    end = min(start + batch_size, n_valid);
    batch_no += 1;
    batch = select {前置列} * {后置列} from t_valid[start:end];
    loadTable("{数据库路径}", "{表名}").append!(batch);
    start = end;
}

rows_after = exec count(*) from loadTable("{数据库路径}", "{表名}");
print("=== IMPORT_RESULT ===");
print("total_rows=" + string(n_valid));
print("rows_before=" + string(rows_before));
print("rows_after=" + string(rows_after));
print("imported=" + string(rows_after - rows_before));
print("batches=" + string(batch_no));
```

**模板参数填充规则**：
- `symbol_cols` 转换为一组 `||` 条件，如 `i == 4 || i == 5 || i == 7 || i == 8 || i == 9`
- `date_cols` 转换为 `else if` 条件，每组日期格式不同则拆多个 `else if`；格式在 `temporalParse()` 中指定
- `分区列索引` — 在 `csv_column_order` 中查找用户确认的分区列名所在位置
- `前置列` — 有前置列时填写 `date("2023.02.01") as TradeDate,`（末尾带逗号和空格）；无则留空
- `后置列` — 有后置列时填写 `, "batch001" as BatchID`（开头带逗号和空格）；无则留空
- 既无前置也无后置列时，整个 `select` 改为 `select * from t_valid[start:end]`

**关键注意事项**：
- `append!` 按列**位置**匹配，不是按列名，因此 `select` 的列顺序必须等于目标表列顺序
- 日期格式必须与 CSV 中实际格式匹配（如 `"yyyy-MM-dd"`、`"yyyyMMdd"`、`"yyyy.MM.dd"`）
- 中文列名通过 `cols[i]` 索引访问，无需在代码中直接书写中文字符

#### 4.2 执行导入

AI 助手将 `.dos` 提交给 DolphinX 平台执行，读取 `=== IMPORT_RESULT ===` 后的结果。

### Step 5: 报告结果

**必须按以下顺序执行全部 3 个子步骤，缺一不可：**

#### 5.1 展示导入结果摘要

解析导入脚本的输出，以文本形式向用户展示导入结果摘要：

```
导入结果：
  CSV 文件: /hdd/hdd1/feb2023_csv/20230201/mdl_4_19_0.csv
  目标表: dfs://DB_split_SH.TB_split_SH_entrust
  状态: 成功
  新增行数: 1,234,567
  批次数: 2
```

#### 5.2 执行验证查询

直接提交以下验证查询代码给 DolphinX 平台执行：

```dos
print("=== VERIFY_DATA ===");
print("行数: " + string(exec count(*) from loadTable("{数据库路径}", "{表名}")));
print("前10行:");
select top 10 * from loadTable("{数据库路径}", "{表名}");
```

#### 5.3 展示查询代码与结果

AI 助手读取 `=== VERIFY_DATA ===` 后的行数和前 10 行数据，将查询代码和结果一并展示给用户：

```
验证查询：
  print("=== VERIFY_DATA ===");
  print("行数: " + string(exec count(*) from loadTable("{数据库路径}", "{表名}")));
  print("前10行:");
  select top 10 * from loadTable("{数据库路径}", "{表名}");

已导入表前 10 行预览（查询结果）：
  TradeDate   SecurityID   LastPrice   ...
  2023.02.01  000001.SZ    10.25
  ...
```

## 注意事项

- **CSV 路径**：路径必须在 DDB 服务器上可访问
- **导入前请确保表已存在**：如不存在请先调用 `/dolphindb-finance-dbtbcreate`
- **列不匹配**：CSV 有但表没有的列会被忽略；表有但 CSV 没有的列在 `select` 中通过前置/后置表达式合成
- **`array(ANY)` 模式**：所有类型转换在 `array(ANY)` 循环中按列索引完成
- **中文列名**：通过 `cols[i]` 位置索引访问，无需在代码中直接书写中文

## 产出文件清单

| 文件 | 来源 |
|---|---|
| `generated/import_{表名}_{时间戳}.dos` | Step 4 导入脚本（array(ANY) 模式） |
