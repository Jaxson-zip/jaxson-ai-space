# Jaxson AI Space

当前版本、已核对事项和待办见 [当前交接状态](docs/CURRENT.md)，本轮证据见 [2026-10-27 核对记录](docs/核对与完善-2026-10-27.md)。[2026-10-11 上线状态](docs/当前上线状态-2026-10-11.md)及其他带日期的规划、验收文档保留为历史证据。

当前项目由两个运行入口组成。公开作品站与内容后台分别启动，作品站通过后台的公开项目接口读取已发布内容。

| 目录 | 当前职责 |
| --- | --- |
| `apps/portfolio/` | 当前公开作品站。`index.html` 是页面入口，`public/` 放图片和简历 PDF。 |
| `apps/web/` | Payload CMS、知识库、AI 对话及项目接口；统一从 `/admin` 管理。 |
| `integrations/openclaw/` | 可安装的微信私人收件插件及配置说明，部署在 OpenClaw 网关机器。 |
| `archive/` | 历史页面与未启用的旧首页方案，不参与构建。 |
| `scratch/` | 本地截图、参考资料和试验脚本，不参与构建。 |
| `docs/` | 部署说明和历史规划；旧规划记录设计过程，不代表当前运行结构。 |

从项目根目录运行 `pnpm install` 和 `pnpm dev`。公开站在 [localhost:3000](http://localhost:3000/)，后台在 [localhost:3001/admin](http://localhost:3001/admin)。登录后台首页，点击「新增项目经历」即可直达表单；也可进入 [作品与项目经历](http://localhost:3001/admin/collections/projects) 点击「创建新条目」。实习、教育和校园经历放在 [经历记录](http://localhost:3001/admin/collections/experiences)，AI 知识放在 [AI 知识库](http://localhost:3001/admin/collections/ai-knowledge)。AI 对话在 [localhost:3001/ai](http://localhost:3001/ai)。首次使用本地数据库时，先在 `/admin` 创建管理员账号。

经典对照版本 `biaoge_style_portfolio.html` 位于原始作品目录，本仓库的清理不会改动它。`apps/portfolio/` 是本项目唯一正在使用的公开作品页；如需从原始素材目录重新同步，参见 [后台说明](apps/web/README.md)。

正式部署使用两个独立域名，配置与首发检查见 [docker/README.md](docker/README.md)。部署需要人工触发，推送代码只运行检查。

最近一次构建、CMS / AI 联调结果、知识库使用方法及上线待办见 [上线验收记录](docs/上线验收记录.md)。

内容迁移、语义检索配置、邮件恢复和定时备份见 [生产运维与数据迁移](docs/生产运维与数据迁移.md)。

私人工作台在后台的 `/studio`。确认私人记忆不会自动公开；通过「创建 AI 知识草稿」进入 CMS 审核，再明确公开。微信接入与发送者名单设置见 [OpenClaw 说明](integrations/openclaw/README.md)，真实微信登录与收发需单独验收。
