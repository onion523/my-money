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

/** 共用三態視角切換列骨架（行動端自動 100% 三等分） */
function ScopeTabBarSkeleton() {
  return (
    <div className="scope-tab-bar" style={{ pointerEvents: 'none' }}>
      <Skeleton variant="rect" className="scope-tab-btn" width={76} height={32} borderRadius={8} />
      <Skeleton variant="rect" className="scope-tab-btn" width={76} height={32} borderRadius={8} />
      <Skeleton variant="rect" className="scope-tab-btn" width={76} height={32} borderRadius={8} />
    </div>
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(180px, 65%)" height={28} />
          <Skeleton variant="text" width="min(260px, 90%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
        </div>
      </div>

      {/* 公私帳篩選切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 四大統計卡片骨架 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 10 }}>
              <Skeleton variant="text" width="60%" height={14} />
              <Skeleton variant="circle" width={28} height={28} />
            </div>
            <Skeleton variant="text" width="80%" height={24} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="65%" height={12} />
          </div>
        ))}
      </div>

      {/* 帳戶總覽骨架 */}
      <div style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 14 }}>
          <Skeleton variant="text" width={120} height={20} />
          <Skeleton variant="text" width={60} height={16} />
        </div>
        <div className="grid grid-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ minWidth: 0 }}>
              <div className="flex items-center justify-between gap-2" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton variant="circle" width={28} height={28} />
                  <Skeleton variant="text" width="60%" height={16} />
                </div>
                <Skeleton variant="rect" width={50} height={20} borderRadius={6} style={{ flexShrink: 0 }} />
              </div>
              <Skeleton variant="text" width="55%" height={22} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="40%" height={12} />
            </div>
          ))}
        </div>
      </div>

      {/* 近期收支明細骨架 */}
      <div className="card">
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 16 }}>
          <Skeleton variant="text" width={110} height={20} />
          <Skeleton variant="text" width={60} height={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color-2)' }}>
              <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                <Skeleton variant="circle" width={36} height={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton variant="text" width="55%" height={16} style={{ marginBottom: 6 }} />
                  <Skeleton variant="text" width="75%" height={12} />
                </div>
              </div>
              <Skeleton variant="text" width={72} height={18} style={{ flexShrink: 0 }} />
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(160px, 60%)" height={28} />
          <Skeleton variant="text" width="min(240px, 85%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
        </div>
      </div>

      {/* 公私帳切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 篩選操作列骨架（對齊行動端可收合篩選列） */}
      <div className="card tx-filter-card" style={{ marginBottom: 20 }}>
        <div className="tx-filter-primary-row">
          <Skeleton variant="rect" height={40} borderRadius={10} style={{ flex: 1, minWidth: 0 }} />
          <Skeleton variant="rect" width={88} height={40} borderRadius={10} style={{ flexShrink: 0 }} />
        </div>
        <div className="tx-summary-strip">
          <Skeleton variant="text" width={80} height={14} />
          <div className="tx-summary-metrics">
            <Skeleton variant="rect" height={24} borderRadius={6} style={{ width: '100%', minWidth: 70 }} />
            <Skeleton variant="rect" height={24} borderRadius={6} style={{ width: '100%', minWidth: 70 }} />
            <Skeleton variant="rect" height={24} borderRadius={6} style={{ width: '100%', minWidth: 70 }} />
          </div>
        </div>
      </div>

      {/* 收支明細清單骨架 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(group => (
          <div key={group} className="card">
            <div className="flex items-center justify-between gap-2" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
              <Skeleton variant="text" width={100} height={16} />
              <Skeleton variant="text" width={72} height={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2].map(row => (
                <div key={row} className="flex items-center justify-between gap-3" style={{ padding: '8px 0' }}>
                  <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                    <Skeleton variant="circle" width={36} height={36} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Skeleton variant="text" width="55%" height={16} style={{ marginBottom: 6 }} />
                      <Skeleton variant="text" width="75%" height={12} />
                    </div>
                  </div>
                  <Skeleton variant="text" width={68} height={18} style={{ flexShrink: 0 }} />
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(150px, 60%)" height={28} />
          <Skeleton variant="text" width="min(220px, 85%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions accounts-header-actions">
          <Skeleton variant="rect" height={38} borderRadius={10} style={{ minWidth: 110 }} />
          <Skeleton variant="rect" height={38} borderRadius={10} style={{ minWidth: 110 }} />
          <Skeleton variant="rect" height={38} borderRadius={10} style={{ minWidth: 110 }} />
          <Skeleton variant="rect" height={38} borderRadius={10} style={{ minWidth: 110 }} />
        </div>
      </div>

      {/* 公私帳切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 三大資產統計卡片骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="stat-card" style={{ minWidth: 0 }}>
            <Skeleton variant="text" width="45%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="70%" height={26} style={{ marginBottom: 6 }} />
            <Skeleton variant="text" width="55%" height={12} />
          </div>
        ))}
      </div>

      {/* 帳戶卡片網格骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="card" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                <Skeleton variant="circle" width={28} height={28} />
                <Skeleton variant="text" width="60%" height={18} />
              </div>
              <Skeleton variant="rect" width={55} height={20} borderRadius={6} style={{ flexShrink: 0 }} />
            </div>
            <Skeleton variant="text" width="65%" height={24} style={{ marginBottom: 12 }} />
            <div className="flex justify-between gap-2" style={{ borderTop: '1px solid var(--border-color-2)', paddingTop: 10 }}>
              <Skeleton variant="text" width="40%" height={14} />
              <Skeleton variant="text" width="30%" height={14} />
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(160px, 60%)" height={28} />
          <Skeleton variant="text" width="min(240px, 85%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={140} height={38} borderRadius={8} />
        </div>
      </div>

      {/* 公私帳切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 圖表網格骨架 */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ minWidth: 0 }}>
          <Skeleton variant="text" width="50%" height={20} style={{ marginBottom: 16 }} />
          <Skeleton variant="rect" height={240} borderRadius={12} />
        </div>
        <div className="card" style={{ minWidth: 0 }}>
          <Skeleton variant="text" width="50%" height={20} style={{ marginBottom: 16 }} />
          <Skeleton variant="rect" height={240} borderRadius={12} />
        </div>
      </div>

      {/* 預算清單骨架 */}
      <div className="card">
        <Skeleton variant="text" width={120} height={20} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="flex justify-between gap-2" style={{ marginBottom: 6 }}>
                <Skeleton variant="text" width="35%" height={16} />
                <Skeleton variant="text" width="40%" height={16} />
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
// 5. Family Skeleton (1:1 對齊家庭橫幅 → 代墊中心 → 成員名冊)
// ----------------------------------------------------
export function FamilySkeleton() {
  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(180px, 65%)" height={28} />
          <Skeleton variant="text" width="min(260px, 90%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={120} height={40} borderRadius={10} />
        </div>
      </div>

      {/* 家庭資訊橫幅骨架 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="rect" width={48} height={48} borderRadius={14} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Skeleton variant="text" width="55%" height={22} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="75%" height={14} />
            </div>
          </div>
          <div className="family-banner-actions">
            <Skeleton variant="rect" width={96} height={36} borderRadius={8} />
            <Skeleton variant="rect" width={116} height={36} borderRadius={8} />
          </div>
        </div>
      </div>

      {/* 家庭公帳代墊與報銷中心骨架 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <Skeleton variant="text" width="min(200px, 70%)" height={20} style={{ marginBottom: 6 }} />
        <Skeleton variant="text" width="min(320px, 92%)" height={14} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-surface-2)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div className="flex justify-between items-center gap-3" style={{ flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton variant="text" width="45%" height={18} style={{ marginBottom: 6 }} />
                  <Skeleton variant="text" width="75%" height={13} />
                </div>
                <Skeleton variant="text" width={90} height={22} style={{ flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 家庭群組成員名冊骨架 */}
      <div className="card">
        <Skeleton variant="text" width={150} height={20} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} className="family-member-card">
              <div className="family-member-top">
                <div className="family-member-identity">
                  <Skeleton variant="circle" width={38} height={38} />
                  <Skeleton variant="text" width="45%" height={18} />
                </div>
                <Skeleton variant="rect" width={56} height={28} borderRadius={8} style={{ flexShrink: 0 }} />
              </div>
              <div className="family-member-meta">
                <Skeleton variant="text" width="65%" height={13} />
                <Skeleton variant="text" width="45%" height={13} />
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
      <div className="page-header-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(150px, 60%)" height={28} />
          <Skeleton variant="text" width="min(240px, 85%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={120} height={38} borderRadius={10} />
        </div>
      </div>

      {/* 公私帳切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 指標卡片骨架 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card" style={{ minWidth: 0 }}>
            <Skeleton variant="text" width="65%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="80%" height={24} />
          </div>
        ))}
      </div>

      {/* 項目卡片列表骨架 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="recurring-card" style={{ pointerEvents: 'none' }}>
            <div className="recurring-card-main">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" width={36} height={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton variant="text" width="50%" height={16} style={{ marginBottom: 6 }} />
                  <Skeleton variant="text" width="70%" height={12} />
                </div>
              </div>
            </div>
            <div className="recurring-card-side">
              <Skeleton variant="text" width={80} height={20} />
              <Skeleton variant="rect" width={64} height={30} borderRadius={8} />
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(140px, 60%)" height={28} />
          <Skeleton variant="text" width="min(220px, 85%)" height={16} style={{ marginTop: 6 }} />
        </div>
        <div className="header-actions">
          <Skeleton variant="rect" width={110} height={40} borderRadius={12} />
        </div>
      </div>

      {/* 總儲蓄統計卡片骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="stat-card" style={{ minWidth: 0 }}>
            <Skeleton variant="text" width="55%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="75%" height={26} />
          </div>
        ))}
      </div>

      {/* 目標卡片網格骨架 */}
      <div className="grid grid-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                <Skeleton variant="circle" width={32} height={32} />
                <Skeleton variant="text" width="60%" height={18} />
              </div>
              <Skeleton variant="rect" width={50} height={20} borderRadius={6} style={{ flexShrink: 0 }} />
            </div>
            <Skeleton variant="text" width="65%" height={22} style={{ marginBottom: 10 }} />
            <Skeleton variant="rect" height={8} borderRadius={4} style={{ marginBottom: 12 }} />
            <div className="flex justify-between gap-2">
              <Skeleton variant="text" width="40%" height={14} />
              <Skeleton variant="text" width="35%" height={14} />
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(160px, 60%)" height={28} />
          <Skeleton variant="text" width="min(260px, 90%)" height={16} style={{ marginTop: 6 }} />
        </div>
      </div>

      {/* 公私帳切換列骨架 */}
      <ScopeTabBarSkeleton />

      {/* 統計卡片骨架 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="stat-card" style={{ minWidth: 0 }}>
            <Skeleton variant="text" width="55%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="75%" height={26} />
          </div>
        ))}
      </div>

      <div className="grid-forecast-main">
        {/* 走勢圖卡片骨架 */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 16 }}>
            <Skeleton variant="text" width="45%" height={20} />
            <Skeleton variant="text" width="30%" height={16} />
          </div>
          <Skeleton variant="rect" height={260} borderRadius={12} />
        </div>

        {/* 購買力試算骨架 */}
        <div className="card" style={{ minWidth: 0 }}>
          <Skeleton variant="text" width="50%" height={20} style={{ marginBottom: 14 }} />
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <Skeleton variant="rect" height={40} borderRadius={8} style={{ flex: 1, minWidth: 140 }} />
            <Skeleton variant="rect" width={96} height={40} borderRadius={8} style={{ flexShrink: 0 }} />
          </div>
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton variant="text" width="min(170px, 65%)" height={28} />
          <Skeleton variant="text" width="min(260px, 90%)" height={16} style={{ marginTop: 6 }} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* 左側綁定卡片骨架 */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Skeleton variant="circle" width={38} height={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Skeleton variant="text" width="50%" height={18} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="75%" height={14} />
            </div>
          </div>
          <Skeleton variant="rect" height={70} borderRadius={8} style={{ marginBottom: 14 }} />
          <Skeleton variant="rect" width={120} height={36} borderRadius={8} />
        </div>

        {/* 右側對話測試卡片骨架 */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Skeleton variant="circle" width={38} height={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Skeleton variant="text" width="55%" height={18} style={{ marginBottom: 6 }} />
              <Skeleton variant="text" width="70%" height={14} />
            </div>
          </div>
          <Skeleton variant="rect" height={160} borderRadius={8} style={{ marginBottom: 14 }} />
          <div className="flex gap-2">
            <Skeleton variant="rect" height={38} borderRadius={8} style={{ flex: 1 }} />
            <Skeleton variant="rect" width={48} height={38} borderRadius={8} style={{ flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
