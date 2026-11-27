import { useId, type CSSProperties } from 'react';

interface BrandLogoProps {
  /** 'mark' = 無外框純圖示（側邊欄／頂欄）；'badge' = 圓角暖白／月影漸層底框徽章（登入頁／App Icon） */
  variant?: 'mark' | 'badge';
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function BrandLogo({
  variant = 'mark',
  size = 28,
  className,
  style,
}: BrandLogoProps) {
  const uid = useId().replace(/:/g, '');
  const bgGradId = `brand-bg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden="true"
    >
      {variant === 'badge' && (
        <defs>
          <linearGradient id={bgGradId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--logo-bg-start, #FFF9F8)" />
            <stop offset="1" stopColor="var(--logo-bg-end, #FFF1EB)" />
          </linearGradient>
        </defs>
      )}

      {variant === 'badge' && (
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill={`url(#${bgGradId})`}
          stroke="var(--logo-border, #FFDEDE)"
          strokeWidth="1.5"
        />
      )}

      {/* 左頁：個人私帳（珊瑚粉線條＋極淡粉暈） */}
      <path
        d="M32 33C29 29.8 23.5 28.5 14 29.2C12.3 29.3 11 30.7 11 32.4V47.6C11 49.4 12.5 50.8 14.3 50.6C23.5 49.8 29 51 32 53.5"
        fill="var(--logo-pink-soft, rgba(255, 138, 138, 0.14))"
        stroke="var(--logo-pink, #F27979)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 右頁：家庭公帳（柔天藍線條＋極淡藍暈） */}
      <path
        d="M32 33C35 29.8 40.5 28.5 50 29.2C51.7 29.3 53 30.7 53 32.4V47.6C53 49.4 51.5 50.8 49.7 50.6C40.5 49.8 35 51 32 53.5"
        fill="var(--logo-blue-soft, rgba(168, 216, 234, 0.22))"
        stroke="var(--logo-blue, #66B4D6)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 書脊中線 */}
      <path
        d="M32 33V53.5"
        stroke="var(--logo-pink, #F27979)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* 極簡書頁橫線 */}
      <path
        d="M16.5 36.5H25.5M16.5 42H23.5"
        stroke="var(--logo-pink, #F27979)"
        strokeWidth="2"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
      <path
        d="M38.5 36.5H47.5M40.5 42H47.5"
        stroke="var(--logo-blue, #66B4D6)"
        strokeWidth="2"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />

      {/* 上方飄浮：珊瑚粉線條愛心 */}
      <path
        d="M25.5 23.8C25.5 23.8 19.6 20 19.6 16.2C19.6 14.3 21.1 12.9 22.9 12.9C24 12.9 25 13.5 25.5 14.5C26 13.5 27 12.9 28.1 12.9C29.9 12.9 31.4 14.3 31.4 16.2C31.4 20 25.5 23.8 25.5 23.8Z"
        fill="var(--logo-pink-soft, rgba(255, 138, 138, 0.14))"
        stroke="var(--logo-pink, #F27979)"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 上方飄浮：暖杏金線條小錢幣 */}
      <circle
        cx="41.5"
        cy="18"
        r="7.5"
        fill="var(--logo-gold-soft, rgba(255, 212, 160, 0.38))"
        stroke="var(--logo-gold, #EB9E38)"
        strokeWidth="2.3"
      />
      <path
        d="M41.5 14.2V21.8M43.4 16.1C42.9 15.5 42.2 15.3 41.5 15.3C40.3 15.3 39.7 15.9 39.7 16.6C39.7 17.4 40.3 17.8 41.5 18.1C42.7 18.4 43.4 18.8 43.4 19.6C43.4 20.4 42.7 21 41.5 21C40.6 21 39.9 20.6 39.5 20"
        stroke="var(--logo-gold, #EB9E38)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
