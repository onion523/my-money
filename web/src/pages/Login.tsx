import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, UserPlus } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { loginWithPasskey, startOAuthLogin } from '../auth/oauth';

export default function Login() {
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === '1') {
      setRedirecting(true);
      startOAuthLogin('login');
    }
  }, []);

  const handlePasskeyLogin = async () => {
    setError('');
    setPasskeyBusy(true);
    try {
      await loginWithPasskey();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Passkey 登入失敗，請改用密碼登入');
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <BrandLogo variant="badge" size={56} />
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>My Money</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 24 }}>
          個人與家庭雙帳本 · 安全授權登入
        </p>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: '0.86rem',
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            disabled={redirecting || passkeyBusy}
            onClick={handlePasskeyLogin}
          >
            <KeyRound size={18} />
            {passkeyBusy ? '驗證 Passkey 中...' : '使用 Passkey 登入'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            disabled={redirecting || passkeyBusy}
            onClick={() => {
              setRedirecting(true);
              startOAuthLogin('login');
            }}
          >
            <LogIn size={18} />
            {redirecting ? '正在前往登入頁...' : '使用帳號密碼登入'}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            disabled={redirecting || passkeyBusy}
            onClick={() => {
              setRedirecting(true);
              startOAuthLogin('register');
            }}
          >
            <UserPlus size={18} />
            建立新帳號
          </button>
        </div>
      </div>
    </div>
  );
}
