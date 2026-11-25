import React from 'react';

interface EcoDnaLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export const EcoDnaLogo: React.FC<EcoDnaLogoProps> = ({ variant = 'dark', size = 'md' }) => {
  const iconSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  const textColor = variant === 'light' ? 'text-white' : 'text-[#061B14]';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSize} shrink-0`}
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="10" fill={variant === 'light' ? '#0D3B2E' : '#061B14'} />
        <path
          d="M12 10C12 16 28 16 28 22C28 28 12 28 12 31"
          stroke="#2DD4BF"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M28 10C28 16 12 16 12 22C12 28 28 28 28 31"
          stroke="#10B981"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <line x1="14.5" y1="13" x2="25.5" y2="13" stroke="#99F6E4" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14.5" y1="22" x2="25.5" y2="22" stroke="#6EE7B7" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14.5" y1="28.5" x2="25.5" y2="28.5" stroke="#99F6E4" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className={`font-display font-bold tracking-tight ${textSize} ${textColor}`}>
        Eco<span className="text-emerald-600">DNA</span>
      </span>
    </span>
  );
};
