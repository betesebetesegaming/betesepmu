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
      <div ref={viewportRef} className={className}>
        {children}
      </div>
    </div>
  );
};
