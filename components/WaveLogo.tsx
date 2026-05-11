import React from 'react';

interface WaveLogoProps {
  className?: string;
  /** Height in pixels. Width scales proportionally. Default 28 */
  height?: number;
  /** When true, only shows the icon without the text */
  iconOnly?: boolean;
}

/**
 * Wave brand logo — blue wave/water icon + "Wave" wordmark.
 * Designed to match Wave's mobile money branding.
 */
export const WaveLogo: React.FC<WaveLogoProps> = ({ className = '', height = 28, iconOnly = false }) => {
  const color = '#0099FF';
  const iconW = 36;
  const textW = iconOnly ? 0 : 50;
  const gap = iconOnly ? 0 : 4;
  const totalW = iconW + gap + textW;
  const totalH = 28;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalW} ${totalH}`}
      height={height}
      width={(height / totalH) * totalW}
      className={className}
      aria-label="Wave"
      role="img"
    >
      {/* ── Wave icon (water waves) ── */}
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="18" cy="14" r="15" fill={color} opacity="0.15" />

      {/* Wave 1 (top curve) */}
      <path
        d="M 5 14 Q 9 10, 13 12 T 21 12 T 29 12 T 32 14"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wave 2 (middle curve) */}
      <path
        d="M 3 16 Q 7 13, 11 15 T 19 15 T 27 15 T 32 17"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wave 3 (bottom curve) */}
      <path
        d="M 4 19 Q 8 16, 12 18 T 20 18 T 28 18 T 32 20"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />

      {/* ── Wordmark ── */}
      {!iconOnly && (
        <text
          x={iconW + gap}
          y="21"
          fontFamily='"Helvetica Neue", Arial, sans-serif'
          fontSize="14"
          fontWeight="700"
          fill={color}
          letterSpacing="0.5"
        >
          Wave
        </text>
      )}
    </svg>
  );
};
