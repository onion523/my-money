import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg-page, #FFF5F5)',
          fontFamily: 'sans-serif',
          color: 'var(--text-primary, #2D3436)'
        }}>
          <div style={{ color: 'var(--color-danger, #EF4444)', marginBottom: 16 }}>
            <AlertTriangle size={48} />
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 8, fontWeight: 700 }}>頁面遇到了一點小問題</h2>
          <p style={{ color: 'var(--text-secondary, #636E72)', fontSize: '0.9rem', marginBottom: 16, textAlign: 'center', maxWidth: 450 }}>
            {this.state.error?.message || '發生未預期的錯誤'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch (_) {}
                window.location.href = '/login';
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid var(--border-color, #FFDEDE)',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              重設並返回登入
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary, #FF8A8A)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
