import { useEffect, useState } from 'react';
import { KeyRound, Laptop, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { authApi, type SessionInfo } from '../api/client';
import { Skeleton } from '../components/Skeleton';

function formatTimestamp(sec: number): string {
  if (!sec) return '—';
  return new Date(sec * 1000).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatClientLabel(clientId: string): string {
  if (clientId === 'web') return 'My Money Web';
  if (clientId === 'ios') return 'My Money iOS';
  return clientId;
}

export default function Settings() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionError('');
    try {
      const list = await authApi.sessions();
      setSessions(list);
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : '無法載入裝置清單');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeOne = async (id: string) => {
    setBusyId(id);
    setSessionError('');
    try {
      await authApi.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : '登出裝置失敗');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    setSessionError('');
    try {
      await authApi.revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.current));
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : '登出其他裝置失敗');
    } finally {
      setRevokingOthers(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError('新密碼至少需要 6 個字元');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('兩次輸入的新密碼不一致');
      return;
    }

    setPwLoading(true);
    try {
      const res = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(res.message || '密碼已更新，其他裝置已登出');
      await loadSessions();
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : '修改密碼失敗');
    } finally {
      setPwLoading(false);
    }
  };

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 840 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>帳號安全設定</h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            管理已登入的裝置與更新登入密碼
          </p>
        </div>
      </div>

      {/* 已登入的裝置 */}
      <section className="card" style={{ padding: 20 }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>已登入的裝置</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              連續 30 天未使用的裝置會自動失效
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loadingSessions || revokingOthers || otherCount === 0}
            onClick={handleRevokeOthers}
          >
            <LogOut size={16} />
            {revokingOthers ? '處理中...' : '登出其他所有裝置'}
          </button>
        </div>

        {sessionError && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger, #ef4444)',
            fontSize: '0.88rem',
            marginBottom: 12,
          }}>
            {sessionError}
          </div>
        )}

        {loadingSessions ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton variant="rect" height={68} borderRadius={12} />
            <Skeleton variant="rect" height={68} borderRadius={12} />
          </div>
        ) : sessions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>目前沒有使用中的工作階段。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((s) => {
              const isMobile = s.client_id === 'ios' || /iPhone|iPad|Android/i.test(s.device_name);
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface-2, transparent)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'var(--bg-page)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: 'var(--color-primary)',
                    }}>
                      {isMobile ? <Smartphone size={18} /> : <Laptop size={18} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{s.device_name}</strong>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                        }}>
                          {formatClientLabel(s.client_id)}
                        </span>
                        {s.current && (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--color-primary)',
                            color: '#fff',
                          }}>
                            目前這台
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        建立：{formatTimestamp(s.created_at)} · 最後使用：{formatTimestamp(s.last_used_at)}
                      </div>
                    </div>
                  </div>

                  {!s.current && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === s.id}
                      onClick={() => handleRevokeOne(s.id)}
                    >
                      {busyId === s.id ? '登出中...' : '登出'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 修改密碼 */}
      <section className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <KeyRound size={18} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>修改密碼</h2>
        </div>

        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          {pwError && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: '0.88rem',
            }}>
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontSize: '0.88rem',
            }}>
              {pwSuccess}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: 6 }}>
              目前密碼
            </label>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: 6 }}>
              新密碼（至少 6 個字元）
            </label>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: 6 }}>
              確認新密碼
            </label>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={pwLoading}>
              {pwLoading ? '更新中...' : '更新密碼'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
