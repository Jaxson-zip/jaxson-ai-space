# 给 AI 助手的说明

先读这两份，再决定打开哪些文件，不要通读整个仓库：

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：系统架构图、请求和索引流程、发布流程，以及按症状查找文件的故障定位表。
2. [docs/目录索引.md](docs/目录索引.md)：每个文件夹和关键文件的用途。

## 工作约定

- 修 bug 先写能复现问题的测试，确认失败后再修。
- 提交、推送、部署都要先得到站长同意。生产发布按 `docs/部署交接-*.md` 和 `docs/生产运维与数据迁移.md` 操作；新的数据库迁移要先单独执行，部署脚本会拒绝迁移历史不一致的发布。
- 新增或删除 `apps/web/src/features/`、`collections/`、`app/api/` 或各个 `scripts/` 下的内容时，同步更新 `docs/目录索引.md`。`apps/web/src/directory-index.test.ts` 会检查。
- 不要在日志、报告或提交里写出密钥、令牌、私人消息或恢复密钥。

## 常用命令

```bash
pnpm install
pnpm dev                       # 后台 :3001 + 作品站 :3000
pnpm --filter @jaxson/web test
pnpm --filter @jaxson/web typecheck
pnpm --filter @jaxson/web lint
pnpm --filter @jaxson/portfolio test
pnpm --filter @jaxson/web exec playwright test --config playwright.portfolio.config.ts
pnpm --filter @jaxson/web exec playwright test --config playwright.web.config.ts   # 需要本地 CMS 数据
```

微信上下文测试会把 fixture 正规化为供应商使用的 LF 行尾，Windows 和 Linux 均应通过；生产供应商代码仍按原有完整性条件校验。
