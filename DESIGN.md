# Design System — My Money

## Product Context
- **What this is:** 個人財務管理 app，追蹤銀行帳戶、信用卡、固定支出攤提、儲蓄目標、現金流預測
- **Who it's for:** 自己和朋友
- **Space/industry:** 個人理財 / FinTech
- **Project type:** 跨平台 app（Flutter Web + iOS + Android）

## Aesthetic Direction
- **Direction:** 柔和水彩（Soft Watercolor）— 日系、活潑、可愛、溫暖
- **Decoration level:** Intentional — 淡水彩漸層背景、柔和圓角、微妙的色彩過渡
- **Mood:** 像打開一本精心製作的可愛手帳。溫暖、安心、讓人想每天打開看看。不是冷冰冰的金融工具，而是你喜歡的日常小物。
- **iOS HIG:** 遵循 Apple Human Interface Guidelines — 大標題導覽列、毛玻璃效果、spring animation、分段控制器

## Typography
- **Display/Hero:** Zen Maru Gothic — 圓潤可愛的日系字型，用於標題和大金額數字
- **Body/UI:** Noto Sans TC — 繁體中文最佳可讀性，乾淨中性
- **Data/Tables:** Noto Sans TC (tabular-nums) — 數字對齊
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN
- **Scale:**
  - 3xl: 32px / 2rem (餘額大數字)
  - 2xl: 24px / 1.5rem (頁面標題)
  - xl: 20px / 1.25rem (卡片標題)
  - lg: 18px / 1.125rem (次標題)
  - md: 16px / 1rem (內文)
  - sm: 14px / 0.875rem (輔助文字)
  - xs: 12px / 0.75rem (標籤、時間戳)

## Color

### Light Mode
- **Background:** #FFF5F5 (淡粉暖白)
- **Surface/Card:** #FFFFFF
- **Primary text:** #2D3436
- **Secondary text:** #636E72
- **Accent (primary):** #FF8A8A (柔和粉紅) — 主要互動元素、重點標記
- **Accent warm:** #FFD4A0 (暖黃) — 次要強調、儲蓄進度
- **Accent cool:** #A8D8EA (淺藍) — 資訊性標記
- **Semantic:**
  - Success: #55C595 (柔和綠) — 進度正常、充裕
  - Warning: #FFB347 (暖橙) — 需加油、注意
  - Error: #FF6B6B (柔和紅) — 危險、超支
  - Info: #A8D8EA (淺藍)

### Dark Mode
- **Background:** #1A1A2E
- **Surface/Card:** #252540
- **Primary text:** #F0F0F0
- **Secondary text:** #A0A0B8
- **Accent:** #FF9E9E (淡化粉紅)
- 其他語意色彩降低飽和度 10-20%

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable（舒適，不擁擠）
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- **Card padding:** 16px
- **Card gap:** 12px
- **Section gap:** 24px

## Layout
- **Approach:** Grid-disciplined（網格紀律型）
- **Grid:** Mobile 1col / Tablet 2col / Desktop 2col+sidebar
- **Max content width:** 1200px
- **Border radius:**
  - sm: 8px (按鈕、標籤)
  - md: 12px (輸入框、小卡片)
  - lg: 16px (主要卡片) — iOS HIG 標準
  - xl: 24px (大區塊、modal)
  - full: 9999px (圓形按鈕、頭像)

## Motion
- **Approach:** Intentional — iOS spring animation 風格
- **Easing:**
  - Enter: cubic-bezier(0.34, 1.56, 0.64, 1) (spring 彈跳)
  - Exit: ease-in
  - Move: ease-in-out
- **Duration:**
  - Micro: 80ms (按壓回饋)
  - Short: 200ms (hover、toggle)
  - Medium: 350ms (卡片展開、頁面切換)
  - Long: 500ms (進度條填充、計數器動畫)
- **特色動畫:**
  - 卡片載入：水彩暈開的漸入效果（opacity + blur 過渡）
  - 金額數字：計數器動畫（從 0 跳到目標值）
  - 進度條：從左到右漸入填充
  - 卡片按壓：scale(0.97) 微縮回饋
  - 頁面切換：滑入/滑出過渡
  - 毛玻璃：導覽列和 tab bar 使用 backdrop-filter: blur(20px)

## iOS Specific
- **Navigation:** Large Title nav bar（大標題，捲動時收合）
- **Tab Bar:** 4 tabs — 首頁 / 帳戶 / 儲蓄目標 / 花費
- **Segmented Control:** 月預算總覽 / 現金流預測
- **FAB:** 右下角浮動 + 按鈕，展開三個選項
- **Touch targets:** 最小 44x44pt
- **Safe areas:** 尊重 iOS safe area insets

## Accessibility
- **Contrast:** 所有文字/背景組合符合 WCAG AA (4.5:1)
- **Touch targets:** 最小 44x44px
- **Screen reader:** 所有金額和進度條有 aria-label
- **Keyboard nav:** Tab 可以走過所有互動元素
- **Reduced motion:** 尊重 prefers-reduced-motion，關閉裝飾性動畫

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | 選定柔和水彩風格 | 使用者要求活潑可愛日系溫暖，從 6 個方案中選出 |
| 2026-03-29 | 融入 iOS HIG | 使用者要求 iOS 設計規範和動畫效果 |
| 2026-03-29 | Zen Maru Gothic 標題字型 | 圓潤可愛的日系字型，符合整體風格 |
| 2026-03-29 | 粉紅 #FF8A8A 為主重點色 | 柔和不刺眼，傳達溫暖可愛的感覺 |
