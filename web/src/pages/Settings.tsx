import { useEffect, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Laptop, LogOut, Pencil, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { authApi, passkeysApi, type PasskeyInfo, type SessionInfo } from '../api/client';
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

  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState('');

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

  const loadPasskeys = async () => {
    setLoadingPasskeys(true);
    setPasskeyError('');
    try {
      setPasskeys(await passkeysApi.list());
    } catch (err: unknown) {
      setPasskeyError(err instanceof Error ? err.message : '無法載入 Passkey 清單');
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadPasskeys();
  }, []);

  const handleAddPasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      setPasskeyError('此瀏覽器或裝置不支援 Passkey');
      return;
    }
    setPasskeyBusy(true);
    setPasskeyError('');
    try {
      const options = await passkeysApi.registerOptions();
      const response = await startRegistration({ optionsJSON: options });
      const created = await passkeysApi.registerVerify(response, passkeyName.trim() || undefined);
      setPasskeys((prev) => [created, ...prev]);
      setPasskeyName('');
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setPasskeyError('已取消建立 Passkey');
      } else if (name === 'InvalidStateError') {
        setPasskeyError('此裝置已註冊過同一帳號的 Passkey');
      } else {
        setPasskeyError(err instanceof Error ? err.message : '建立 Passkey 失敗');
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRenamePasskey = async (id: string) => {
    const trimmed = editingPasskeyName.trim();
    if (!trimmed) return;
    setPasskeyError('');
    try {
      const updated = await passkeysApi.rename(id, trimmed);
      setPasskeys((prev) => prev.map((p) => (p.id === id ? { ...p, name: updated.name } : p)));
      setEditingPasskeyId(null);
      setEditingPasskeyName('');
    } catch (err: unknown) {
      setPasskeyError(err instanceof Error ? err.message : '重新命名失敗');
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setPasskeyError('');
    try {
      await passkeysApi.remove(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setPasskeyError(err instanceof Error ? err.message : '刪除 Passkey 失敗');
    }
  };

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

      {/* Passkey 通行金鑰 */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Fingerprint size={18} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Passkey 通行金鑰</h2>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          使用 Face ID / Touch ID 或裝置密碼免密碼安全登入。刪除 Passkey 僅停用該金鑰未來登入。
        </p>

        {passkeyError && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger, #ef4444)',
            fontSize: '0.88rem',
            marginBottom: 12,
          }}>
            {passkeyError}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            className="input"
            placeholder="名稱（選填，例如：iPhone、MacBook）"
            maxLength={60}
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            style={{ flex: '1 1 220px', maxWidth: 320 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={passkeyBusy}
            onClick={handleAddPasskey}
          >
            <Plus size={16} />
            {passkeyBusy ? '建立中...' : '新增 Passkey'}
          </button>
        </div>

        {loadingPasskeys ? (
          <Skeleton height={56} />
        ) : passkeys.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            尚未建立任何 Passkey
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ flex: '1 1 220px' }}>
                  {editingPasskeyId === pk.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        maxLength={60}
                        value={editingPasskeyName}
                        onChange={(e) => setEditingPasskeyName(e.target.value)}
                        style={{ maxWidth: 220 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleRenamePasskey(pk.id)}
                      >
                        儲存
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditingPasskeyId(null);
                          setEditingPasskeyName('');
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>{pk.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        建立：{formatTimestamp(pk.created_at)} · 最後使用：{pk.last_used_at ? formatTimestamp(pk.last_used_at) : '尚未使用'}
                      </div>
                    </>
                  )}
                </div>

                {editingPasskeyId !== pk.id && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="重新命名"
                      onClick={() => {
                        setEditingPasskeyId(pk.id);
                        setEditingPasskeyName(pk.name);
                      }}
                    >
                      <Pencil size={15} />
                      改名
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="刪除 Passkey"
                      onClick={() => handleDeletePasskey(pk.id)}
                    >
                      <Trash2 size={15} />
                      刪除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 已登入的裝置 */}
      <section className="card">
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
      <section className="card">
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
              color: 'var(--color-success, #059669)',
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
