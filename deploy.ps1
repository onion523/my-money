# ==============================================================
# 🏠 我的記帳本 — Cloudflare 一鍵雲端部署腳本 (Windows PowerShell)
# ==============================================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  我的記帳本 — Cloudflare 雲端部署工具" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. 檢查 Wrangler 登入狀態
Write-Host "`n[1/4] 檢查 Cloudflare 登入狀態..." -ForegroundColor Yellow
$whoami = & npx wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "尚未登入 Cloudflare，正在為您開啟登入瀏覽器視窗..." -ForegroundColor Green
    & npx wrangler login
} else {
    Write-Host "✓ 已登入 Cloudflare" -ForegroundColor Green
}

# 2. 部署 D1 資料庫
Write-Host "`n[2/4] 初始化遠端 D1 資料庫 Schema..." -ForegroundColor Yellow
$choice = Read-Host "是否要在 Cloudflare 遠端建立/更新 D1 資料庫？(Y/N，預設 Y)"
if ($choice -ne 'N' -and $choice -ne 'n') {
    Push-Location backend
    Write-Host "正在執行遠端資料表建立..." -ForegroundColor Cyan
    & npx wrangler d1 execute my-money-db --remote --file=src/db/schema.sql
    Pop-Location
    Write-Host "✓ D1 資料表已就緒" -ForegroundColor Green
}

# 3. 部署 Workers 後端 API
Write-Host "`n[3/4] 部署後端 API (Cloudflare Workers)..." -ForegroundColor Yellow
Push-Location backend
& npx wrangler deploy
Pop-Location
Write-Host "✓ 後端 API 部署完成" -ForegroundColor Green

# 4. 打包並部署前端 Pages
Write-Host "`n[4/4] 打包並部署前端 (Cloudflare Pages)..." -ForegroundColor Yellow
Push-Location web
Write-Host "正在編譯前端生產包..." -ForegroundColor Cyan
& cmd.exe /c "npm run build"
if ($LASTEXITCODE -eq 0) {
    Write-Host "正在上傳至 Cloudflare Pages..." -ForegroundColor Cyan
    & npx wrangler pages deploy dist --project-name my-money
    Write-Host "`n🎉 恭喜！前端與後端已成功全數部署至 Cloudflare 全球網路！" -ForegroundColor Green
} else {
    Write-Host "❌ 前端編譯失敗，請檢查錯誤訊息。" -ForegroundColor Red
}
Pop-Location

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  部署流程完畢！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan