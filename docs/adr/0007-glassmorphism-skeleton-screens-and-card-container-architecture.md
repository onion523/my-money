# 0007. 溫暖水彩磨砂玻璃骨架屏與預渲染卡片容器架構 (Warm Watercolor Frosted Glass Skeleton Screens and Pre-rendered Card Architecture)

## Context
在對照主流設計系統（Apple iOS 18, Linear, Vercel, Shadcn UI）與排查線上正式機骨架屏時，發現以下問題：
1. **線上正式機動畫撞名飄移 Bug**：`web/src/index.css` 第 429 行與第 753 行重複宣告 `.skeleton` 與 `@keyframes shimmer`。由於 CSS keyframe 後者覆蓋前者，導致 `transform: translateX(100%)` 被直接套用至整個骨架 DOM 容器本身，骨架屏長條與卡片整塊向右滑走飄移，而非內部微光掃過。
2. **舊版冷灰生硬與主題割裂**：舊版骨架底色為 `rgba(0, 0, 0, 0.06)` 冷灰，光暈為垂直 90 度平推白光，在專案「日系溫暖水彩（Soft Watercolor, 主色 `#FF8A8A`、背景 `#FFF5F5`）」下呈現如死灰水泥塊，缺乏層次與溫度。
3. **版面跳動 (CLS) 與視覺過渡需求**：非同步資料載入完成時，若容器邊界跳躍會產生等待焦慮，需規範 1:1 擬真卡片預渲染與無縫淡入過渡。

## Decision
1. **核心動態形式：樣式 3 磨砂玻璃液態波紋 (Glassmorphism Liquid Wave)**：
   - 採用半透明雙峰果凍高光波紋：`linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.35) 30%, rgba(255, 255, 255, 0.85) 50%, rgba(255, 255, 255, 0.35) 70%, transparent 100%)`。
   - 動態曲線：`animation: wave 1.6s ease-in-out infinite`。
   - 骨架元素嚴格維持容器靜態固定，微光僅限於 `::after` 偽元素內部循環滑動。
2. **色彩系統：選項 A 溫暖水彩果凍玻璃 (Warm Watercolor Frosted Glass)**：
   - **Light Mode**：底色採用 135° 櫻粉與香檳微暖雙漸層（`linear-gradient(135deg, rgba(255, 138, 138, 0.10) 0%, rgba(255, 212, 160, 0.08) 50%, rgba(0, 0, 0, 0.04) 100%)`），搭配 `backdrop-filter: blur(5px)` 毛玻璃模糊與 `border: 1px solid rgba(255, 138, 138, 0.12)` 水彩微邊框。
   - **Dark Mode**：底色自動適配為深紫夜幕微漸層（`linear-gradient(135deg, rgba(255, 158, 158, 0.12) 0%, rgba(255, 212, 160, 0.06) 50%, rgba(255, 255, 255, 0.05) 100%)`），搭配粉紫微框 `rgba(255, 158, 158, 0.15)`。
3. **徹底根除正式機飄移衝突**：
   - 刪除第 429 行的舊版 `.skeleton` 與舊版 `@keyframes shimmer`，全站統一收斂於 `web/src/index.css` 後段單一規範。
4. **預渲染卡片容器架構 (Pre-rendered Card Framing)**：
   - 全頁骨架屏（Dashboard, Accounts, Family 等）外層保留真實白底卡片容器（`<div className="card">` / `<div className="stat-card">`），維持正式環境之水彩柔邊陰影（`--shadow-sm`）與圓角。
   - 資料載入完成後，內部真實內容以 `200ms` Crossfade 平滑淡入，達成累積版面位移 `CLS = 0`。

## Consequences
- 徹底消除線上正式機骨架元素集體向右滑走漂移的嚴重 CSS 衝突 Bug。
- 骨架屏具備 Apple VisionOS / iOS 18 的毛玻璃通透果凍光感，同時完美融入日系溫暖水彩的品牌調性。
- 進入頁面到數據抵達全程無閃爍、無跳動、零位移，載入體驗達到一線消費級產品水準。
