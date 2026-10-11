# 已停用：unified-wechat-hook

message:received 是观察事件，不能通过 event.messages 回复普通微信消息。旧处理器现仅抛出迁移提示，不执行任何写入。

请禁用旧 Hook，并安装本仓库 integrations/openclaw/jaxson-inbox 插件。完整配置、消息 ID 与发送者授权、私人记忆审核流程见 integrations/openclaw/README.md。
