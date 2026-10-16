# 0026. Modal Scroll Architecture & Tiered Sizing (彈窗分層滾動與分級寬度架構)

Date: 2026-10-16

## Status
Accepted

## Context
在既有前端實作中，所有彈窗皆由 `web/src/components/Modal.tsx` 渲染，樣式由 `web/src/index.css` 之 `.modal-box` 定義。
在電腦版環境（尤其是 Windows Chrome / Edge / Firefox）下，使用者面臨以下兩個核心視覺與互動痛點：
1. **卷軸刺穿 24px 圓角邊框**：
   `.modal-box` 設定了較大圓角 `border-radius: var(--radius-xl)`（24px），同時在外框直接宣告 `overflow-y: auto; max-height: 90vh;`。當彈窗內容超過螢幕高度時，瀏覽器生成之矩形直角原生垂直卷軸直接穿透頂部與底部的 24px 圓角凸出於外框之外；右上角關閉按鈕（`margin-right: -8px`）亦受卷軸擠壓重疊。
2. **複雜明細彈窗寬度不足與雙重卷軸衝突**：
   「結帳日出帳作業預覽（Statement Rollover）」與「家庭代墊報銷清單（Advance Reimbursement）」預設套用單一 480px 寬度。其內部包含雙欄統計卡片、公私帳拆解以及內部清單（帶有自身 `maxHeight` 與 `overflowY: auto`），導致在電腦版上水平空間極度侷促，並出現「彈窗本體滾動」與「清單內部滾動」兩道垂直卷軸並存甚至衝突的窘境。

## Decision
1. **結構分層重構（Three-Tier Modal Frame）**：
   - **外框遮罩（`.modal-box`）**：
     - 維持 `border-radius: var(--radius-xl)`（24px），明確宣告 `overflow: hidden;`，作為外層圓角遮罩防線，徹底隔絕任何直角元素穿透。
     - 改採 `display: flex; flex-direction: column;` 控制內部縱向佈局。
     - 移除外框整體 padding，改由 Header 與 Body 各自內聚掌控。
   - **固定標題列（`.modal-header`）**：
     - 固定於彈窗頂端，不隨內容滾動，確保關閉按鈕永遠可見且位置固定。
     - 獨立配置內距（`padding: 20px 24px 14px 24px`），關閉按鈕不貼邊干擾卷軸。
   - **獨立滾動層（`.modal-body`）**：
     - 配置 `flex: 1; min-height: 0; overflow-y: auto;`。
     - 配置內距（`padding: 0 24px 24px 24px`）。
     - 設定 `scrollbar-gutter: stable;`，徹底消除卷軸出現時內容橫向跳動（Layout Shift）。
     - 電腦版下套用日系輕量 6px 細圓角半透明卷軸，與全站 Soft Watercolor 風格融合。

2. **電腦版彈窗分級寬度規範（Tiered Modal Sizing）**：
   - **小型確認/數值彈窗**：`maxWidth: 400px`（如預算設定、存入儲蓄目標）。
   - **標準表單彈窗**：`maxWidth: 540px`（預設值，由 480px 提升至 540px，如新增/編輯帳戶、轉帳、信用卡還款、快速記帳、新增週期性收支、目標設定等，確保各類帳戶選單文字不截斷）。
   - **複雜明細與清單彈窗**：`maxWidth: 720px`（如「結帳日出帳作業預覽」與「家庭代墊報銷清單」，由 640px 提升至 720px），給予充裕橫向空間展示多欄統計與公私拆解，並移除內部不必要之微型嵌套卷軸，由 `modal-body` 統一平滑滾動。
   - **還款快捷按鈕滿寬排版**：信用卡繳費彈窗之快捷金額標籤抽離至金額與日期網格下方作為獨立整行（Full-width），不再擠壓於單一欄位內。
   - **明細備註自然換行**：出帳預覽等清單之收支備註解除 `nowrap` 與 `ellipsis` 單行強制截斷，採 `wordBreak: break-word` 自然多行呈現，完整展現備註內容。

3. **行動端 RWD 完美繼承**：
   - 在 `<= 640px` 視窗下，所有彈窗自動轉換為 100% 滿寬之底部抽屜（Bottom Sheet），`border-radius: 20px 20px 0 0`，內部 `.modal-body` 繼承獨立滾動並套用 `-webkit-overflow-scrolling: touch;` 與底部安全區。

## Consequences
- 徹底消除電腦版彈窗卷軸刺穿 24px 圓角的視覺瑕疵，關閉按鈕不再與卷軸緊貼打架。
- 解決內容超過高度時的橫向跳動問題，提升滾動流暢感與日系視覺精緻度。
- 標準表單提升至 540px，徹底消除各類「帳戶名稱＋餘額」長選單截斷與網格擁擠；寬版 720px 徹底解放複雜清單（出帳預覽、代墊報銷），消滅嵌套雙重卷軸，同時手機版無縫降級為滿寬 Bottom Sheet。
- 還款快捷標籤獨立成行，清晰直覺；交易備註自然換行，完整可讀不被截斷。
