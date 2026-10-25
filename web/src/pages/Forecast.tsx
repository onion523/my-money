import { ForecastSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { forecastApi, ForecastResult, PurchaseCheckResult, DayEvent } from '../api/client'
import { formatCurrency, formatDate } from '../components/utils'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Circle,
  RotateCcw,
  Home,
  Lock,
  HelpCircle,
  ShoppingCart,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'

interface OverdraftInterval {
  key: string
  startDate: string
  endDate: string
  daysCount: number
  minBalance: number
  minDate: string
  triggerEvents: string[]
}

function computeOverdraftIntervals(
  dailyList: Array<{ date: string; balance: number; events: DayEvent[] }>
): OverdraftInterval[] {
  const intervals: OverdraftInterval[] = []
  let current: OverdraftInterval | null = null

  for (const d of dailyList) {
    if (d.balance < 0) {
      if (!current) {
        const activeExpenses = (d.events || [])
          .filter(ev => !ev.is_settled && ev.type !== 'income')
          .map(ev => `${ev.name} (-${formatCurrency(ev.amount)})`)
        const triggers =
          activeExpenses.length > 0
            ? activeExpenses
            : ['起始可用餘額不足（尚無當日新增扣款）']
        current = {
          key: d.date,
          startDate: d.date,
          endDate: d.date,
          daysCount: 1,
          minBalance: d.balance,
          minDate: d.date,
          triggerEvents: triggers,
        }
      } else {
        current.endDate = d.date
        current.key = `${current.startDate}_${d.date}`
        current.daysCount += 1
        if (d.balance < current.minBalance) {
          current.minBalance = d.balance
          current.minDate = d.date
        }
      }
    } else if (current) {
      intervals.push(current)
      current = null
    }
  }
  if (current) {
    intervals.push(current)
  }
  return intervals
}

export default function Forecast() {
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [settlingKey, setSettlingKey] = useState<string | null>(null)

  // 日期區間查詢狀態（預設空字串代表完整 12 個月區間）
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [focusedIntervalKey, setFocusedIntervalKey] = useState<string | null>(null)

  // 購買力檢查狀態
  const [checkAmount, setCheckAmount] = useState('')
  const [checkResult, setCheckResult] = useState<PurchaseCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')

  const loadForecast = async (targetScope: 'all' | 'household' | 'personal' = scope) => {
    try {
      setLoading(true)
      const data = await forecastApi.get(targetScope)
      setForecast(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadForecast(scope)
    if (checkAmount) {
      const amt = parseFloat(checkAmount)
      if (!isNaN(amt) && amt > 0) {
        forecastApi.purchaseCheck(amt, scope)
          .then(res => setCheckResult(res))
          .catch(() => {})
      }
    }
  }, [scope])

  const handleToggleSettle = async (ev: DayEvent) => {
    if (!ev.event_key || ev.can_settle === false || settlingKey) return
    try {
      setSettlingKey(ev.event_key)
      await forecastApi.toggleSettle(ev.event_key, !ev.is_settled)
      await loadForecast(scope)
      if (checkAmount) {
        const amt = parseFloat(checkAmount)
        if (!isNaN(amt) && amt > 0) {
          forecastApi.purchaseCheck(amt, scope)
            .then(res => setCheckResult(res))
            .catch(() => {})
        }
      }
    } catch (err: any) {
      alert(err.message || '更新已繳狀態失敗')
    } finally {
      setSettlingKey(null)
    }
  }

  const handlePurchaseCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    setCheckError('')
    const amt = parseFloat(checkAmount)
    if (isNaN(amt) || amt <= 0) {
      setCheckError('請輸入有效的購買金額')
      return
    }

    try {
      setChecking(true)
      const res = await forecastApi.purchaseCheck(amt, scope)
      setCheckResult(res)
    } catch (err: any) {
      setCheckError(err.message || '檢查失敗')
    } finally {
      setChecking(false)
    }
  }

  // 12 個月完整邊界與日期區間篩選計算
  const allDaily = forecast?.dailyBalances || []
  const minAvailableDate = allDaily[0]?.date || ''
  const maxAvailableDate = allDaily[allDaily.length - 1]?.date || ''

  const effectiveStart = startDate || minAvailableDate
  const effectiveEnd = endDate || maxAvailableDate
  const rangeStart = effectiveStart <= effectiveEnd ? effectiveStart : effectiveEnd
  const rangeEnd = effectiveStart <= effectiveEnd ? effectiveEnd : effectiveStart

  const isCustomRange =
    (Boolean(startDate) && startDate !== minAvailableDate) ||
    (Boolean(endDate) && endDate !== maxAvailableDate)
  const rangeTitlePrefix = isCustomRange ? '區間內' : '未來 12 個月'

  const filteredDailyBalances = allDaily.filter(
    d => (!rangeStart || d.date >= rangeStart) && (!rangeEnd || d.date <= rangeEnd)
  )

  // 為每筆排程事件確保具備逐筆累計結餘（running_balance，同日收入優先於支出）
  const eventsWithRunningBalance = (() => {
    const rawEvents = [...(forecast?.events || [])].sort((x, y) => {
      const dateDiff = x.date.localeCompare(y.date)
      if (dateDiff !== 0) return dateDiff
      if (x.type !== y.type) return x.type === 'income' ? -1 : 1
      return 0
    })
    let runningBal = forecast?.startingBalance ?? 0
    return rawEvents.map(ev => {
      if (!ev.is_settled) {
        runningBal += ev.type === 'income' ? ev.amount : -ev.amount
      }
      const computedBal = Math.round(runningBal * 100) / 100
      return {
        ...ev,
        running_balance: ev.running_balance !== undefined ? ev.running_balance : computedBal,
      }
    })
  })()

  const filteredEvents = eventsWithRunningBalance.filter(
    ev => (!rangeStart || ev.date >= rangeStart) && (!rangeEnd || ev.date <= rangeEnd)
  )

  // 透支區間計算（全期與目前區間）
  const allOverdraftIntervals = computeOverdraftIntervals(allDaily)
  const filteredOverdraftIntervals = computeOverdraftIntervals(filteredDailyBalances)
  const displayedOverdraftIntervals = focusedIntervalKey
    ? allOverdraftIntervals
    : filteredOverdraftIntervals
  const filteredOverdraftDays = filteredOverdraftIntervals.reduce((s, it) => s + it.daysCount, 0)
  const displayedOverdraftDays = displayedOverdraftIntervals.reduce((s, it) => s + it.daysCount, 0)

  let filteredMinBalance = forecast?.minBalance ?? 0
  let filteredMinDate = forecast?.minDate ?? ''
  if (filteredDailyBalances.length > 0) {
    filteredMinBalance = filteredDailyBalances[0].balance
    filteredMinDate = filteredDailyBalances[0].date
    for (const d of filteredDailyBalances) {
      if (d.balance < filteredMinBalance) {
        filteredMinBalance = d.balance
        filteredMinDate = d.date
      }
    }
  }
  const filteredWillOverdraft = filteredMinBalance < 0

  // 折線圖資料（保留 YYYY-MM-DD 避免跨年重複 key）
  const chartData = filteredDailyBalances.map(d => ({
    date: d.date,
    balance: d.balance,
  }))

  const applyPresetDays = (daysCount: number | null) => {
    setFocusedIntervalKey(null)
    if (!daysCount || allDaily.length === 0) {
      setStartDate('')
      setEndDate('')
      return
    }
    const targetIdx = Math.min(daysCount - 1, allDaily.length - 1)
    setStartDate(minAvailableDate)
    setEndDate(allDaily[targetIdx]?.date || maxAvailableDate)
  }

  const handleToggleFocusInterval = (iv: OverdraftInterval) => {
    if (focusedIntervalKey === iv.key) {
      setFocusedIntervalKey(null)
      setStartDate('')
      setEndDate('')
    } else {
      setFocusedIntervalKey(iv.key)
      setStartDate(iv.startDate)
      setEndDate(iv.endDate)
    }
  }

  if (loading && !forecast) {
    return <ForecastSkeleton />
  }

  return (
    <div className="fade-in">
      {/* 頁面標題 */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>現金流預測 & 購買力試算</span>
          <TrendingUp size={24} style={{ color: 'var(--color-primary)' }} />
        </h1>
        <p className="page-subtitle">模擬未來 12 個月（365 天）資金流向，支援自訂日期區間查詢、防範透支風險，並提供智慧購物決策支援</p>
      </div>

      {/* 帳本視角切換器 + 日期區間查詢列 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <ScopeTabBar scope={scope} onChange={setScope} />

        <div className="card forecast-filter-card" style={{ marginBottom: 0 }}>
          <div className="forecast-filter-main">
            <span className="forecast-filter-label">
              <Calendar size={15} color="var(--color-primary)" />
              查詢區間：
            </span>
            <div className="forecast-filter-dates">
              <div className="forecast-date-field">
                <span className="forecast-date-tag">起</span>
                <input
                  id="forecast-start-date"
                  type="date"
                  className="input forecast-date-input"
                  aria-label="預測起始日期"
                  min={minAvailableDate}
                  max={maxAvailableDate}
                  value={effectiveStart}
                  onChange={e => {
                    setFocusedIntervalKey(null)
                    setStartDate(e.target.value)
                  }}
                />
              </div>
              <span className="forecast-date-sep">~</span>
              <div className="forecast-date-field">
                <span className="forecast-date-tag">迄</span>
                <input
                  id="forecast-end-date"
                  type="date"
                  className="input forecast-date-input"
                  aria-label="預測結束日期"
                  min={minAvailableDate}
                  max={maxAvailableDate}
                  value={effectiveEnd}
                  onChange={e => {
                    setFocusedIntervalKey(null)
                    setEndDate(e.target.value)
                  }}
                />
              </div>
            </div>
          </div>
          <div className="forecast-filter-presets">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ border: '1px solid var(--border-color)' }}
              onClick={() => applyPresetDays(60)}
            >
              近 60 天
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ border: '1px solid var(--border-color)' }}
              onClick={() => applyPresetDays(183)}
            >
              近 6 個月
            </button>
            <button
              type="button"
              className={`btn btn-sm ${!isCustomRange ? 'btn-primary' : 'btn-ghost'}`}
              style={{ border: '1px solid var(--border-color)' }}
              onClick={() => applyPresetDays(null)}
            >
              完整 12 個月
            </button>
          </div>
        </div>
      </div>

      {/* 12 個月 / 所選區間安全指標卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div
          className="stat-card"
          style={{
            borderLeft: filteredWillOverdraft ? '5px solid var(--color-danger)' : '5px solid var(--color-success)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">
              <span>{rangeTitlePrefix}資金安全評級</span>
              <FormulaTooltip
                label={`檢視${rangeTitlePrefix}資金安全評級計算公式`}
                formula="模擬未來 12 個月（365 天）逐日餘額，若所選區間最低餘額點 < $0 則判定為「存在透支風險」，若 >= $0 則為「現金流充裕安全」"
                calculation={`區間（${rangeStart} ~ ${rangeEnd}）最低點 ${formatCurrency(filteredMinBalance)} ${filteredWillOverdraft ? `< $0（存在透支風險 · 共 ${filteredOverdraftIntervals.length} 段合計 ${filteredOverdraftDays} 天為負）` : '>= $0（現金流充裕安全）'}`}
              />
            </span>
            {filteredWillOverdraft ? (
              <AlertTriangle size={20} color="var(--color-danger)" />
            ) : (
              <ShieldCheck size={20} color="var(--color-success)" />
            )}
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: '1.4rem',
              color: filteredWillOverdraft ? 'var(--color-danger)' : 'var(--color-success)',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {filteredWillOverdraft ? (
              <><AlertTriangle size={20} /> 存在透支風險</>
            ) : (
              <><CheckCircle2 size={20} /> 現金流充裕安全</>
            )}
          </div>
          <div className="stat-sub">
            {filteredWillOverdraft
              ? `共 ${filteredOverdraftIntervals.length} 段透支（合計 ${filteredOverdraftDays} 天），請及早調度資金`
              : '在排定所有收支後皆保持正值'}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <span>{isCustomRange ? '區間最低餘額點' : '預測期最低餘額點'}</span>
            <FormulaTooltip
              label="檢視預測期最低餘額點計算公式"
              formula="第 0 天起始餘額（現金＋銀行存款）逐日加減未勾選已繳之週期收支、已出帳卡費（扣繳日扣除）與未出帳卡費（出帳後扣繳日扣除）後，於所選查詢區間內之最低值"
              calculation={`起始（現金 ${formatCurrency(forecast?.cashTotal ?? 0)} + 存款 ${formatCurrency(forecast?.bankTotal ?? 0)} = ${formatCurrency(forecast?.startingBalance ?? 0)}）→ 區間最低點 ${formatCurrency(filteredMinBalance)}（${filteredMinDate || '無變動'}）`}
            />
          </span>
          <div
            className="stat-value"
            style={{
              color: filteredMinBalance >= 0 ? 'var(--text-primary)' : 'var(--color-danger)',
            }}
          >
            {formatCurrency(filteredMinBalance)}
          </div>
          <div className="stat-sub">
            預計發生在：{filteredMinDate || '無變動'}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <span>{rangeTitlePrefix}預定事件數</span>
            <FormulaTooltip
              label={`檢視${rangeTitlePrefix}預定事件數計算公式`}
              formula="所選查詢區間（預設未來 12 個月）內預計發生之週期收支筆數 ＋ 信用卡已出帳扣繳事件 ＋ 信用卡未出帳（出帳後扣繳）事件筆數"
              calculation={(() => {
                const settledCount = filteredEvents.filter(e => e.is_settled).length
                const activeCount = filteredEvents.length - settledCount
                return `區間（${rangeStart} ~ ${rangeEnd}）待扣／待入帳 ${activeCount} 筆 + 已勾選已繳 ${settledCount} 筆 = 共 ${filteredEvents.length} 筆`
              })()}
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {filteredEvents.length} 筆
          </div>
          <div className="stat-sub">包含各項週期收支與各期信用卡扣繳卡費</div>
        </div>
      </div>

      {/* 透支風險區間明細警示卡（當有餘額 < $0 的區間時顯示） */}
      {displayedOverdraftIntervals.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderLeft: '5px solid var(--color-danger)',
            background: 'rgba(255, 107, 107, 0.05)',
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
              <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />
              <h2 className="text-lg" style={{ fontWeight: 700, color: 'var(--color-danger)', margin: 0 }}>
                透支風險區間明細（共 {displayedOverdraftIntervals.length} 段 · 合計 {displayedOverdraftDays} 天餘額為負）
              </h2>
            </div>

            {isCustomRange ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                onClick={() => applyPresetDays(null)}
              >
                <RotateCcw size={13} />
                <span>還原完整 12 個月</span>
              </button>
            ) : (
              <span className="text-xs text-muted">
                點擊任一透支區間可快速聚焦檢視該時段走勢與排程
              </span>
            )}
          </div>

          <div className="overdraft-intervals-list">
            {displayedOverdraftIntervals.map((iv, idx) => {
              const isFocused = focusedIntervalKey === iv.key
              const dateRangeText =
                iv.startDate === iv.endDate
                  ? iv.startDate
                  : `${iv.startDate} ~ ${iv.endDate}`
              return (
                <div
                  key={iv.key}
                  className={`overdraft-interval-item ${isFocused ? 'active' : ''}`.trim()}
                  onClick={() => handleToggleFocusInterval(iv)}
                >
                  <div className="overdraft-interval-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        className="badge badge-expense"
                        style={{ fontSize: '0.72rem', padding: '2px 7px', fontWeight: 700 }}
                      >
                        第 {idx + 1} 段
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>
                        {dateRangeText}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 7px',
                          background: 'var(--bg-surface-2)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        共 {iv.daysCount} 天
                      </span>
                      {isFocused && (
                        <span
                          className="badge badge-primary"
                          style={{ fontSize: '0.7rem', padding: '1px 7px' }}
                        >
                          聚焦檢視中
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary" style={{ lineHeight: 1.45, wordBreak: 'break-word' }}>
                      <span>首日觸發：</span>
                      <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {iv.triggerEvents.join('、')}
                      </strong>
                    </div>
                  </div>

                  <div className="overdraft-interval-side">
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-xs text-muted">
                        區間最低點（{iv.minDate}）
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-display)',
                          color: 'var(--color-danger)',
                        }}
                      >
                        {formatCurrency(iv.minBalance)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${isFocused ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.76rem',
                        border: '1px solid var(--border-color)',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={e => {
                        e.stopPropagation()
                        handleToggleFocusInterval(iv)
                      }}
                    >
                      {isFocused ? '取消聚焦' : '聚焦此區間'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 12 個月逐日餘額模擬折線圖 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <TrendingUp size={20} color="var(--color-primary)" />
            {isCustomRange
              ? `逐日現金流模擬趨勢（${rangeStart} ~ ${rangeEnd}）`
              : '未來 12 個月逐日現金流模擬趨勢'}
          </h2>
          <div className="text-xs text-muted">
            {scope === 'household'
              ? '起始餘額：公帳現金＋銀行存款（信用卡已出帳於扣繳日、未出帳於出帳後扣繳日扣除）'
              : scope === 'personal'
              ? '起始餘額：個人現金＋銀行存款（信用卡已出帳於扣繳日、未出帳於出帳後扣繳日扣除）'
              : '起始餘額：全戶現金＋銀行存款（信用卡已出帳於扣繳日、未出帳於出帳後扣繳日扣除）'}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="emoji"><TrendingUp size={40} /></div>
            <h3>此日期區間內無模擬資料</h3>
          </div>
        ) : (
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF8A8A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF8A8A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  minTickGap={32}
                  tickFormatter={(v: string) => v.length >= 10 ? v.slice(2).replace(/-/g, '/') : v}
                />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                <Tooltip
                  labelFormatter={(label: string) => `日期：${label}`}
                  formatter={(v: number) => [formatCurrency(v), '預估餘額']}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#FF8A8A"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#balanceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 下方兩欄：左側 購買力檢查工具 + 右側 未來 12 個月事件時間軸 */}
      <div className="grid-forecast-main">
        {/* 模組 9：購買力檢查 */}
        <div className="card">
          <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
            <ShoppingCart size={20} color="var(--color-primary)" />
            <h2 className="text-xl">智慧購買力試算 (Can I Buy It?)</h2>
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 18 }}>
            打算入手心儀物品或進行大額消費？輸入金額，系統將綜合未來 12 個月信用卡扣繳、週期支出與儲蓄目標，為您評估可行性！
          </p>

          <form onSubmit={handlePurchaseCheck} style={{ marginBottom: 20 }}>
            <div className="flex gap-sm">
              <div style={{ flex: 1 }}>
                <input
                  id="input-purchase-amount"
                  className="input"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="輸入預計消費金額，如 25000"
                  value={checkAmount}
                  onChange={e => setCheckAmount(e.target.value)}
                  required
                />
              </div>
              <button
                id="btn-check-purchase"
                type="submit"
                className="btn btn-primary"
                disabled={checking}
              >
                {checking ? '評估中…' : '開始檢查'}
              </button>
            </div>
            {checkError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: 8 }}>
                {checkError}
              </div>
            )}
          </form>

          {/* 檢查結果卡片 */}
          {checkResult && (
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                padding: 18,
                background:
                  checkResult.verdict === 'safe'
                    ? 'rgba(85,197,149,0.1)'
                    : checkResult.verdict === 'caution'
                    ? 'rgba(255,179,71,0.12)'
                    : 'rgba(255,107,107,0.12)',
                border: `1.5px solid ${
                  checkResult.verdict === 'safe'
                    ? 'var(--color-success)'
                    : checkResult.verdict === 'caution'
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)'
                }`,
              }}
            >
              <div className="flex items-center gap-sm" style={{ marginBottom: 8 }}>
                {checkResult.verdict === 'safe' ? (
                  <CheckCircle size={22} color="var(--color-success)" />
                ) : checkResult.verdict === 'caution' ? (
                  <AlertTriangle size={22} color="var(--color-warning)" />
                ) : (
                  <AlertCircle size={22} color="var(--color-danger)" />
                )}

                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {checkResult.verdict === 'safe'
                    ? '評估結果：可以放心購買！'
                    : checkResult.verdict === 'caution'
                    ? '評估結果：建議審慎評估！'
                    : '評估結果：強烈不建議購買！'}
                </h3>
              </div>

              <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {checkResult.verdict === 'safe' && (
                  <p>
                    消費 <strong>{formatCurrency(checkResult.amount)}</strong> 後，未來 12 個月內現金流依舊充裕（最低點仍有 <strong>{formatCurrency(checkResult.minBalance)}</strong>）{scope === 'household' ? '。' : '，且完全不影響現有儲蓄目標進度。'}
                  </p>
                )}
                {checkResult.verdict === 'caution' && (
                  <p>
                    消費 <strong>{formatCurrency(checkResult.amount)}</strong> 雖然不會立即透支，但將擠壓到本月規劃之儲蓄預留款（可能影響 {checkResult.affectedGoals.map(g => g.name).join('、')}）。建議延後購買或調降金額。
                  </p>
                )}
                {checkResult.verdict === 'danger' && (
                  <p style={{ color: 'var(--color-danger)' }}>
                    注意！若執行此筆 <strong>{formatCurrency(checkResult.amount)}</strong> 消費，未來 12 個月內現金流將會透支跌至 <strong>{formatCurrency(checkResult.minBalance)}</strong>！請勿在此時進行此大額開支。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右側：未來 12 個月 / 區間內排定事件 */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="flex items-center gap-xs">
              <Calendar size={20} color="var(--color-primary)" />
              <h2 className="text-xl">{rangeTitlePrefix}收支排程</h2>
            </div>
            <span className="text-xs text-muted">勾選「已繳」可排除已入卡帳／已消費項目，避免重複計算</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p style={{ fontSize: '0.85rem' }}>{rangeTitlePrefix}無週期收支排程</p>
            </div>
          ) : (
            <div className="forecast-timeline-list">
              {filteredEvents.map((ev, idx) => (
                <div
                  key={ev.event_key || `${ev.date}-${ev.name}-${idx}`}
                  className="forecast-event-row"
                  style={{
                    borderLeft: `4px solid ${ev.is_settled ? 'var(--border-color)' : ev.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                    opacity: ev.is_settled ? 0.58 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ textDecoration: ev.is_settled ? 'line-through' : 'none' }}>{ev.name}</span>
                      {ev.is_shared === 1 ? (
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Home size={10} /> 公帳
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Lock size={10} /> 私帳
                        </span>
                      )}
                      {ev.is_settled && (
                        <span className="badge badge-income" style={{ fontSize: '0.65rem', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <CheckCircle2 size={10} /> 已繳（不計入預測）
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <span>預計日期：{ev.date}</span>
                      {ev.account_name && <span>({ev.account_name})</span>}
                    </div>
                  </div>

                  <div className="forecast-event-side">
                    <div className="forecast-event-amount-group">
                      <div
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: ev.is_settled ? 'var(--text-muted)' : ev.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                          textDecoration: ev.is_settled ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.type === 'income' ? '+' : '-'}{formatCurrency(ev.amount)}
                      </div>
                      {typeof ev.running_balance === 'number' && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-display)',
                            fontWeight: ev.running_balance < 0 ? 700 : 500,
                            color: ev.running_balance < 0 ? 'var(--color-danger)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{ev.is_settled ? '當下結餘：' : '結餘：'}{formatCurrency(ev.running_balance)}</span>
                          {ev.running_balance < 0 && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.62rem',
                                padding: '0px 5px',
                                background: 'rgba(255,107,107,0.16)',
                                color: 'var(--color-danger)',
                                border: '1px solid rgba(255,107,107,0.35)',
                              }}
                            >
                              透支
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {ev.event_key && ev.can_settle !== false && (
                      <button
                        type="button"
                        className={`btn btn-sm ${ev.is_settled ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        disabled={settlingKey === ev.event_key}
                        onClick={() => handleToggleSettle(ev)}
                        title={ev.is_settled ? '點擊取消已繳，恢復列入現金流預測計算' : '勾選已繳後將不列入現金流預測計算'}
                      >
                        {settlingKey === ev.event_key ? (
                          '處理中…'
                        ) : ev.is_settled ? (
                          <><RotateCcw size={12} /> 取消已繳</>
                        ) : (
                          <><Circle size={12} /> 已繳</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
