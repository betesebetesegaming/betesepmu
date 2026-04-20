
import React, { useState, useRef, useEffect } from 'react';
import { ProgramImage } from '../types';

interface PromotionCarouselProps {
  ads: ProgramImage[];
  onClose?: () => void;
}

export const PromotionCarousel: React.FC<PromotionCarouselProps> = ({ ads, onClose }) => {
  const [isMuted, setIsMuted] = useState(true); // Default to muted to ensure autoplay works on browsers
  
  if (ads.length === 0) {
    return null;
  }
  
  // The duration of the scroll. 
  const scrollDuration = Math.max(ads.length * 10, 20); 

  const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMuted(!isMuted);
  };

  return (
    <>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrolling-wrapper .animate-scroll {
          animation: scroll ${scrollDuration}s linear infinite;
          width: max-content;
        }
      `}</style>
      <div className="relative bg-gray-900 p-1 rounded-lg shadow-lg border-4 border-gray-700 overflow-hidden group mb-4">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-start p-1 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <h3 className="text-white font-bold text-xs tracking-wider uppercase opacity-90 ml-2 mt-1">
            Live TV
            </h3>
            
            <div className="flex gap-2 pointer-events-auto">
                {/* Sound Toggle */}
                <button 
                    onClick={toggleMute}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${isMuted ? 'bg-gray-800/80 text-gray-400 border-gray-600' : 'bg-betese-green text-white border-white animate-pulse'}`}
                    title={isMuted ? "Unmute Commercials" : "Mute Sound"}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    )}
                </button>

                {/* Close Button */}
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-red-600 transition-colors border border-gray-500"
                        title="Close TV"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>

        {/* Scroll Area */}
        <div className="overflow-hidden bg-black rounded scrolling-wrapper relative h-40">
          <div className="flex animate-scroll hover:[animation-play-state:paused]">
            {/* We render the list twice. The animation moves -50%, effectively seamlessly swapping List 1 for List 2 */}
            {[...ads, ...ads].map((ad, index) => (
              <div key={`${ad.id}-${index}`} className="flex-shrink-0 w-[295px] h-full bg-black border-r border-gray-800/50 relative">
                 {ad.mediaType === 'video' ? (
                    <video 
                        src={ad.url} 
                        className="w-full h-full object-cover" 
                        autoPlay 
                        muted={isMuted}
                        loop 
                        playsInline
                    />
                 ) : (
                    <img 
                      src={ad.url} 
                      alt={`Advertisement ${index + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                 )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
