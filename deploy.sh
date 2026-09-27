#!/bin/bash
# ==============================================================
# 🏠 我的記帳本 — Cloudflare 一鍵雲端部署腳本 (Linux/macOS)
# ==============================================================
set -e

echo "=========================================="
echo "  我的記帳本 — Cloudflare 雲端部署工具"
echo "=========================================="

echo -e "\n[1/4] 檢查 Cloudflare 登入狀態..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "尚未登入，請先登入 Cloudflare..."
    npx wrangler login
else
    echo "✓ 已登入 Cloudflare"
fi

echo -e "\n[2/4] 初始化遠端 D1 資料庫..."
cd backend
npx wrangler d1 execute my-money-db --remote --file=src/db/schema.sql || true

echo -e "\n[3/4] 部署後端 API (Cloudflare Workers)..."
npx wrangler deploy
cd ..

echo -e "\n[4/4] 打包並部署前端 (Cloudflare Pages)..."
cd web
npm run build
npx wrangler pages deploy dist --project-name my-money
cd ..

echo -e "\n🎉 部署完成！"