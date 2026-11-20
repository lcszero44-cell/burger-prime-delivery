import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

// Eagerly map local food assets so string paths stored in config or Firestore resolve reliably in both dev and production builds.
const LOCAL_ASSET_MAP = import.meta.glob<string>('/src/assets/images/*', {
  eager: true,
  import: 'default',
});

function resolveFoodImageSrc(rawSrc: string): string {
  const trimmed = (rawSrc || '').trim();
  if (!trimmed) return '';
  if (LOCAL_ASSET_MAP[trimmed]) {
    return LOCAL_ASSET_MAP[trimmed];
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (LOCAL_ASSET_MAP[normalized]) {
    return LOCAL_ASSET_MAP[normalized];
  }
  return trimmed;
}

interface FoodImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

export function FoodImage({
  src,
  alt,
  className = '',
  eager = false,
}: FoodImageProps) {
  const resolvedSrc = resolveFoodImageSrc(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  if (hasError || !resolvedSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F0ECE6] to-[#E4DDD4] dark:from-[#262321] dark:to-[#1C1A19] text-[#78716C] dark:text-[#A8A29E] px-3 text-center ${className}`}
      >
        <UtensilsCrossed className="w-6 h-6 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium line-clamp-2 max-w-[160px]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#EFECE7] dark:bg-[#23201E] ${className}`}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
