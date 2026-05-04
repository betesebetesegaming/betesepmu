import React, { useRef } from 'react';

interface TableScrollNavigatorProps {
  children: React.ReactNode;
  className: string;
  stepX?: number;
  stepY?: number;
}

export const TableScrollNavigator: React.FC<TableScrollNavigatorProps> = ({
  children,
  className,
  stepX = 280,
  stepY = 220,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dx: number, dy: number) => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(0, -stepY)}
        className="print:hidden absolute left-1/2 -translate-x-1/2 top-2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
        aria-label="Scroll up"
        title="Move up"
      >
        ▲
      </button>

      <button
        type="button"
        onClick={() => scrollBy(-stepX, 0)}
        className="print:hidden absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
        aria-label="Scroll left"
        title="Move left"
      >
        ◀
      </button>

      <button
        type="button"
        onClick={() => scrollBy(stepX, 0)}
        className="print:hidden absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
        aria-label="Scroll right"
        title="Move right"
      >
        ▶
      </button>

      <button
        type="button"
        onClick={() => scrollBy(0, stepY)}
        className="print:hidden absolute left-1/2 -translate-x-1/2 bottom-2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
        aria-label="Scroll down"
        title="Move down"
      >
        ▼
      </button>

      <div ref={viewportRef} className={className}>
        {children}
      </div>
    </div>
  );
};
