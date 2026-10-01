# 0012. 週期收支確切繳費時程與精準現金流預測對齊 (Exact Recurring Schedules and Cash Flow Forecast Alignment)

## Status
Accepted

## Context
系統過去在處理週期收支（Recurring Items）的繳費時機與 30 天現金流模擬預測（Forecast）時，存在以下架構缺陷與體驗盲區：
1. **後端預測公式過度簡化且寫死倍數**：
   在 `forecast.ts` 中，判斷週期項目是否觸發僅透過 `month % cycleMonths === 0`：
   - 雙月繳（`bimonthly`）：只在偶數月（2、4、6、8、10、12）觸發，單數月的水電費直接被忽略。
   - 季繳（`quarterly`）：只在 3、6、9、12 月觸發，無法對齊 1/4/7/10 或 2/5/8/11 月起算的帳單。
   - 半年繳（`semiannual`）：只在 6、12 月觸發。
   - 年繳（`annual`）：只在 12 月觸發；若使用者設定 5 月綜合所得稅或牌照稅，整年的現金流預測完全失靈。
2. **資料庫與前端介面缺乏月份維度**：
   資料表 `recurring_items` 僅有 `cycle` 與 `day_of_cycle`（1~31 號），前端卡片不論週期一律死板標註「每月 X 號扣款」，使用者無從輸入或得知確切繳費月份。
3. **月底天數邊界缺失**：
   若扣款日設為 31 號，在遇到 30 天的小月（4、6、9、11 月）或 28/29 天的二月時，舊邏輯因無 31 號而直接漏算該期金額。

## Decision

經過訪談對齊（`grill-with-docs`），確立「**確切週期繳費排程 (Exact Recurring Schedule)**」與精準現金流模擬架構：

### 1. 資料模型擴充 (Schema Extension)
- 資料表 `recurring_items` 新增欄位：
  `month_of_cycle INTEGER NOT NULL DEFAULT 1`
- **歷史資料向下相容**：現有已存在的歷史週期項目統一預設為 `1`（雙月為單數月、季繳為 1/4/7/10月、半年為 1/7月、年繳為 1月），使用者後續隨時可點開卡片編輯變更。

### 2. 週期自適應動態語意選單 (Adaptive Month Selector)
前端新增與編輯彈窗依據選取的 `cycle` 動態切換顯示直觀語意選單：
- **月繳 (`monthly`)**：隱藏月份下拉，僅輸入「扣款日（每月 1~31 號）」。
- **雙月繳 (`bimonthly`)**：提供【單數月（1、3、5、7、9、11月）】與【雙數月（2、4、6、8、10、12月）】二選一（分別儲存為 `month_of_cycle` = 1 或 2）。
- **季繳 (`quarterly`)**：提供【1、4、7、10 月】、【2、5、8、11 月】、【3、6、9、12 月】三選一（儲存為 1、2、3）。
- **半年繳 (`semiannual`)**：提供【1、7 月】、【2、8 月】、【3、9 月】、【4、10 月】、【5、11 月】、【6、12 月】六選一（儲存為 1~6）。
- **年繳 (`annual`)**：提供【1 月】至【12 月】十二選一（儲存為 1~12）。

### 3. 月底天數自動平貼機制 (End-of-Month Clamping)
- 在現金流模擬預測與觸發比對中，若設定之 `day_of_cycle` 大於該月份的最大實際天數（例如 31 號遇 4 月或 2 月），系統自動將目標扣款日對齊（clamp）至該月份的最後一日（即 4/30、2/28 或 2/29）。
- 確保該期收支 100% 精準留在所屬月份完成模擬，不漏算亦不跨月推遲。

### 4. 精準現金流預測觸發演算法 (Deterministic Cash Flow Forecast)
後端 `getDaysInForecast` 全面替換原有的 `month % cycleM === 0`，改為支援跨年度滾動與確定性週期比對：
```ts
const cycleInterval = CYCLE_MONTHS[item.cycle] || 1;
const monthDiff = (month - (item.month_of_cycle || 1));
const isCycleMonth = ((monthDiff % cycleInterval) + cycleInterval) % cycleInterval === 0;

const maxDayInMonth = new Date(dayObj.year, month, 0).getDate();
const targetDay = Math.min(item.day_of_cycle, maxDayInMonth);

if (isCycleMonth && dom === targetDay) {
  events.push({ date: dayObj.dateStr, name: item.name, type: item.type, amount: item.amount });
}
```

### 5. 卡片與匯出展示全面語意化 (Card Display & CSV Export Alignment)
- 卡片排版上的標籤根據週期與月份動態呈現：
  - 月繳：`每月 15 號扣款`
  - 雙月繳：`單數月 15 號扣款` 或 `雙數月 15 號扣款`
  - 季繳：`每季 (1/4/7/10月) 15 號扣款`
  - 半年繳：`每半年 (1/7月) 15 號扣款`
  - 年繳：`每年 5 月 15 號扣款`
  *(收入項目對應為 `...入帳`)*
- CSV 匯出欄位亦同步輸出該週期規則格式，不再死板輸出「每月第 X 天」。

## Consequences
- **優點**：
  1. 現金流預測準確度達到 100%，徹底解決雙月單數月水電費、季繳學費、年繳牌照稅與綜所稅漏算之長年痛點。
  2. 介面語意化直觀親切，使用者設定雙月或季繳時無需自行心算起算月份。
  3. 月底天數平貼機制杜絕大小月扣款日失效問題。
- **缺點與因應**：
  - 資料庫需執行 D1 schema migration（`ALTER TABLE recurring_items ADD COLUMN month_of_cycle INTEGER NOT NULL DEFAULT 1`）。
