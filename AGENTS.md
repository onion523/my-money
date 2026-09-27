# Agent Guidelines & Project Memory

遵照 [mattpocock/skills](https://github.com/mattpocock/skills) 流程規範與本專案工作流準則。

## 1. `grill-with-docs` 與 `grilling` 執行界限

- **嚴格屬於「規格與設計對齊」階段，絕非「實作階段」**：
  `grilling` 與 `grill-with-docs` 的唯一任務是透過訪談釐清需求分支、建立設計樹、補齊領域模型文檔（更新 `CONTEXT.md` 或撰寫 ADR）。
- **訪談結束後絕不可直接動手實作**：
  當訪談的設計樹 frontier 耗盡、雙方達成共識時：
  1. 確認 `CONTEXT.md`（及 ADR）之名詞與規格已更新到位。
  2. 輸出最終共識與決策摘要。
  3. **立即停止（STOP）**。嚴禁未經指示自動開始寫代碼、修改專案檔案或調用開發腳本。
  4. 等待使用者主動下達實作指令（例如下達「開始實作」、調用 `/tdd` 或確認排程）後，方可進入開發階段。

## 2. 訪談互動模式

- **一題一題提問**：訪談過程維持「一次問一個問題」，待使用者回覆後再推進下一層決策，嚴禁一次拋出多個問題造成認知負載。

## 3. 本地優先與部署防線

- **100% 本地先驗證**：所有功能修改必須先於本機環境（前端 `http://localhost:5173`、後端 `http://127.0.0.1:8787`）完成自動化或端對端測試。
- **未經確認絕不部署**：嚴禁在未獲得使用者明確確認前，擅自 `git push` 至遠端（如 `master`）或發布至正式機（Cloudflare Pages / Workers）。

## Agent skills

### Issue tracker

Issues and specs are tracked via GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout rooted at `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
