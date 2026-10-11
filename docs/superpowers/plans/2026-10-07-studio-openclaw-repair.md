# 私人工作台与微信接入修复

按 systematic-debugging、tdd 和 verification-before-completion 流程，逐项修复并联调。公开站视觉保持当前版本。

## 实施与验收

- [x] 工作台空库返回真实空数据；数据库故障明确报错；移除虚构个人经历模板和自动进入 RAG 的错误说明。
- [x] 微信收件必须使用专用密钥、明确发送者名单和稳定消息 ID；数据库事务与唯一消息键保证重试不重复入库。
- [x] 转发校验 HTTP 状态和成功结果，设置超时；复盘可有限重试，待办接口在幂等契约未知时禁止自动重试。
- [x] 用 OpenClaw before_dispatch 插件完成指令转发及回复；停止旧 observation hook 的虚假回复路径。普通聊天不自动写入私人数据。
- [x] “转复盘/转待办”如实表示另存、原记录保留；按频道、账号和会话隔离最近成功消息。
- [x] 已确认私人记忆可显式生成非公开 AI 知识草稿；再次操作不重复创建；管理员审核并公开后才进入公共 RAG。
- [x] 增加 PostgreSQL 迁移、环境配置和操作文档；运行针对性测试、全套测试、类型检查及 Docker 真实数据库联调。

## 边界

微信账号登录、真实 OpenClaw 网关版本与发送者 ID 尚未提供。提供可安装插件与步骤，并单列真实微信尚未验收。待办系统接口源码不在本仓库，不声称支持撤回或持久化幂等。

## 涉及目录

apps/web/src/app/api/studio、collections、features/studio、features/openclaw、migrations、私人 studio 页面；integrations/openclaw；docker 配置；docs。

## 实际验收记录

99 项测试及类型检查通过；生产 Linux 构建通过；隔离 PostgreSQL 迁移、5 次并发重复消息、知识草稿创建及并发去重、公开后 AI 引用及撤回通过。Playwright 验证工作台按钮与真实总览，未发现页面运行时错误。真实微信网关及外部 Todo 服务仍待单独验收。
