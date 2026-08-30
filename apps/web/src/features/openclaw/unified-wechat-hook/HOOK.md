---
name: unified-wechat-hook
description: "Smart Multi-Intent WeChat Hook routing messages between Jaxson AI Space Studio and Todo Memo Bot"
metadata: { "openclaw": { "events": ["message:received"] } }
---

# Unified Multi-Intent WeChat Hook for OpenClaw

此 Hook 部署在运行 OpenClaw 的服务器上，监听微信输入消息，并自动将消息精准分流给 **Jaxson AI Space（复盘大脑）** 或 **Todo Memo（待办提醒）**。

## 环境变量配置 (Environment Variables)

在服务器的 `openclaw.env` 或系统环境变量中配置：

```bash
# 1. Todo Bot API 地址与密钥 (指向 G:\vibe-coding\to_do 本地 API)
TODO_BOT_BASE_URL=http://127.0.0.1:8787
TODO_BOT_SECRET=your_todo_bot_secret

# 2. Jaxson AI Space API 地址与密钥 (指向 jaxson-ai-space 本地或生产 API)
SPACE_BOT_BASE_URL=http://127.0.0.1:3000
SPACE_BOT_SECRET=jaxson_studio_secret_2026
```

## 智能分流规则表

| 你发送的消息示例 | 分流目标 | 微信即时回复 |
| :--- | :--- | :--- |
| `fp 优化了 Vue3 监控大屏防抖` | **Jaxson Space** | 🧠 【复盘大脑已接收】• 主题：优化 Vue3 监控... (已存入 Web 待审看板) |
| `td 明天下午三点开会` | **Todo Memo** | ✅ 已为您创建待办：明天下午三点开会 |
| `今天调微服务接口，踩坑了跨域预检，最后放行搞定` | **Jaxson Space** | 🧠 自动识别为技术踩坑复盘，提取 2 条事实候选记忆 |
| `明天买牛奶` | **Todo Memo** | ✅ 自动识别为时间行动待办 |
| *(判错时回复)* `转复盘` 或 `转待办` | **一键撤销并转存** | 🔄 【已撤回并转存至对应系统】 |
