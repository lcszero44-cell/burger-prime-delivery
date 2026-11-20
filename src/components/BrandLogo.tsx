import { useState } from 'react';

interface BrandLogoProps {
  logoUrl?: string;
  storeName: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({
  logoUrl,
  storeName,
  size = 'md',
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const dims =
    size === 'sm'
      ? 'h-10 w-10 rounded-xl'
      : size === 'lg'
        ? 'h-16 w-16 rounded-2xl'
        : 'h-14 w-14 rounded-2xl';

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={`Logo ${storeName}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${dims} object-cover shrink-0 border border-black/10 dark:border-white/10 shadow-sm`}
      />
    );
  }

  return (
    <div
      aria-label={`Logo ${storeName}`}
      className={`${dims} shrink-0 flex items-center justify-center shadow-sm text-white select-none`}
      style={{ backgroundColor: 'var(--brand-primary)' }}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-7/12 h-7/12"
        aria-hidden="true"
      >
        {/* Top brioche dome */}
        <path
          d="M6 16.5C6 10.7 11.37 7 18 7C24.63 7 30 10.7 30 16.5H6Z"
          fill="currentColor"
        />
        {/* Sesame accents */}
        <circle cx="13.5" cy="11.8" r="1.1" fill="#181615" fillOpacity="0.32" />
        <circle cx="18.2" cy="10.4" r="1.1" fill="#181615" fillOpacity="0.32" />
        <circle cx="22.8" cy="12.2" r="1.1" fill="#181615" fillOpacity="0.32" />
        {/* Flame-seared patty + melted cheddar wave */}
        <rect x="4.5" y="19" width="27" height="4.6" rx="2.3" fill="currentColor" />
        {/* Bottom bun */}
        <path
          d="M6.5 26H29.5V27.2C29.5 29.02 28.02 30.5 26.2 30.5H9.8C7.98 30.5 6.5 29.02 6.5 27.2V26Z"
          fill="currentColor"
          fillOpacity="0.88"
        />
      </svg>
    </div>
  );
}
