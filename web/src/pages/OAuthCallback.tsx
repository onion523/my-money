import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleOAuthCallback, startOAuthLogin } from '../auth/oauth';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    handleOAuthCallback(window.location.search)
      .then(() => {
        if (!cancelled) navigate('/', { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '登入失敗，請重試');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 28, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 10 }}>{error ? '登入未能完成' : '正在完成登入...'}</h2>
        {error ? (
          <>
            <p style={{ color: 'var(--color-danger, #ef4444)', marginBottom: 18, fontSize: '0.92rem' }}>{error}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => startOAuthLogin('login')}
            >
              重新登入
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>請稍候，正在驗證授權碼...</p>
        )}
      </div>
    </div>
  );
}
