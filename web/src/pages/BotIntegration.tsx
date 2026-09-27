import { useState, useEffect } from 'react'
import { botApi, BotBinding } from '../api/client'
import {
  Bot,
  MessageSquare,
  Key,
  Copy,
  Check,
  Send,
  Trash2,
  Sparkles,
  HelpCircle,
  Clock,
  Smartphone,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'

export default function BotIntegration() {
  const [bindings, setBindings] = useState<BotBinding[]>([])
  const [loading, setLoading] = useState(true)

  // Pairing code state
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Webhook URL copy
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  // Live Bot Simulator state
  const [simInput, setSimInput] = useState('')
  const [simLoading, setSimLoading] = useState(false)
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '👋 您好！我是您的家庭記帳小秘書。\n您可以試著傳送「午餐 120」或「查帳」試試看喔！',
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    }
  ])

  const webhookBase = window.location.origin.includes('localhost')
    ? 'https://your-domain.workers.dev'
    : window.location.origin

  const loadBindings = async () => {
    try {
      setLoading(true)
      const list = await botApi.bindings()
      setBindings(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBindings()
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setPairingCode(null)
      return
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleGenerateCode = async () => {
    try {
      setGenerating(true)
      const res = await botApi.pairingCode()
      setPairingCode(res.code)
      setCountdown(res.expires_in_seconds)
    } catch (err: any) {
      alert(err.message || '產生配對碼失敗')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyCode = () => {
    if (!pairingCode) return
    navigator.clipboard.writeText(`綁定 ${pairingCode}`)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleUnbind = async (binding: BotBinding) => {
    if (!confirm(`確定要解除綁定 ${binding.platform.toUpperCase()} 嗎？`)) return
    try {
      await botApi.unbind(binding.id)
      await loadBindings()
    } catch (err: any) {
      alert(err.message || '解除失敗')
    }
  }

  // Simulator
  const handleSimulate = async (customText?: string) => {
    const textToSend = customText || simInput
    if (!textToSend.trim()) return

    const nowTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    setSimMessages((prev) => [...prev, { sender: 'user', text: textToSend, time: nowTime }])
    if (!customText) setSimInput('')

    try {
      setSimLoading(true)
      const res = await botApi.testSimulate(textToSend)
      setSimMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.reply,
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } catch (err: any) {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ 錯誤：${err.message || '無法處理請求'}`,
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setSimLoading(false)
    }
  }

  return (
    <div className="fade-in">
      {/* 標題與說明 */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">智慧機器人串接 🤖</h1>
        <p className="page-subtitle">透過 LINE 或 Telegram 隨手打字快速記帳，自動推測分類、更新餘額與查帳</p>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* 左側：配對綁定中心 */}
        <div className="card" style={{ padding: 24 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--gradient-card)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#FF6B6B'
            }}>
              <Key size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>配對綁定機器人</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>產生專屬驗證碼，在聊天室中輸入即完成對接</p>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
            {pairingCode ? (
              <div>
                <div style={{
                  background: 'var(--bg-surface-2)',
                  border: '2px dashed var(--color-primary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 10
                }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: 4, color: 'var(--color-primary-dark)' }}>
                    {pairingCode}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={handleCopyCode}>
                    {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedCode ? '已複製指令！' : '複製指令'}</span>
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  <Clock size={12} />
                  <span>有效時間剩餘：{Math.floor(countdown / 60)} 分 {countdown % 60} 秒</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                  請在 LINE 或 Telegram 聊天室直接發送：<b>綁定 {pairingCode}</b>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                  點擊下方按鈕取得一組 6 位數臨時安全配對碼（有效期限 10 分鐘）：
                </p>
                <button id="btn-generate-bot-code" className="btn btn-primary" onClick={handleGenerateCode} disabled={generating}>
                  <Sparkles size={16} />
                  <span>{generating ? '產生中...' : '產生配對碼'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 目前綁定清單 */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>已綁定對話帳號</h4>
            {loading ? (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>載入中...</div>
            ) : bindings.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)', padding: '8px 0' }}>
                尚未綁定任何 LINE 或 Telegram 機器人。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bindings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="badge badge-safe" style={{ textTransform: 'uppercase' }}>{b.platform}</span>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{b.display_name || b.platform_user_id}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={() => handleUnbind(b)}
                    >
                      <Trash2 size={14} />
                      <span className="text-xs">解除</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側：線上模擬測試小工具 */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="flex items-center gap-2">
              <MessageSquare size={18} style={{ color: 'var(--color-primary-dark)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>網頁即時對話測試機</h3>
            </div>
            <span className="badge badge-safe" style={{ fontSize: '0.7rem' }}>● 智慧核心已連線</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            在此直接測試機器人對話解析，測試記錄將直接同步至您的記帳本中！
          </p>

          {/* 快捷點擊測試範例 */}
          <div className="flex gap-1" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {['午餐 120', '一蘭拉麵 320 現金', '薪水 65000 銀行', '查帳'].map((sample) => (
              <button
                key={sample}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--bg-surface-2)' }}
                onClick={() => handleSimulate(sample)}
              >
                + {sample}
              </button>
            ))}
          </div>

          {/* 聊天室內容 */}
          <div style={{
            flex: 1, minHeight: 220, maxHeight: 280,
            overflowY: 'auto', background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-md)', padding: 12,
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1px solid var(--border-color)', marginBottom: 12
          }}>
            {simMessages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.sender === 'user' ? 'var(--color-primary)' : 'var(--bg-card)',
                  color: m.sender === 'user' ? 'white' : 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  boxShadow: 'var(--shadow-sm)',
                  border: m.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                }}
              >
                {m.text}
                <div style={{
                  fontSize: '0.65rem',
                  opacity: 0.7,
                  marginTop: 4,
                  textAlign: m.sender === 'user' ? 'right' : 'left'
                }}>
                  {m.time}
                </div>
              </div>
            ))}
            {simLoading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                小秘書思考中...
              </div>
            )}
          </div>

          {/* 輸入框 */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSimulate(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="例如：午餐 120、高鐵 1490 信用卡、餘額"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              disabled={simLoading}
            />
            <button type="submit" className="btn btn-primary" disabled={simLoading || !simInput.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* 下方：平台 Webhook 設定說明 */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
          雙平台 Webhook 設定教學
        </h3>

        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* LINE 設定教學 */}
          <div style={{
            background: 'var(--bg-surface-2)', padding: 18,
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
          }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <span className="badge" style={{ background: '#00B900', color: 'white' }}>LINE</span>
              <h4 style={{ fontWeight: 700 }}>LINE Messaging API 設定</h4>
            </div>
            <ol className="text-sm" style={{ paddingLeft: 18, lineHeight: 1.8, color: 'var(--text-primary)' }}>
              <li>前往 <b>LINE Developers Console</b> 建立 Messaging API Channel。</li>
              <li>在 <b>Messaging API</b> 設定中填入 Webhook URL：
                <div style={{
                  background: 'var(--bg-card)', padding: '6px 10px',
                  borderRadius: 6, margin: '6px 0', fontSize: '0.8rem',
                  fontFamily: 'monospace', wordBreak: 'break-all'
                }}>
                  {webhookBase}/api/bot/webhook/line
                </div>
              </li>
              <li>開啟「<b>Use Webhook</b>」開關。</li>
              <li>在 Workers 環境變數設定 <code>LINE_CHANNEL_SECRET</code> 與 <code>LINE_CHANNEL_ACCESS_TOKEN</code>。</li>
              <li>加機器人好友並傳送配對碼即可開始！</li>
            </ol>
          </div>

          {/* Telegram 設定教學 */}
          <div style={{
            background: 'var(--bg-surface-2)', padding: 18,
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
          }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <span className="badge" style={{ background: '#0088CC', color: 'white' }}>Telegram</span>
              <h4 style={{ fontWeight: 700 }}>Telegram Bot 設定</h4>
            </div>
            <ol className="text-sm" style={{ paddingLeft: 18, lineHeight: 1.8, color: 'var(--text-primary)' }}>
              <li>在 Telegram 搜尋 <b>@BotFather</b> 並輸入 <code>/newbot</code> 建立機器人。</li>
              <li>取得 Bot Token 並在 Workers 設定環境變數 <code>TELEGRAM_BOT_TOKEN</code>。</li>
              <li>呼叫 Telegram API 設定 Webhook：
                <div style={{
                  background: 'var(--bg-card)', padding: '6px 10px',
                  borderRadius: 6, margin: '6px 0', fontSize: '0.8rem',
                  fontFamily: 'monospace', wordBreak: 'break-all'
                }}>
                  https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={webhookBase}/api/bot/webhook/telegram
                </div>
              </li>
              <li>在 Telegram 私訊機器人發送配對碼即可啟用！</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}