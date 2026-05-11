import React from 'react';

interface AfriMoneyLogoProps {
  className?: string;
  /** Height in pixels. Width scales proportionally. Default 28 */
  height?: number;
  /** When true, only shows the icon without the text */
  iconOnly?: boolean;
}

/**
 * AfriMoney brand logo — purple/magenta card-stack icon + "afrimoney" wordmark.
 * Faithfully reproduced as inline SVG so it works offline and in PDFs/prints.
 */
export const AfriMoneyLogo: React.FC<AfriMoneyLogoProps> = ({ className = '', height = 28, iconOnly = false }) => {
  const color = '#8B1A8A';
  const iconW = 36;
  const textW = iconOnly ? 0 : 82;
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
      aria-label="AfriMoney"
      role="img"
    >
      {/* ── Card-stack icon ── */}
      {/* Back card (slightly tilted) */}
      <rect x="3" y="5" width="26" height="18" rx="3" ry="3"
        fill={color} opacity="0.35" transform="rotate(-6 16 14)" />
      {/* Middle card */}
      <rect x="4" y="6" width="26" height="18" rx="3" ry="3"
        fill={color} opacity="0.55" transform="rotate(-2 17 15)" />
      {/* Front card */}
      <rect x="5" y="7" width="26" height="17" rx="3" ry="3"
        fill={color} />
      {/* Arrow pointing right on front card */}
      <polyline
        points="12,15  19,11  19,13  26,13  26,17  19,17  19,19"
        fill="white"
        stroke="none"
      />
      {/* Simpler arrow: right-pointing solid triangle + tail */}
      <g fill="white">
        {/* Tail */}
        <rect x="12" y="13.5" width="8" height="3" rx="1" />
        {/* Arrowhead */}
        <polygon points="19,10  27,15  19,20" />
      </g>

      {/* ── Wordmark ── */}
      {!iconOnly && (
        <text
          x={iconW + gap}
          y="21"
          fontFamily='"Helvetica Neue", Arial, sans-serif'
          fontSize="13"
          fontWeight="700"
          fill={color}
          letterSpacing="-0.3"
        >
          afrimoney
        </text>
      )}
    </svg>
  );
};
