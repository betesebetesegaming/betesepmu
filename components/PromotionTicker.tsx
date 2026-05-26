import React from 'react';
import { Promotion } from '../types';

interface PromotionTickerProps {
  promotions: Promotion[];
}

const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mx-4 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

export const PromotionTicker: React.FC<PromotionTickerProps> = ({ promotions }) => {
  const activePromotions = promotions.filter(p => p.isActive);

  if (activePromotions.length === 0) {
    return null;
  }

  // Static mode only when there's a single active promotion AND the admin
  // explicitly switched its display mode to "static". Default is to scroll
  // so the banner can carry longer messages.
  const single = activePromotions.length === 1;
  const isStatic = single && activePromotions[0].displayMode === 'static';

  if (isStatic) {
    return (
        <div className="bg-yellow-400 text-betese-dark font-bold overflow-hidden whitespace-nowrap py-2.5 shadow-md rounded-md">
            <div className="flex justify-center items-center">
                <StarIcon />
                <span className="text-lg">{activePromotions[0].name}</span>
                <StarIcon />
            </div>
        </div>
    );
  }

  // Scrolling marquee. For a single promotion we still produce a smooth loop
  // by duplicating the item so the animation has content to scroll through.
  const renderList = single
    ? [activePromotions[0], activePromotions[0], activePromotions[0], activePromotions[0]]
    : [...activePromotions, ...activePromotions];
  const duration = Math.max(activePromotions.length * 10, 20); // Adjust speed; min 20s for single

  return (
    <>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee ${duration}s linear infinite;
        }
      `}</style>
      <div className="bg-yellow-400 text-betese-dark font-bold overflow-hidden whitespace-nowrap py-2.5 shadow-md rounded-md">
        <div className="flex animate-marquee hover:[animation-play-state:paused]">
          {renderList.map((promo, index) => (
            <div key={`${promo.id}-${index}`} className="flex-shrink-0 flex items-center">
                <StarIcon />
                <span className="text-lg">{promo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
