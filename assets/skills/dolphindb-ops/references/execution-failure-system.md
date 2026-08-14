---
kind: category
---

# 系统/配置/连接错误案例

> 触发: 权限报错、License 报错、配置参数报错、连接失败、Shell 调用报错、作业调度失败

## 规则

### No privilege to xxx
条件: 报错 `No privilege to run function xxx` / `Not granted to xxx`
根因: 当前用户缺少目标函数/表/DB 的执行/读写权限
处置: 管理员执行 `grant` 授权；确认角色和组权限继承关系

### License 过期
条件: 报错 `License has expired` / 无法启动报 license 错误
根因: License 文件到期
处置: 更换新 License 文件到各节点 server 目录；重启或在线更新 License（2.00.10+）

### 配置参数拼写/格式错误
条件: 报错 `Invalid configuration parameter` 或参数不生效
根因: cluster.cfg / controller.cfg 中参数名拼写错误或格式不正确
处置: 对照官方文档逐项核对参数名和值格式；查询运行时配置验证是否生效

### shell() 调用失败
条件: shell 函数返回空或报错
根因: 未启用 enableShellFunction=true；或命令本身返回非零退出码
处置: 确认配置中 enableShellFunction=true；

### submitJob 异常堆积
条件: 查看最近作业显示大量失败或排队任务
根因: 并发提交过多、worker 线程被阻塞
处置: 检查 workerNum / localExecutors 配置；清理异常任务；调整提交频率


## 验证
- 重新执行报错操作确认成功
- 检查节点连接和权限状态
- 确认调度任务正常运行
