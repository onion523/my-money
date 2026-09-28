# 0003. 全站骨架屏架構與載入體驗規範 (Skeleton Screen Architecture and Loading States)

## Context
過去前端系統在非同步載入資料期間：
1. 部分頁面直接使用文字「載入家庭資料中...」或局部的「轉圈 spinner」，風格不統一且無法預覽真實頁面版型。
2. 多數頁面（如 Dashboard, Accounts, Analytics, Forecast, Goals, Recurring）雖然定義了 `loading` 狀態，但未於 JSX 中渲染佔位 UI，導致資料回傳前頁面空白或數據閃爍跳動（Cumulative Layout Shift, CLS）。
3. 需建立一套兼顧質感、現代動效與無縫過渡的全站骨架屏規範。

## Decision
1. **原子骨架基底組件與頁面專屬版型客製**：
   - 封裝通用的原子骨架組件 `<Skeleton variant="text|rect|circle" />`，支援寬度、高度與圓角客製。
   - 針對專案 9 大主頁面（Dashboard, Transactions, Accounts, Analytics, Family, Recurring, Goals, Forecast, BotIntegration）建立 1:1 貼合真實佈局的專屬骨架屏，徹底杜絕 CLS 版面跳動。
2. **流動微光動效 (Shimmer Effect)**：
   - 採用 45 度線性漸變高光自左向右循環滑動的 CSS 微光動畫，透過 CSS 變數自動適配淺色 (Soft Watercolor) 與深色主題。
3. **區隔「初次載入」與「二次篩選過渡」**：
   - **初次進入 (Initial Mount)**：渲染完整頁面骨架屏。
   - **同頁二次篩選 (Refetch on Filter/Month Switch)**：保留當前內容並覆蓋輕量過渡微光，避免全頁反覆被骨架覆蓋而造成視覺閃爍。
4. **自然平滑淡入過渡 (Crossfade)**：
   - 資料載入完成後採用自然平滑的 CSS 淡入過渡 (200~250ms)，在極速網路環境下既不卡鈍亦無突兀割裂感。
5. **集中收斂於組件庫**：
   - 所有骨架屏相關組件與頁面骨架統一收斂於 `web/src/components/Skeleton.tsx` 導出，保持引用路徑一致清晰。

## Consequences
- 全站各頁面載入體驗達成一致的視覺規格與流暢回饋。
- 解決初次載入空窗期與數值跳動問題，顯著提升整體 UI 精緻度。
