import { ForecastSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { forecastApi, ForecastResult, PurchaseCheckResult, DayEvent } from '../api/client'
import { formatCurrency, formatDate } from '../components/utils'
import ScopeTabBar from '../components/ScopeTabBar'
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
  HelpCircle,
  ShoppingCart,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'

export default function Forecast() {
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [settlingKey, setSettlingKey] = useState<string | null>(null)

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

  // 折線圖資料
  const chartData = forecast?.dailyBalances.map(d => ({
    date: d.date.slice(5), // MM-DD
    balance: d.balance,
  })) || []

  if (loading && !forecast) {
    return <ForecastSkeleton />
  }

  return (
    <div className="fade-in">
      {/* 頁面標題 */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">現金流預測 & 購買力試算 🔮</h1>
        <p className="page-subtitle">模擬未來 30 天資金流向，精確防範透支風險，並提供智慧購物決策支援</p>
      </div>

      {/* 帳本視角切換器 */}
      <div style={{ marginBottom: 20 }}>
        <ScopeTabBar scope={scope} onChange={setScope} />
      </div>

      {/* 30 天安全指標卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div
          className="stat-card"
          style={{
            borderLeft: forecast?.willOverdraft ? '5px solid var(--color-danger)' : '5px solid var(--color-success)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">未來 30 天資金安全評級</span>
            {forecast?.willOverdraft ? (
              <AlertTriangle size={20} color="var(--color-danger)" />
            ) : (
              <ShieldCheck size={20} color="var(--color-success)" />
            )}
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: '1.4rem',
              color: forecast?.willOverdraft ? 'var(--color-danger)' : 'var(--color-success)',
              marginTop: 4,
            }}
          >
            {forecast?.willOverdraft ? '⚠️ 存在透支風險' : '🟢 現金流充裕安全'}
          </div>
          <div className="stat-sub">
            {forecast?.willOverdraft ? '預計餘額將跌破 0，請及早調整' : '在排定所有收支後皆保持正值'}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">預測期最低餘額點</span>
          <div
            className="stat-value"
            style={{
              color: (forecast?.minBalance ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)',
            }}
          >
            {formatCurrency(forecast?.minBalance ?? 0)}
          </div>
          <div className="stat-sub">
            預計發生在：{forecast?.minDate || '無變動'}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">未來 30 天預定事件數</span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {forecast?.events.length ?? 0} 筆
          </div>
          <div className="stat-sub">包含各項月繳、雙月繳及固定薪資</div>
        </div>
      </div>

      {/* 30 天逐日餘額模擬折線圖 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <TrendingUp size={20} color="var(--color-primary)" />
            未來 30 天逐日現金流模擬趨勢
          </h2>
          <div className="text-xs text-muted">
            {scope === 'household'
              ? '起始餘額：公帳存款扣除未出帳款項（已出帳於繳款日扣除）'
              : scope === 'personal'
              ? '起始餘額：個人存款扣除未出帳款項（已出帳於繳款日扣除）'
              : '起始餘額：全戶存款扣除未出帳款項（已出帳於繳款日扣除）'}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="emoji">📈</div>
            <h3>正在模擬未來現金流…</h3>
          </div>
        ) : (
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF8A8A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF8A8A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), '預估餘額']} />
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

      {/* 下方兩欄：左側 購買力檢查工具 + 右側 未來 30 天事件時間軸 */}
      <div className="grid-forecast-main">
        {/* 模組 9：購買力檢查 */}
        <div className="card">
          <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
            <ShoppingCart size={20} color="var(--color-primary)" />
            <h2 className="text-xl">智慧購買力試算 (Can I Buy It?)</h2>
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 18 }}>
            打算入手心儀物品或進行大額消費？輸入金額，系統將綜合未出帳信用卡、週期支出與儲蓄目標，為您評估可行性！
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
                    ? '🎉 評估結果：可以放心購買！'
                    : checkResult.verdict === 'caution'
                    ? '⚠️ 評估結果：建議審慎評估！'
                    : '🚨 評估結果：強烈不建議購買！'}
                </h3>
              </div>

              <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {checkResult.verdict === 'safe' && (
                  <p>
                    消費 <strong>{formatCurrency(checkResult.amount)}</strong> 後，未來 30 天內現金流依舊充裕（最低點仍有 <strong>{formatCurrency(checkResult.minBalance)}</strong>）{scope === 'household' ? '。' : '，且完全不影響現有儲蓄目標進度。'}
                  </p>
                )}
                {checkResult.verdict === 'caution' && (
                  <p>
                    消費 <strong>{formatCurrency(checkResult.amount)}</strong> 雖然不會立即透支，但將擠壓到本月規劃之儲蓄預留款（可能影響 {checkResult.affectedGoals.map(g => g.name).join('、')}）。建議延後購買或調降金額。
                  </p>
                )}
                {checkResult.verdict === 'danger' && (
                  <p style={{ color: 'var(--color-danger)' }}>
                    注意！若執行此筆 <strong>{formatCurrency(checkResult.amount)}</strong> 消費，未來 30 天內現金流將會透支跌至 <strong>{formatCurrency(checkResult.minBalance)}</strong>！請勿在此時進行此大額開支。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右側：未來 30 天排定事件 */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="flex items-center gap-xs">
              <Calendar size={20} color="var(--color-primary)" />
              <h2 className="text-xl">未來 30 天收支排程</h2>
            </div>
            <span className="text-xs text-muted">勾選「已繳」可排除已入卡帳／已消費項目，避免重複計算</span>
          </div>

          {!forecast?.events || forecast.events.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p style={{ fontSize: '0.85rem' }}>未來 30 天無週期收支排程</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {forecast.events.map((ev, idx) => (
                <div
                  key={ev.event_key || `${ev.date}-${ev.name}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    borderLeft: `4px solid ${ev.is_settled ? 'var(--border-color)' : ev.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                    opacity: ev.is_settled ? 0.58 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ textDecoration: ev.is_settled ? 'line-through' : 'none' }}>{ev.name}</span>
                      {ev.is_shared === 1 ? (
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>🏠 公帳</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>🔒 私帳</span>
                      )}
                      {ev.is_settled && (
                        <span className="badge badge-income" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          ✅ 已繳（不計入預測）
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span>預計日期：{ev.date}</span>
                      {ev.account_name && <span>({ev.account_name})</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                        }}
                        disabled={settlingKey === ev.event_key}
                        onClick={() => handleToggleSettle(ev)}
                        title={ev.is_settled ? '點擊取消已繳，恢復列入現金流預測計算' : '勾選已繳後將不列入現金流預測計算'}
                      >
                        {settlingKey === ev.event_key ? '處理中…' : ev.is_settled ? '↩️ 取消已繳' : '☑️ 已繳'}
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
