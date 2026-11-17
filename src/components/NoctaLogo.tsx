import React from 'react';

interface NoctaLogoProps {
  compact?: boolean;
  className?: string;
}

export function NoctaEmblem({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16.5" cy="20" r="10.5" stroke="#C5A276" strokeWidth="1.5" />
      <circle cx="23.5" cy="20" r="10.5" stroke="#781D35" strokeWidth="1.5" />
      <path
        d="M20 11.2C22.4 13.3 23.9 16.5 23.9 20C23.9 23.5 22.4 26.7 20 28.8C17.6 26.7 16.1 23.5 16.1 20C16.1 16.5 17.6 13.3 20 11.2Z"
        fill="#4B1028"
        fillOpacity="0.65"
      />
    </svg>
  );
}

export function NoctaLogo({ compact = false, className = '' }: NoctaLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <NoctaEmblem size={compact ? 24 : 28} />
      {!compact && (
        <span className="font-display text-2xl font-semibold tracking-[0.2em] text-[#F4EEF0]">
          NOCTA
        </span>
      )}
    </span>
  );
}
