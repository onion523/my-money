import { BudgetsSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import {
  txApi,
  budgetsApi,
  TOTAL_BUDGET_CATEGORY,
  CategorySummary,
  BudgetWithSpent,
  BudgetSummary,
} from '../api/client'
import {
  formatCurrency,
  thisMonth,
  CATEGORIES,
} from '../components/utils'
import { CategoryIcon } from '../components/icons'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
import {
  AlertCircle,
  Sliders,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Home,
  Lock,
  Trash2,
  RefreshCw,
  Plus,
  Filter,
} from 'lucide-react'

type BudgetFilterTab = 'all' | 'configured' | 'alert' | 'unconfigured'

export default function Budgets() {
  const [currentMonth, setCurrentMonth] = useState(thisMonth())
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const [filterTab, setFilterTab] = useState<BudgetFilterTab>('all')
  const [catSummary, setCatSummary] = useState<CategorySummary[]>([])
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 預算設定 Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string>('餐飲')
  const [budgetIsShared, setBudgetIsShared] = useState<0 | 1>(0)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [submittingBudget, setSubmittingBudget] = useState(false)

  const loadData = async (month: string = currentMonth, currentScope: 'all' | 'household' | 'personal' = scope) => {
    try {
      setLoading(true)
      setLoadError(null)
      const [sum, budsRes] = await Promise.all([
        txApi.summary(month, currentScope),
        budgetsApi.listWithSummary(month, currentScope),
      ])
      setCatSummary(sum)
      setBudgets(budsRes.items)
      setBudgetSummary(budsRes.summary)
    } catch (e: any) {
      console.error('Failed to load budgets data:', e)
      setLoadError(e.message || '預算資料載入失敗，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(currentMonth, scope)
  }, [currentMonth, scope])

  const totalExpense = catSummary.reduce((s, c) => s + c.total, 0)

  const getExistingLayerBudgetAmount = (cat: string, isShared: 0 | 1): number => {
    if (cat === TOTAL_BUDGET_CATEGORY) {
      if (!budgetSummary) return 0
      return isShared === 1
        ? (budgetSummary.shared_manual_total_budget || 0)
        : (budgetSummary.personal_manual_total_budget || 0)
    }
    const b = budgets.find(bg => bg.category === cat)
    if (!b) return 0
    if (scope === 'household') return isShared === 1 ? b.amount : (b.personal_amount || 0)
    if (scope === 'personal') return isShared === 0 ? b.amount : (b.shared_amount || 0)
    return isShared === 1 ? (b.shared_amount ?? 0) : (b.personal_amount ?? 0)
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(budgetAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('請輸入有效預算金額')
      return
    }

    try {
      setSubmittingBudget(true)
      await budgetsApi.upsert({
        category: selectedCat,
        amount: amt,
        month: 'default',
        is_shared: budgetIsShared,
      })
      setShowBudgetModal(false)
      setBudgetAmount('')
      loadData(currentMonth, scope)
    } catch (err: any) {
      alert(err.message || '預算設定失敗')
    } finally {
      setSubmittingBudget(false)
    }
  }

  const handleClearBudget = async () => {
    try {
      setSubmittingBudget(true)
      await budgetsApi.remove(selectedCat, budgetIsShared)
      setShowBudgetModal(false)
      setBudgetAmount('')
      loadData(currentMonth, scope)
    } catch (err: any) {
      alert(err.message || '清除預算失敗')
    } finally {
      setSubmittingBudget(false)
    }
  }

  const openBudgetDialog = (cat: string, preferredIsShared?: 0 | 1) => {
    const defaultLayer: 0 | 1 =
      preferredIsShared !== undefined
        ? preferredIsShared
        : scope === 'household'
        ? 1
        : 0
    setSelectedCat(cat)
    setBudgetIsShared(defaultLayer)
    const existingAmt = getExistingLayerBudgetAmount(cat, defaultLayer)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (cat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
    setShowBudgetModal(true)
  }

  const handleSwitchBudgetLayer = (nextLayer: 0 | 1) => {
    setBudgetIsShared(nextLayer)
    const existingAmt = getExistingLayerBudgetAmount(selectedCat, nextLayer)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (selectedCat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
  }

  const handleSwitchBudgetCategory = (nextCat: string) => {
    setSelectedCat(nextCat)
    const existingAmt = getExistingLayerBudgetAmount(nextCat, budgetIsShared)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (nextCat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
  }

  if (loading && !budgetSummary) {
    return <BudgetsSkeleton />
  }

  const effTotal = budgetSummary?.effective_total_budget ?? budgets.reduce((s, b) => s + (b.amount || 0), 0)
  const manualTotal = budgetSummary?.manual_total_budget ?? 0
  const personalManualTotal = budgetSummary?.personal_manual_total_budget ?? 0
  const sharedManualTotal = budgetSummary?.shared_manual_total_budget ?? 0
  const catSum = budgetSummary?.category_budget_sum ?? budgets.reduce((s, b) => s + (b.amount || 0), 0)
  const spentTotal = budgetSummary?.total_spent ?? totalExpense
  const remTotal = Math.max(0, effTotal - spentTotal)
  const isOverTotal = effTotal > 0 && spentTotal > effTotal
  const isWarnTotal = effTotal > 0 && !isOverTotal && spentTotal / effTotal >= 0.8
  const pctTotal = effTotal > 0 ? Math.round((spentTotal / effTotal) * 100) : 0

  // 整理 16 項標準分類之預算與花費狀態
  const enrichedCategories = CATEGORIES.expense.map(cat => {
    const b = budgets.find(bg => bg.category === cat)
    const spent = b ? b.spent : (catSummary.find(cs => cs.category === cat)?.total || 0)
    const amount = b?.amount || 0
    const hasBudget = Boolean(b && amount > 0)
    const isOver = hasBudget && spent > amount
    const isWarn = hasBudget && !isOver && spent / amount >= 0.8
    const personalAmt = b?.personal_amount || 0
    const sharedAmt = b?.shared_amount || 0
    return {
      cat,
      spent,
      amount,
      hasBudget,
      isOver,
      isWarn,
      personalAmt,
      sharedAmt,
    }
  })

  const configuredCount = enrichedCategories.filter(c => c.hasBudget).length
  const alertCount = enrichedCategories.filter(c => c.isOver || c.isWarn).length
  const unconfiguredCount = enrichedCategories.filter(c => !c.hasBudget).length

  const filteredCategories = enrichedCategories.filter(c => {
    if (filterTab === 'configured') return c.hasBudget
    if (filterTab === 'alert') return c.isOver || c.isWarn
    if (filterTab === 'unconfigured') return !c.hasBudget
    return true
  })

  return (
    <div className="fade-in">
      {loadError && (
        <div className="alert alert-danger flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span><strong>預算資料載入失敗</strong>：{loadError}</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadData(currentMonth, scope)}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            重新嘗試
          </button>
        </div>
      )}

      {/* 頂部標題與月份／操作按鈕 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>預算管理</span>
            <Sliders size={24} style={{ color: 'var(--color-primary)' }} />
          </h1>
          <p className="page-subtitle">
            設定一次即跨月常駐生效，區分公私帳把關日常消費，並自動於真實可支配現金預留當月剩餘預算
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="flex items-center gap-xs">
            <Calendar size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              id="budget-month-picker"
              className="input analytics-month-input"
              type="month"
              value={currentMonth}
              onChange={e => setCurrentMonth(e.target.value)}
            />
          </div>
          <button
            type="button"
            id="btn-set-total-budget"
            className="btn btn-secondary"
            onClick={() => openBudgetDialog(TOTAL_BUDGET_CATEGORY)}
          >
            <Sliders size={16} />
            <span>設定每月總預算</span>
          </button>
          <button
            type="button"
            id="btn-set-category-budget"
            className="btn btn-primary"
            onClick={() => openBudgetDialog(CATEGORIES.expense[0])}
          >
            <Plus size={16} />
            <span>設定分類預算</span>
          </button>
        </div>
      </div>

      {/* 三態帳本視角切換器 */}
      <div style={{ marginBottom: 20 }}>
        <ScopeTabBar scope={scope} onChange={setScope} />
      </div>

      {/* 三大核心預算統計卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">
            <span>每月有效總預算 ({scope === 'household' ? '公帳' : scope === 'personal' ? '私帳' : '全部'})</span>
            <FormulaTooltip
              label="檢視每月有效總預算計算公式"
              formula="每月有效總預算 ＝ max(手動設定每月總預算, ∑ 已設定之各分類預算總和)"
              calculation={`max(手動總預算 ${formatCurrency(manualTotal)}, 分類預算加總 ${formatCurrency(catSum)}) = ${formatCurrency(effTotal)}`}
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {effTotal > 0 ? formatCurrency(effTotal) : '未設定'}
          </div>
          <div className="stat-sub">
            {effTotal > 0
              ? manualTotal >= catSum && manualTotal > 0
                ? `依手動總預算上限（已設 ${configuredCount} 項分類合計 ${formatCurrency(catSum)}）`
                : `依 ${configuredCount} 項已設分類預算自動加總`
              : '點擊右上角設定常駐每月總預算或分類預算'}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <span>{currentMonth} 日常消費已花</span>
            <FormulaTooltip
              label="檢視當月日常消費已花計算公式"
              formula="當月日常消費已花 ＝ ∑ 16 項標準消費分類支出（嚴格排除信用卡還款、內部轉帳、ATM 提款與公帳代墊報銷）"
              calculation={
                catSummary.length > 0
                  ? `${catSummary.map(c => `${c.category} ${formatCurrency(c.total)}`).join(' + ')} = ${formatCurrency(spentTotal)}`
                  : `本月尚無日常消費支出 = ${formatCurrency(0)}`
              }
            />
          </span>
          <div
            className="stat-value"
            style={{
              color: isOverTotal
                ? 'var(--color-danger)'
                : isWarnTotal
                ? 'var(--color-warning)'
                : 'var(--text-primary)',
            }}
          >
            {formatCurrency(spentTotal)}
          </div>
          <div className="stat-sub">
            {effTotal > 0
              ? `佔有效總預算 ${pctTotal}%（${isOverTotal ? '已超出總預算' : isWarnTotal ? '已達 80% 警戒線' : '花費進度安全'}）`
              : '尚未設定總預算基準'}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface-2)' }}>
          <span className="stat-label">
            <span>{isOverTotal ? '本月總預算已超支' : '本月剩餘可花費額度'}</span>
            <FormulaTooltip
              label="檢視本月剩餘可花費額度計算公式"
              formula="本月剩餘可花費 ＝ max(0, 每月有效總預算 － 當月日常消費已花)；此剩餘額度自動於「真實可支配現金」預留，不與已花消費重複雙扣"
              calculation={`${formatCurrency(effTotal)} - ${formatCurrency(spentTotal)} = ${isOverTotal ? `超支 ${formatCurrency(spentTotal - effTotal)}` : `剩餘可花 ${formatCurrency(remTotal)}`}`}
            />
          </span>
          <div
            className="stat-value"
            style={{
              color: isOverTotal
                ? 'var(--color-danger)'
                : effTotal > 0
                ? 'var(--color-success)'
                : 'var(--text-muted)',
            }}
          >
            {effTotal > 0
              ? isOverTotal
                ? `-${formatCurrency(spentTotal - effTotal)}`
                : formatCurrency(remTotal)
              : '—'}
          </div>
          <div className="stat-sub">
            {effTotal > 0
              ? isOverTotal
                ? `已超出有效總預算 ${formatCurrency(spentTotal - effTotal)}，請留意後續開支`
                : '已自動從「真實可支配現金」預留此筆待花費預算'
              : '設定預算後自動計算當月剩餘可花費水位'}
          </div>
        </div>
      </div>

      {/* 每月總預算進度總覽大卡 */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          borderLeft: `5px solid ${
            isOverTotal
              ? 'var(--color-danger)'
              : isWarnTotal
              ? 'var(--color-warning)'
              : 'var(--color-primary)'
          }`,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <h2 className="text-lg" style={{ margin: 0, fontWeight: 700 }}>
              {currentMonth} 總預算執行進度
            </h2>
            {effTotal > 0 && (
              <span
                className="badge"
                style={{
                  fontSize: '0.7rem',
                  background: 'var(--bg-surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RefreshCw size={11} /> 常駐每月自動沿用
              </span>
            )}
            {scope === 'all' && (sharedManualTotal > 0 || personalManualTotal > 0) && (
              <>
                {sharedManualTotal > 0 && (
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Home size={11} /> 公帳總預算 {formatCurrency(sharedManualTotal)}
                  </span>
                )}
                {personalManualTotal > 0 && (
                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Lock size={11} /> 私帳總預算 {formatCurrency(personalManualTotal)}
                  </span>
                )}
              </>
            )}
            {isOverTotal ? (
              <span className="badge badge-expense flex items-center gap-xs">
                <AlertTriangle size={12} /> 超支 {formatCurrency(spentTotal - effTotal)}
              </span>
            ) : effTotal > 0 ? (
              <span className="badge badge-income flex items-center gap-xs">
                <CheckCircle2 size={12} /> 執行率 {pctTotal}%
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            onClick={() => openBudgetDialog(TOTAL_BUDGET_CATEGORY)}
          >
            {manualTotal > 0 ? '調整每月總預算' : '+ 設定每月總預算'}
          </button>
        </div>

        {effTotal > 0 ? (
          <>
            <ProgressBar
              value={spentTotal}
              max={effTotal}
              variant={isOverTotal ? 'over' : isWarnTotal ? 'default' : 'safe'}
              height={12}
            />
            <div className="flex items-center justify-between text-xs text-secondary" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
              <span>
                已花費 <strong>{formatCurrency(spentTotal)}</strong> / 有效總預算 <strong>{formatCurrency(effTotal)}</strong>
              </span>
              <span>
                {isOverTotal
                  ? `超支 ${formatCurrency(spentTotal - effTotal)}`
                  : `尚餘 ${formatCurrency(remTotal)} 可用`}
              </span>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted">
            尚未設定任何總預算或分類預算。點擊「+ 設定每月總預算」或下方任一分類的「+ 設定」，系統將自動跨月常駐把關。
          </div>
        )}
      </div>

      {/* 四態分類預算篩選頁籤 (行動端 <=640px 自動 2x2 雙欄等寬網格) */}
      <div className="account-category-tab-bar" role="tablist" aria-label="預算分類篩選" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'all'}
          className={`account-category-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          <Filter size={15} />
          <span>全部分類 ({enrichedCategories.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'configured'}
          className={`account-category-tab-btn ${filterTab === 'configured' ? 'active' : ''}`}
          onClick={() => setFilterTab('configured')}
        >
          <CheckCircle2 size={15} />
          <span>已設預算 ({configuredCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'alert'}
          className={`account-category-tab-btn ${filterTab === 'alert' ? 'active' : ''}`}
          onClick={() => setFilterTab('alert')}
        >
          <AlertTriangle size={15} />
          <span>超支 / 警戒 ({alertCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'unconfigured'}
          className={`account-category-tab-btn ${filterTab === 'unconfigured' ? 'active' : ''}`}
          onClick={() => setFilterTab('unconfigured')}
        >
          <Plus size={15} />
          <span>未設預算 ({unconfiguredCount})</span>
        </button>
      </div>

      {/* 分類預算進度卡片清單 */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="text-xl flex items-center gap-xs" style={{ margin: 0 }}>
            <Sliders size={20} color="var(--color-primary)" />
            <span>各分類預算明細 ({filteredCategories.length})</span>
          </h2>
          <span className="text-xs text-muted">
            點擊任一分類右側「+ 設定」或「調整」可設定公帳／私帳常駐預算
          </span>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="emoji"><Sliders size={38} /></div>
            <h3>此篩選條件下尚無分類項目</h3>
            <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>
              {filterTab === 'configured'
                ? '目前尚未為任何消費分類設定預算上限'
                : filterTab === 'alert'
                ? '太棒了！目前沒有任何分類達到 80% 警戒或超支'
                : '所有分類皆已設定預算'}
            </p>
            {filterTab !== 'all' && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilterTab('all')}>
                檢視全部分類
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredCategories.map(({ cat, spent, amount, hasBudget, isOver, isWarn, personalAmt, sharedAmt }) => {
              const pct = hasBudget && amount > 0 ? Math.round((spent / amount) * 100) : 0
              return (
                <div
                  key={cat}
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    background: isOver
                      ? 'rgba(255,107,107,0.06)'
                      : isWarn
                      ? 'rgba(247,185,85,0.08)'
                      : 'var(--bg-surface-2)',
                    border: isOver
                      ? '1px solid var(--color-danger)'
                      : isWarn
                      ? '1px solid var(--color-warning)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  <div className="budget-item-header">
                    <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: 'rgba(255,138,138,0.12)',
                          color: 'var(--color-primary)',
                          flexShrink: 0,
                        }}
                      >
                        <CategoryIcon category={cat} size={16} />
                      </span>
                      <span style={{ fontWeight: 600 }}>{cat}</span>
                      {hasBudget && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.68rem',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <RefreshCw size={10} /> 常駐每月 · {pct}%
                        </span>
                      )}
                      {scope === 'all' && hasBudget && (
                        <>
                          {sharedAmt > 0 && (
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Home size={10} /> 公帳 {formatCurrency(sharedAmt)}
                            </span>
                          )}
                          {personalAmt > 0 && (
                            <span className="badge badge-secondary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Lock size={10} /> 私帳 {formatCurrency(personalAmt)}
                            </span>
                          )}
                        </>
                      )}
                      {isOver && (
                        <span className="badge badge-expense flex items-center gap-xs">
                          <AlertTriangle size={12} /> 超支 {formatCurrency(spent - amount)}
                        </span>
                      )}
                      {isWarn && (
                        <span
                          className="badge flex items-center gap-xs"
                          style={{
                            background: 'rgba(247, 185, 85, 0.18)',
                            color: 'var(--color-warning)',
                            border: '1px solid rgba(247, 185, 85, 0.45)',
                            fontSize: '0.7rem',
                          }}
                        >
                          <AlertTriangle size={11} /> 接近上限
                        </span>
                      )}
                    </div>

                    <div className="budget-item-meta">
                      <div className="budget-item-amounts">
                        已花 <strong>{formatCurrency(spent)}</strong>
                        {hasBudget ? (
                          <span className="text-muted">
                            {' '}/ 預算 {formatCurrency(amount)}（{isOver ? `超支 ${formatCurrency(spent - amount)}` : `剩餘 ${formatCurrency(amount - spent)}`}）
                          </span>
                        ) : (
                          <span className="text-muted"> (未設定預算)</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.78rem', padding: '4px 10px', flexShrink: 0, border: '1px solid var(--border-color)' }}
                        onClick={() =>
                          openBudgetDialog(
                            cat,
                            scope === 'household' ? 1 : scope === 'personal' ? 0 : (sharedAmt > 0 && personalAmt === 0 ? 1 : 0)
                          )
                        }
                      >
                        {hasBudget ? '調整' : '+ 設定'}
                      </button>
                    </div>
                  </div>

                  {hasBudget ? (
                    <ProgressBar
                      value={spent}
                      max={amount}
                      variant={isOver ? 'over' : isWarn ? 'default' : 'safe'}
                      height={8}
                    />
                  ) : (
                    <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 9999, opacity: 0.5 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 預算設定彈窗 */}
      {showBudgetModal && (
        <Modal
          title={selectedCat === TOTAL_BUDGET_CATEGORY ? '設定每月總預算上限' : `設定「${selectedCat}」每月常駐預算`}
          onClose={() => setShowBudgetModal(false)}
          maxWidth={440}
        >
          <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 預算項目選擇 */}
            <div className="input-group">
              <label className="input-label">預算項目</label>
              <select
                className="input"
                value={selectedCat}
                onChange={e => handleSwitchBudgetCategory(e.target.value)}
              >
                <option value={TOTAL_BUDGET_CATEGORY}>每月總預算上限（全分類總和把關）</option>
                {CATEGORIES.expense.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 帳本歸屬選擇 (私帳 / 公帳) */}
            <div className="input-group">
              <label className="input-label">預算歸屬</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${budgetIsShared === 0 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: budgetIsShared === 0 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => handleSwitchBudgetLayer(0)}
                >
                  <Lock size={14} />
                  <span>私帳預算</span>
                </button>
                <button
                  type="button"
                  className={`btn ${budgetIsShared === 1 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: budgetIsShared === 1 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => handleSwitchBudgetLayer(1)}
                >
                  <Home size={14} />
                  <span>公帳預算</span>
                </button>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                {budgetIsShared === 1
                  ? '家庭公帳預算：全體家庭成員共享檢視並協作共管，專門把關家庭公帳日常開銷。'
                  : '個人私帳預算：僅您本人可見，把關個人私帳日常消費；於「全部」視角將與公帳預算自動相加。'}
              </p>
            </div>

            {/* 每月常駐預算金額 */}
            <div className="input-group">
              <label className="input-label">每月常駐預算上限 (NT$)</label>
              <input
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder={selectedCat === TOTAL_BUDGET_CATEGORY ? '例如 30000' : '例如 8000'}
                required
                autoFocus
                value={budgetAmount}
                onChange={e => setBudgetAmount(e.target.value)}
              />
              <span className="text-xs text-muted" style={{ marginTop: 4 }}>
                設定後將作為每月常駐預設值自動跨月沿用，無須每個月重新設定。
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
              {getExistingLayerBudgetAmount(selectedCat, budgetIsShared) > 0 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px' }}
                  disabled={submittingBudget}
                  onClick={handleClearBudget}
                >
                  <Trash2 size={16} />
                  <span>清除此項預算</span>
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submittingBudget}
                style={{ flex: 1 }}
              >
                {submittingBudget ? '儲存中...' : '確認儲存常駐預算'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
