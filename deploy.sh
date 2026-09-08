#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 开始全自动化一键部署 Jaxson AI Space"
echo "=================================================="

APP_DIR="/opt/jaxson-ai-space"
if [ ! -d "$APP_DIR" ]; then
  mkdir -p /opt
  if [ -d ".git" ]; then
    APP_DIR="$(pwd)"
  else
    echo "📥 克隆项目至 /opt/jaxson-ai-space..."
    git clone https://github.com/Jaxson-zip/jaxson-ai-space.git "$APP_DIR"
  fi
fi
cd "$APP_DIR"

# 1. 自动检测并安装必要依赖 (curl, git, docker, node, pnpm, pm2)
echo "🔍 [1/6] 检查系统环境与必备组件..."
if ! command -v git &> /dev/null || ! command -v curl &> /dev/null; then
  apt-get update -y && apt-get install -y git curl
fi

if ! command -v docker &> /dev/null; then
  echo "🐳 正在自动安装 Docker..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
fi

if ! command -v node &> /dev/null; then
  echo "🟢 正在自动安装 Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pnpm &> /dev/null; then
  echo "📦 正在配置 pnpm..."
  npm install -g pnpm@11.5.0 --registry=https://registry.npmmirror.com
fi

if ! command -v pm2 &> /dev/null; then
  echo "⚡ 正在安装 PM2 进程守护工具..."
  npm install -g pm2 --registry=https://registry.npmmirror.com
fi

# 2. 自动生成生产 .env（若不存在）
echo "⚙️ [2/6] 校验生产环境变量配置..."
if [ ! -f .env ]; then
  echo "📝 首次运行，正在自动生成安全生产配置 .env..."
  cp apps/web/.env.example .env
  
  GEN_PAYLOAD_SECRET=$(openssl rand -hex 24)
  GEN_STUDIO_SECRET=$(openssl rand -hex 16)
  GEN_PG_PASS=$(openssl rand -hex 12)
  GEN_OWNER_PASS=$(openssl rand -hex 12)
  GEN_AGENT_PASS=$(openssl rand -hex 12)
  
  sed -i "s|PAYLOAD_SECRET=.*|PAYLOAD_SECRET=${GEN_PAYLOAD_SECRET}|g" .env
  sed -i "s|STUDIO_SECRET_KEY=.*|STUDIO_SECRET_KEY=${GEN_STUDIO_SECRET}|g" .env
  sed -i "s|STUDIO_INBOX_SECRET=.*|STUDIO_INBOX_SECRET=${GEN_STUDIO_SECRET}|g" .env
  sed -i "s|USE_POSTGRES=.*|USE_POSTGRES=true|g" .env
  
  cat <<EOF >> .env

# PostgreSQL Container Passwords
POSTGRES_PASSWORD=${GEN_PG_PASS}
OWNER_APP_PASSWORD=${GEN_OWNER_PASS}
PUBLIC_AGENT_PASSWORD=${GEN_AGENT_PASS}
EOF
fi

if [ -f .env ]; then
  cp .env docker/.env 2>/dev/null || true
fi

# 3. 依赖更新与构建环境
echo "📥 [3/6] 拉取最新代码与依赖..."
git pull origin main 2>/dev/null || true
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=2048 --no-deprecation"

pnpm config set registry https://registry.npmmirror.com
pnpm install --no-frozen-lockfile

# 4. 启动 PostgreSQL 数据库与向量扩展
echo "🗄️ [4/6] 启动 PostgreSQL (pgvector) 数据库..."
docker compose --env-file .env -f docker/compose.prod.yaml up -d postgres
echo "⏳ 等待数据库就绪..."
for i in {1..30}; do
  if docker compose --env-file .env -f docker/compose.prod.yaml exec -T postgres pg_isready -U jaxson_admin -d jaxson_space &>/dev/null; then
    break
  fi
  sleep 1
done

# 执行数据库表与索引迁移
docker compose --env-file .env -f docker/compose.prod.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U jaxson_admin -d jaxson_space < docker/migrations/002-public-index.sql 2>/dev/null || true

# 5. 编译 Next.js 生产版本
echo "🔨 [5/6] 编译 Next.js 全栈生产构建..."
pnpm build

# 6. PM2 启动与状态检查
echo "🚀 [6/6] 启动应用服务进程..."
pm2 delete jaxson-web jaxson-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

PUBLIC_IP=$(curl -s https://api.ipify.org || echo "198.44.177.170")

echo ""
echo "=================================================="
echo "🎉 Jaxson AI Space 部署成功！"
echo "🌐 访问地址: http://${PUBLIC_IP}:3000"
echo "🔐 管理后台: http://${PUBLIC_IP}:3000/admin"
echo "📊 进程监控: pm2 status"
echo "=================================================="
pm2 status
