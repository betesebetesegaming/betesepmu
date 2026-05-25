import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src="/logo.png"
    alt="Betese PMU"
    className={`object-contain select-none ${className ?? ''}`}
    draggable={false}
  />
);
