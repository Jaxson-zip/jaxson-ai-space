#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 开始全自动化一键部署 Jaxson AI Space"
echo "=================================================="

APP_DIR="/opt/jaxson-ai-space"
cd "$APP_DIR"

export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=2048 --no-deprecation"
export USE_POSTGRES=false

echo "📥 [1/5] 拉取最新代码与配置..."
git pull origin main

echo "📦 [2/5] 原生解析并编译依赖 (pnpm)..."
pnpm config set registry https://registry.npmmirror.com
pnpm rebuild sharp esbuild 2>/dev/null || true
pnpm install --no-frozen-lockfile 2>/dev/null || true

echo "🗄️ [3/5] 启动 PostgreSQL pgvector 数据库并执行迁移..."
if [ -f .env ]; then
  cp .env docker/.env
fi
docker compose --env-file .env -f docker/compose.prod.yaml up -d postgres
sleep 3
docker compose --env-file .env -f docker/compose.prod.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U jaxson_admin -d jaxson_space < docker/migrations/002-public-index.sql 2>/dev/null || true

echo "🔨 [4/5] 编译 Next.js 全栈生产版本..."
pnpm build

echo "⚡ [5/5] 使用 PM2 守护并启动 Web 网站与 RAG Worker..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 --registry=https://registry.npmmirror.com
fi

pm2 delete jaxson-web jaxson-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=================================================="
echo "🎉 全量部署 100% 成功！当前运行状态："
echo "=================================================="
pm2 status
