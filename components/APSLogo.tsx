import React from 'react';

interface APSLogoProps {
  className?: string;
  /** Height in pixels. Width scales proportionally. Default 28 */
  height?: number;
  /** When true, only shows the icon without the text */
  iconOnly?: boolean;
}

/**
 * APS Wallet brand logo — navy "APS" wordmark with purple "P" coin badge,
 * WALLET banner with checkmark, and "Endless Possibilities" tagline.
 * Inline SVG so it works offline and in PDFs/prints.
 */
export const APSLogo: React.FC<APSLogoProps> = ({ className = '', height = 28, iconOnly = false }) => {
  const navy = '#0d1b5e';
  const purple = '#5e4a9b';
  const purpleLight = '#8a78c2';
  const check = '#3bb273';
  const totalW = iconOnly ? 64 : 96;
  const totalH = 56;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalW} ${totalH}`}
      height={height}
      width={(height / totalH) * totalW}
      className={className}
      aria-label="APS Wallet"
      role="img"
    >
      {/* ── APS wordmark ── */}
      <text
        x="2"
        y="22"
        fontFamily='"Arial Black", "Helvetica Neue", Arial, sans-serif'
        fontSize="22"
        fontWeight="900"
        fill={navy}
        letterSpacing="-0.5"
      >
        APS
      </text>

      {/* ── P coin badge (top-right of APS) ── */}
      <g transform="translate(50, 2)">
        {/* Outer purple ring */}
        <circle cx="9" cy="9" r="9" fill={purpleLight} />
        {/* Inner darker purple */}
        <circle cx="9" cy="9" r="7" fill={purple} />
        {/* P letter */}
        <text
          x="9"
          y="13"
          textAnchor="middle"
          fontFamily='"Arial Black", "Helvetica Neue", Arial, sans-serif'
          fontSize="10"
          fontWeight="900"
          fill="#ffffff"
        >
          P
        </text>
      </g>

      {!iconOnly && (
        <>
          {/* ── WALLET banner ── */}
          <rect x="2" y="28" width={totalW - 4} height="14" rx="2" fill={navy} />
          <text
            x={totalW / 2 - 6}
            y="38"
            textAnchor="middle"
            fontFamily='"Arial Black", "Helvetica Neue", Arial, sans-serif'
            fontSize="9"
            fontWeight="900"
            fill="#ffffff"
            letterSpacing="1"
          >
            WALLET
          </text>
          {/* Checkmark */}
          <path
            d={`M ${totalW - 14} 35 l 2 2 l 4 -4`}
            stroke={check}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ── Tagline ── */}
          <text
            x={totalW / 2}
            y="52"
            textAnchor="middle"
            fontFamily='"Helvetica Neue", Arial, sans-serif'
            fontSize="6"
            fontWeight="600"
            fill={navy}
            letterSpacing="0.3"
          >
            Endless Possibilities
          </text>
        </>
      )}
    </svg>
  );
};
