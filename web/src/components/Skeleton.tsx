import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  borderRadius,
  className = '',
  style = {}
}: SkeletonProps) {
  const customStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
  };

  return (
    <div
      className={`skeleton skeleton-${variant} ${className}`.trim()}
      style={customStyle}
    />
  );
}

// ----------------------------------------------------
// 1. Dashboard Skeleton
// ----------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="fade-in">
      {/* 標題骨架 */}
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={180} height={28} />
          <Skeleton variant="text" width={260} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
      </div>

      {/* 公私帳篩選切換列骨架 */}
      <div style={{ display: 'inline-flex', gap: 6, padding: 4, background: 'var(--bg-surface)', borderRadius: 12, marginBottom: 20 }}>
        <Skeleton variant="rect" width={70} height={32} borderRadius={8} />
        <Skeleton variant="rect" width={80} height={32} borderRadius={8} />
        <Skeleton variant="rect" width={80} height={32} borderRadius={8} />
      </div>

      {/* 四大統計卡片骨架 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <Skeleton variant="text" width={90} height={14} />
              <Skeleton variant="circle" width={32} height={32} />
            </div>
            <Skeleton variant="text" width={130} height={24} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width={100} height={12} />
          </div>
        ))}
      </div>

      {/* 帳戶總覽骨架 */}
      <div style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <Skeleton variant="text" width={120} height={20} />
          <Skeleton variant="text" width={60} height={16} />
        </div>
        <div className="grid grid-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: '16px 18px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <Skeleton variant="circle" width={28} height={28} />
                  <Skeleton variant="text" width={90} height={16} />
                </div>
                <Skeleton variant="rect" width={50} height={20} borderRadius={6} />
              </div>
              <Skeleton variant="text" width={120} height={22} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width={80} height={12} />
            </div>
          ))}
        </div>
      </div>

      {/* 近期交易明細骨架 */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <Skeleton variant="text" width={110} height={20} />
          <Skeleton variant="text" width={60} height={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color-2)' }}>
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" width={36} height={36} />
                <div>
                  <Skeleton variant="text" width={100} height={16} style={{ marginBottom: 4 }} />
                  <Skeleton variant="text" width={140} height={12} />
                </div>
              </div>
              <Skeleton variant="text" width={75} height={18} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. Transactions Skeleton
// ----------------------------------------------------
export function TransactionsSkeleton() {
  return (
    <div className="fade-in">
      {/* 標題骨架 */}
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="text" width={240} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
      </div>

      {/* 篩選操作列骨架 */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <Skeleton variant="rect" width={140} height={36} borderRadius={8} />
          <Skeleton variant="rect" width={140} height={36} borderRadius={8} />
          <Skeleton variant="rect" width={180} height={36} borderRadius={8} />
          <Skeleton variant="rect" width={100} height={36} borderRadius={8} />
        </div>
      </div>

      {/* 交易清單骨架 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(group => (
          <div key={group} className="card" style={{ padding: '16px 20px' }}>
            <div className="flex items-center justify-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
              <Skeleton variant="text" width={100} height={16} />
              <Skeleton variant="text" width={80} height={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2].map(row => (
                <div key={row} className="flex items-center justify-between" style={{ padding: '8px 0' }}>
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circle" width={34} height={34} />
                    <div>
                      <Skeleton variant="text" width={110} height={16} style={{ marginBottom: 4 }} />
                      <Skeleton variant="text" width={130} height={12} />
                    </div>
                  </div>
                  <Skeleton variant="text" width={70} height={18} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. Accounts Skeleton
// ----------------------------------------------------
export function AccountsSkeleton() {
  return (
    <div className="fade-in">
      {/* 標題與新增按鈕骨架 */}
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={150} height={28} />
          <Skeleton variant="text" width={220} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={120} height={40} borderRadius={12} />
      </div>

      {/* 淨資產卡片骨架 */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: 8 }} />
        <Skeleton variant="text" width={200} height={32} style={{ marginBottom: 16 }} />
        <div className="grid grid-3" style={{ gap: 12 }}>
          <Skeleton variant="rect" height={50} borderRadius={8} />
          <Skeleton variant="rect" height={50} borderRadius={8} />
          <Skeleton variant="rect" height={50} borderRadius={8} />
        </div>
      </div>

      {/* 帳戶卡片網格骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" width={28} height={28} />
                <Skeleton variant="text" width={90} height={18} />
              </div>
              <Skeleton variant="rect" width={55} height={20} borderRadius={6} />
            </div>
            <Skeleton variant="text" width={130} height={24} style={{ marginBottom: 12 }} />
            <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color-2)', paddingTop: 10 }}>
              <Skeleton variant="text" width={70} height={14} />
              <Skeleton variant="text" width={50} height={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. Analytics Skeleton
// ----------------------------------------------------
export function AnalyticsSkeleton() {
  return (
    <div className="fade-in">
      {/* 標題與月份選擇器骨架 */}
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="text" width={240} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={140} height={38} borderRadius={8} />
      </div>

      {/* 公私帳切換列骨架 */}
      <div style={{ display: 'inline-flex', gap: 6, padding: 4, background: 'var(--bg-surface)', borderRadius: 12, marginBottom: 20 }}>
        <Skeleton variant="rect" width={70} height={32} borderRadius={8} />
        <Skeleton variant="rect" width={80} height={32} borderRadius={8} />
        <Skeleton variant="rect" width={80} height={32} borderRadius={8} />
      </div>

      {/* 圖表網格骨架 */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <Skeleton variant="text" width={140} height={20} style={{ marginBottom: 16 }} />
          <Skeleton variant="rect" height={260} borderRadius={12} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <Skeleton variant="text" width={140} height={20} style={{ marginBottom: 16 }} />
          <Skeleton variant="rect" height={260} borderRadius={12} />
        </div>
      </div>

      {/* 預算清單骨架 */}
      <div className="card" style={{ padding: 20 }}>
        <Skeleton variant="text" width={120} height={20} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="flex justify-between" style={{ marginBottom: 6 }}>
                <Skeleton variant="text" width={100} height={16} />
                <Skeleton variant="text" width={120} height={16} />
              </div>
              <Skeleton variant="rect" height={8} borderRadius={4} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. Family Skeleton
// ----------------------------------------------------
export function FamilySkeleton() {
  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="text" width={250} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={130} height={40} borderRadius={12} />
      </div>

      {/* 公帳餘額池卡片骨架 */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div>
            <Skeleton variant="text" width={110} height={16} style={{ marginBottom: 6 }} />
            <Skeleton variant="text" width={190} height={30} />
          </div>
          <Skeleton variant="rect" width={100} height={36} borderRadius={10} />
        </div>
      </div>

      {/* 成員清單網格骨架 */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {[1, 2].map(i => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
              <Skeleton variant="circle" width={44} height={44} />
              <div>
                <Skeleton variant="text" width={100} height={18} style={{ marginBottom: 4 }} />
                <Skeleton variant="text" width={140} height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 代墊費用卡片骨架 */}
      <div className="card" style={{ padding: 20 }}>
        <Skeleton variant="text" width={150} height={20} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-surface-2)', borderRadius: 10 }}>
              <div className="flex justify-between items-center">
                <Skeleton variant="text" width={120} height={18} />
                <Skeleton variant="text" width={90} height={18} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. Recurring Skeleton
// ----------------------------------------------------
export function RecurringSkeleton() {
  return (
    <div className="fade-in">
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <Skeleton variant="text" width={150} height={28} />
          <Skeleton variant="text" width={240} height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rect" width={95} height={38} borderRadius={10} />
          <Skeleton variant="rect" width={120} height={38} borderRadius={10} />
        </div>
      </div>

      {/* 指標卡片骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="stat-card">
            <Skeleton variant="text" width={110} height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width={130} height={24} />
          </div>
        ))}
      </div>

      {/* 項目卡片列表骨架 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: '16px 20px' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" width={32} height={32} />
                <div>
                  <Skeleton variant="text" width={120} height={16} style={{ marginBottom: 4 }} />
                  <Skeleton variant="text" width={140} height={12} />
                </div>
              </div>
              <Skeleton variant="text" width={90} height={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 7. Goals Skeleton
// ----------------------------------------------------
export function GoalsSkeleton() {
  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={140} height={28} />
          <Skeleton variant="text" width={220} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
      </div>

      {/* 總儲蓄卡片骨架 */}
      <div className="card" style={{ padding: 22, marginBottom: 24 }}>
        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: 8 }} />
        <Skeleton variant="text" width={180} height={28} style={{ marginBottom: 12 }} />
        <Skeleton variant="rect" height={10} borderRadius={5} />
      </div>

      {/* 目標卡片網格骨架 */}
      <div className="grid grid-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" width={32} height={32} />
                <Skeleton variant="text" width={100} height={18} />
              </div>
              <Skeleton variant="rect" width={50} height={20} borderRadius={6} />
            </div>
            <Skeleton variant="text" width={140} height={22} style={{ marginBottom: 10 }} />
            <Skeleton variant="rect" height={8} borderRadius={4} style={{ marginBottom: 12 }} />
            <div className="flex justify-between">
              <Skeleton variant="text" width={70} height={14} />
              <Skeleton variant="text" width={60} height={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 8. Forecast Skeleton
// ----------------------------------------------------
export function ForecastSkeleton() {
  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="text" width={260} height={16} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="rect" width={130} height={38} borderRadius={10} />
      </div>

      {/* 走勢圖卡片骨架 */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <Skeleton variant="text" width={130} height={20} />
          <Skeleton variant="text" width={100} height={16} />
        </div>
        <Skeleton variant="rect" height={280} borderRadius={12} />
      </div>

      {/* 購買力試算骨架 */}
      <div className="card" style={{ padding: 20 }}>
        <Skeleton variant="text" width={140} height={20} style={{ marginBottom: 14 }} />
        <div className="flex items-center gap-3">
          <Skeleton variant="rect" width={220} height={40} borderRadius={8} />
          <Skeleton variant="rect" width={110} height={40} borderRadius={8} />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 9. Bot Skeleton
// ----------------------------------------------------
export function BotSkeleton() {
  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <Skeleton variant="text" width={170} height={28} />
          <Skeleton variant="text" width={260} height={16} style={{ marginTop: 6 }} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* LINE 串接卡片骨架 */}
        <div className="card" style={{ padding: 22 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Skeleton variant="circle" width={38} height={38} />
            <div>
              <Skeleton variant="text" width={100} height={18} style={{ marginBottom: 4 }} />
              <Skeleton variant="text" width={70} height={14} />
            </div>
          </div>
          <Skeleton variant="rect" height={70} borderRadius={8} style={{ marginBottom: 14 }} />
          <Skeleton variant="rect" width={120} height={36} borderRadius={8} />
        </div>

        {/* Telegram 串接卡片骨架 */}
        <div className="card" style={{ padding: 22 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Skeleton variant="circle" width={38} height={38} />
            <div>
              <Skeleton variant="text" width={110} height={18} style={{ marginBottom: 4 }} />
              <Skeleton variant="text" width={70} height={14} />
            </div>
          </div>
          <Skeleton variant="rect" height={70} borderRadius={8} style={{ marginBottom: 14 }} />
          <Skeleton variant="rect" width={120} height={36} borderRadius={8} />
        </div>
      </div>
    </div>
  );
}
