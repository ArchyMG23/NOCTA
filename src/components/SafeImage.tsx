import React, { useEffect, useState } from 'react';
import { NoctaEmblem } from './NoctaLogo';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function SafeImage({ src, alt, className = '' }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#191217] text-[#B8AAB0] ${className}`}
        role="img"
        aria-label={alt}
      >
        <NoctaEmblem size={36} />
        <span className="mt-3 text-xs tracking-wider text-[#B8AAB0] px-4 text-center">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
