---
name: dolphindb-basic-syntax-programming
description: >
  为 DolphinDB / DolphinScript 基础语法、脚本骨架和初版代码生成提供规则集。
  Use when 用户需要从自然语言生成可执行 DolphinDB 脚本、修复 DolphinScript 语法错误、
  检查变量赋值、函数定义、索引切片、数据结构构造、字符串 / SYMBOL / 时间 / 空值字面量、
  表访问、基础 select / exec / update / delete、loadTable / loadTextEx 等基础写法，
  探查服务端已有 DFS 库表，编写建库建表样例，或在使用 SQL、函数式、向量化 skill 前先保证代码语法和脚本结构可运行。
---

# DolphinDB 基础语法编程

## 使用流程

先判断任务是否涉及 DolphinDB / DolphinScript 代码生成、修复或审查。如果是，将该skill作为 基础语法加载器，按照以下流程使用：

### 启动必读

生成、修改或审查 DolphinScript 代码前，阅读核心启动包：

- [references/core-syntax.md](references/core-syntax.md)：语句、赋值、函数、控制流、运算符、NULL、模块和 `go`。
- [references/core-data-and-access.md](references/core-data-and-access.md)：高频数据结构、字面量、类型探查、索引访问、表和字典修改。
- [references/core-code-patterns.md](references/core-code-patterns.md)：脚本组织、输出形态、基础查询、元代码、schema 检查和安全边界。

如果用户只问一个很窄的概念，可只读相关核心文件；

只要需要输出完整代码，最后阅读 [references/syntax-checklist.md](references/syntax-checklist.md)。

### 按需深读

遇到具体问题时再加载深度 reference：

- 复杂时间解析、格式化、schema format：读 [references/temporal-and-formatting.md](references/temporal-and-formatting.md)。
- 服务端已有库表、建库建表、分区表、`loadTable` / `loadTextEx` 边界：读 [references/database-and-table-basics.md](references/database-and-table-basics.md)。
- 需要完整脚本模板：读 [references/script-skeletons.md](references/script-skeletons.md)。
- 修复已有代码、解释报错、审查常见误写：读 [references/common-errors.md](references/common-errors.md)。

### 工作方式

- 先用核心启动包建立默认写法，再按实际疑问深读。
- 生成代码时优先给出可执行脚本，包含输入准备、计算、检查和最终返回对象。
- 当前环境可执行 DolphinDB 脚本或语法探测时，先验证再报告；无法验证时明确说明未验证。
- 只读探查优先于建库建表；不要默认生成删除库表或大范围更新删除语句。
- 不确定 DolphinDB 函数、参数或返回形态时，查官方文档或明确标注不确定。

## 能力边界

- 本 skill 负责基础语法、数据对象构造、基础库表操作和单文件脚本组织。
- SQL 查询语义、分组入口、时序关联、分布式 SQL 优化，使用 `dolphindb-sql-programming`。
- 高阶函数、函数模式、部分应用、模块和函数视图，使用 `dolphindb-functional-programming`。
- 批量表达、循环改写、性能路线和执行层选择，使用 `dolphindb-vectorization-programming`。

## 输出要求

- 输出完整 DolphinScript 代码时，保证代码可复制执行，并包含清晰的输入准备、计算和结果输出。
- 修复语法错误时，说明修复了哪些基础写法问题。
- 不确定 DolphinDB 函数、参数或返回形态时，明确标注不确定，不要发明函数。
- 涉及数据库路径、表名、列名、文件路径时，列出假设或要求用户提供真实值。
- 代码中不要依赖 Python、shell、本机临时文件或未说明的外部服务。
