import { ForecastSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { forecastApi, ForecastResult, PurchaseCheckResult } from '../api/client'
import { formatCurrency, formatDate } from '../components/utils'
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
  AlertCircle
} from 'lucide-react'

export default function Forecast() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(true)

  // 購買力檢查狀態
  const [checkAmount, setCheckAmount] = useState('')
  const [checkResult, setCheckResult] = useState<PurchaseCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')

  const loadForecast = async () => {
    try {
      setLoading(true)
      const data = await forecastApi.get()
      setForecast(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadForecast()
  }, [])

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
      const res = await forecastApi.purchaseCheck(amt)
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
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">現金流預測 & 購買力試算 🔮</h1>
        <p className="page-subtitle">模擬未來 30 天資金流向，精確防範透支風險，並提供智慧購物決策支援</p>
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
            起始餘額：銀行總額扣除信用卡已出及未出帳
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
                    消費 <strong>{formatCurrency(checkResult.amount)}</strong> 後，未來 30 天內現金流依舊充裕（最低點仍有 <strong>{formatCurrency(checkResult.minBalance)}</strong>），且完全不影響現有儲蓄目標進度。
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
          <div className="flex items-center gap-xs" style={{ marginBottom: 16 }}>
            <Calendar size={20} color="var(--color-primary)" />
            <h2 className="text-xl">未來 30 天收支排程</h2>
          </div>

          {!forecast?.events || forecast.events.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p style={{ fontSize: '0.85rem' }}>未來 30 天無週期收支排程</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {forecast.events.map((ev, idx) => (
                <div
                  key={`${ev.date}-${ev.name}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    borderLeft: `4px solid ${ev.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.name}</div>
                    <div className="text-xs text-muted">預計日期：{ev.date}</div>
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: ev.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  >
                    {ev.type === 'income' ? '+' : '-'}{formatCurrency(ev.amount)}
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
