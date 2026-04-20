import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`font-black text-3xl text-betese-dark tracking-tighter ${className}`} style={{ fontFamily: '"Arial Black", sans-serif' }}>
    BETESE PMU
  </div>
);