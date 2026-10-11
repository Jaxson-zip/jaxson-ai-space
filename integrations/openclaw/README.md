# 微信 → 私人复盘 → 可审核知识草稿

## 目前接入范围

本仓库提供 `jaxson-inbox` OpenClaw 原生插件。它在 `before_dispatch` 接收明确的 `fp 内容` / `复盘 内容` 或 `td 内容` / `待办 内容` 指令，通过接口保存，并把实际回执交给 OpenClaw 的频道回复链路。普通聊天不写入复盘或待办；群聊不转发。

旧 `apps/web/src/features/openclaw/unified-wechat-hook` 已停用。`message:received` 是观察事件，向 `event.messages` 添加文字不能回复普通微信消息；不要同时装旧 Hook 和新插件。

已对照 2026-10-08 的 [OpenClaw 消息插件文档](https://docs.openclaw.ai/plugins/hooks/messages) 和 `2026.9.8` 发布包中的核心 SDK 类型。个人微信已扫码部署，真实 fp 入库、手机保存回执和服务端重放去重已验证；私人收件直接入口部署后，普通文字服务器处理及发送 352 毫秒，本人确认 10 秒内收到。最新状态见 [DNS 与个人微信接入](../../docs/DNS与微信接入-2026-10-09.md)。版本锁定和三渠道所需配置见 [邮件与微信接入](../../docs/邮件与微信接入-2026-10-08.md)。企业微信延期，公众号需要独立适配，尚未实现。

生产安装使用 `prepare-vps.sh`，同时部署 `weixin-admission.mjs`、`weixin-context.mjs`、`weixin-inbox-path.mjs`，本地插件必须包含 `weixin-inbox.mjs`。依次加入本人入口鉴权、补齐 SenderId、接入私人收件直接处理入口；均校验固定发布包源文件，不支持不经复核的升级。Compose 固定 hostname、提供 60 秒优雅停机；已验证配置后直接启动 Node，避免每次启动自动运行 doctor --fix 改写权限。

Compose 使用原生 Node HTTP 请求检查 `/healthz`，不加载完整网关配置模块。当前 VPS 冷启动曾耗时约六分钟，因此启动宽限为 600 秒；部署验收窗口应覆盖这一范围。宽限期不代表就绪，仍须实际 HTTP 健康和微信通道就绪后验收；故障时保留模块、环境和 Compose 回退。

`JAXSON_INBOX_ONLY=true` 时，个人微信文字指令在媒体、调试指令、agent 路由和会话入队之前交给同一收件 handler，然后使用腾讯原有 `sendMessageWeixin` 返回回执。真实 channel/account/sender/conversation/provider message ID 与原路径相同，后台事务与去重仍保留。普通消息只回复使用说明；缺少回复 context token 时不保存；图片/文件只返回文字使用说明，不下载或解析。关闭此模式时保留原腾讯分发路径。此入口只用于个人微信私人收件，不支持通用 AI 对话、群聊、或其他插件的发送回调。

## 安装在网关所在机器

1. 先记录 `openclaw --version`，按 [官方微信频道指南](https://docs.openclaw.ai/channels/wechat) 安装腾讯维护的微信插件，并扫码登录：

```sh
openclaw plugins install "@tencent-weixin/openclaw-weixin@2.4.9"
openclaw plugins enable openclaw-weixin
openclaw channels login --channel openclaw-weixin
```

2. 安装本地插件，路径应是网关机器上的仓库路径。复制部署时也可将整个 `jaxson-inbox` 目录拷贝过去：

```sh
openclaw plugins install ./integrations/openclaw/jaxson-inbox
openclaw plugins enable jaxson-inbox
openclaw plugins inspect jaxson-inbox --runtime
```

开发时可以使用 `install --link`；生产使用复制安装，避免绑定易变的工作目录。插件无需本项目的 Node 依赖或构建步骤。

3. 将 `jaxson-inbox/.env.example` 中的变量设置到网关进程。`SPACE_BOT_SECRET` 必须等于后端的 **STUDIO_INBOX_SECRET**，不得使用 Payload 管理密钥。进程管理器需要显式加载环境变量，单独放一个 `.env` 文件不代表网关已经读取。

后端与网关同时设置相同的 `STUDIO_INBOX_ALLOWED_IDENTITIES`，例如：

```json
[{"channelId":"openclaw-weixin","accountId":"实际账号ID","senderId":"你的实际发送者ID"}]
```

ID 来自频道运行上下文，不是微信昵称。未配置或空列表会阻止写入。不要依赖微信插件自身的默认联系人放行行为。

本地后端是 3001；正式地址用 `https://<API_DOMAIN>`。跨主机必须用 HTTPS，插件拒绝向非本机的 HTTP 地址发送密钥。私有 Cloudflare Access 若保护该路径，需要为机器人设置服务访问规则。

## 数据与重复投递

`POST /api/studio/inbox` 接收 `message, channelId, accountId, senderId, conversationId, messageId`。必须使用频道提供的稳定消息 ID；缺失时停止转发，不随机生成 ID。同一身份/会话/消息 ID 的内容重放只返回原回执；同 ID 改内容返回 409。

复盘、候选记忆和回执在同一数据库事务中写入。失败全部回滚，接口返回 503。成功回执存于对应复盘的隐藏字段；删除该复盘同时移除其去重回执，后续重放会重新创建。需要保留去重记录时请保留原复盘。

复盘请求最多两次，每次超时默认 4 秒，可配置 500–5000 毫秒。只有网络异常及 429/502/503/504 可重试；401、403和无效回执不重试。网关内的并发消息也会合并，最近成功消息按频道、账号、发送者和会话隔离，保存 30 分钟；网关重启后该临时会话状态清空。

`转复盘` / `转待办` 表示**另存，原记录保留**。不是撤回或删除。默认 `TODO_BOT_RESPONSE_MODE=receipt-v1` 要求待办接口 HTTP 成功且返回 `{ "success": true, "reply": "..." }`。

实际 `to_do` 项目的 `/api/bot/message` 返回 `{ "reply": "..." }`，须显式配置 `TODO_BOT_RESPONSE_MODE=reply-v1`。此模式显示服务的实际回复，不把查询、绑定或无法识别的回复当作保存回执，不将它们记录为「转复盘」的来源；空回复按该接口的未绑定契约显示绑定步骤。带 error、success=false 或非字符串 reply 的结果均拒绝。Todo 请求只发送一次。

生产设置 `TODO_RECEIPTS_PATH` 到私有持久卷的绝对路径。SQLite 先记录消息，再调用 Todo；同一 provider message ID 在重启后返回原回复，同 ID 改内容拒绝。超时、崩溃或写入结果不确定时停止自动重发，需到 Todo 网站核对。成功回复保留 30 天；不确定记录保留到人工处理。磁盘故障时停止转发。该机制不是跨 SQLite 与 Supabase 的原子事务，用户重新发送产生的新消息 ID 也不属于同一回执。备份时须包含该数据库；运行时用 SQLite backup API，不能只复制可能正在写入的文件。

## 到期提醒与绑定

Todo 生产站的“同步 → OpenClaw 微信待办”读取当前登录账号的真实绑定，未绑定时可生成十分钟有效的一次性指令。已绑定不等于网关实时在线。另一个“独立扫码通道”单独折叠；同一微信账号不要重复启动两个收件进程。

部署 Todo 的 `/api/bot/reminder-queue` 后，设置 `TODO_REMINDERS_ENABLED=true`、`TODO_REMINDERS_SINCE=<首次启用的 UTC 时间>`。只支持白名单内唯一的个人微信身份，必须已有可用登录与回复 context。原生 OpenClaw 服务每分钟领取最多五项，分页查询当前绑定用户；跳过启用前和超过 24 小时的旧提醒。定时器只由插件生命周期启动，直接收件适配器不会启动第二个定时器。

提醒通过固定腾讯 2.4.9 模块的原发送函数发送，不新增收件 poller、公开发送端口或 Supabase 管理密钥。成功发送先记入同一私有 SQLite，再确认 Todo 的领取令牌；确认失败后只补确认。发送超时等不确定结果停止自动重发，日志显示 `uncertain`，需人工核查。微信接口确认不代表手机已经展示，最终以手机收件验收。长时间没有会话互动、登录失效或微信限制可能影响送达。

运维检查：日志前缀 `[todo-reminders]` 显示 `ready`、`waiting-for-context` 或 `unbound`，以及 sent/acknowledged/uncertain/failed 计数，不打印任务正文。未连接时先在已绑定会话发一句话恢复 context；不要把重新扫码当作默认修复。人工核对不确定记录后才决定是否新建提醒时间；不要批量清空 SQLite 后重放历史消息。

接入实际 Todo 的配置与验收见 [微信待办接入](../../docs/微信待办接入-2026-10-09.md)。网关的 `TODO_BOT_SECRET` 等于 Todo 服务端 `BOT_WEBHOOK_SECRET`；前端 Supabase anon key、Supabase service-role key 和 AI Key 均不能替代它。

Todo 单次请求默认等待 10 秒，可通过 `TODO_BOT_TIMEOUT_MS` 在 1000–15000 毫秒内设置；独立于复盘请求的四秒默认值。实际联调中四秒窗口曾在任务已经完成后提前超时，不能据此重发写操作。延长窗口仍不提供数据库级幂等保证。

## 给公开 AI 喂数据

- 直接维护公开知识：CMS → AI 数字分身知识库 → 新建 → 核对事实 → 勾选“是否对公开 AI 分身可见” → 保存。
- 微信复盘：私人工作台 → 候选记忆核对 → 确认为私人记忆 → “创建 AI 知识草稿” → 在 CMS 审核草稿 → 清除私人/企业敏感内容 → 自行勾选公开。
- 新知识默认不公开；确认私人记忆不会自动进入公共 RAG。重复点击创建草稿会打开原知识条目，保留你已在 CMS 中作出的编辑。
- 私人记忆与知识草稿是独立副本；修改或删除私人记忆不会自动修改已发布知识。撤回公共 AI 可见性需要在 CMS 取消公开或删除该知识条目。
- 项目、公开知识才进入公共快照和向量索引，微信原始复盘及候选记忆始终留在 owner 数据域。

## 真实微信验收还需要

网关所在机器与版本、扫码登录后的账号及发送者 ID、可达的后端 HTTPS 地址。逐项验证 fp 保存与回复、普通消息不入库、重复消息不重复保存、错误密钥无成功提示；随后检查 CMS 草稿审核与 AI 引用。现在的自动化测试不代表已经验证腾讯微信网络或外部 Todo 服务。
