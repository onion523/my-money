import { useEffect, useState } from 'react';
import { BookHeart, LogIn, UserPlus } from 'lucide-react';
import { startOAuthLogin } from '../auth/oauth';

export default function Login() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === '1') {
      setRedirecting(true);
      startOAuthLogin('login');
    }
  }, []);

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
          width: 52,
          height: 52,
          borderRadius: 16,
          background: 'var(--color-primary)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <BookHeart size={26} />
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>My Money</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 24 }}>
          個人與家庭雙帳本 · 安全授權登入
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            disabled={redirecting}
            onClick={() => {
              setRedirecting(true);
              startOAuthLogin('login');
            }}
          >
            <LogIn size={18} />
            {redirecting ? '正在前往登入頁...' : '前往登入'}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
            disabled={redirecting}
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
