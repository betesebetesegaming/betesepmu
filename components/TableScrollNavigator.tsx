import React, { useEffect, useRef, useState } from 'react';

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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = () => {
    const el = viewportRef.current;
    if (!el) return;

    const left = el.scrollLeft;
    const top = el.scrollTop;
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);

    setCanScrollLeft(left > 2);
    setCanScrollRight(left < maxLeft - 2);
    setCanScrollUp(top > 2);
    setCanScrollDown(top < maxTop - 2);
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    updateScrollState();

    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollState());
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [children, className]);

  const scrollBy = (dx: number, dy: number) => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {canScrollUp && (
        <button
          type="button"
          onClick={() => scrollBy(0, -stepY)}
          className="print:hidden absolute left-1/2 -translate-x-1/2 top-2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
          aria-label="Scroll up"
          title="Move up"
        >
          ▲
        </button>
      )}

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-stepX, 0)}
          className="print:hidden absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
          aria-label="Scroll left"
          title="Move left"
        >
          ◀
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(stepX, 0)}
          className="print:hidden absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
          aria-label="Scroll right"
          title="Move right"
        >
          ▶
        </button>
      )}

      {canScrollDown && (
        <button
          type="button"
          onClick={() => scrollBy(0, stepY)}
          className="print:hidden absolute left-1/2 -translate-x-1/2 bottom-2 z-20 h-8 w-8 rounded-full bg-betese-green text-white font-black shadow-md hover:bg-green-700"
          aria-label="Scroll down"
          title="Move down"
        >
          ▼
        </button>
      )}

      <div ref={viewportRef} className={className}>
        {children}
      </div>
    </div>
  );
};
