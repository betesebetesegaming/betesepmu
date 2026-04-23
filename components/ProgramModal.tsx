
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ProgramImage } from '../types';

// Make TypeScript aware of the html2canvas library loaded from the CDN
declare var html2canvas: any;

const BeteseAd: React.FC = () => (
    <div className="bg-gradient-to-r from-blue-800 via-purple-700 to-blue-800 border-2 border-yellow-400 p-1 flex items-stretch text-white text-center leading-tight">
        <div className="flex flex-col justify-around items-center w-[30%]">
            <span className="font-bold text-lg text-betese-green" style={{ fontFamily: 'Impact, sans-serif' }}>BetEse</span>
            <span className="text-[7px]">Get money back if you lose one game</span>
        </div>
        <div className="flex flex-col justify-center items-center flex-grow border-l-2 border-r-2 border-yellow-400 px-1">
            <span className="font-extrabold text-sm">AGENT</span>
            <span className="font-extrabold text-xl text-yellow-400">HYPER BOOST</span>
            <span className="font-extrabold text-3xl text-yellow-400">1000%</span>
            <span className="text-[8px]">HYPER BONUS BETS</span>
        </div>
        <div className="flex flex-col justify-around items-center w-[30%]">
            <span className="text-xs font-bold">First Deposit</span>
            <span className="text-3xl font-extrabold text-betese-green">300%</span>
            <span className="text-sm font-bold">Welcome Bonus</span>
            <span className="text-[6px] italic -mt-1">Bonus is given on your first deposit</span>
        </div>
    </div>
);


const ActualProgram = React.forwardRef<HTMLDivElement, { imageSrc: string | null, mediaType: 'image' | 'video', zoom: number, position: { x: number, y: number } }>(({ imageSrc, mediaType, zoom, position }, ref) => {
    const style = {
        transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
        transition: 'transform 0.2s ease-out',
        transformOrigin: 'top left',
    };
    
    if (imageSrc) {
        return (
             <div ref={ref} className="bg-white p-1 flex justify-center items-center h-full w-full" style={style}>
                {mediaType === 'video' ? (
                    <video src={imageSrc} className="max-w-full max-h-full h-auto object-contain" controls playsInline />
                ) : (
                    <img src={imageSrc} alt="Daily Program" className="max-w-full max-h-full h-auto object-contain" />
                )}
            </div>
        )
    }

    const tableHeader = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const coteData = ['4/1', '7/1', '8/1', '12/1', '16/1', '17/1', '6/1', '9/1', '14/1', '20/1', '35/1', '10/1', '15/1', '30/1', '45/1', '13/1'];
    const tableData = [
        { name: 'Sénégal', values: [7, 14, 11, 1, 10, 4, 5, 9] },
        { name: 'BRUNO DIEHL', values: [4, 12, 6, 13, 8, 16, 3, 7] },
        { name: 'YANN DAIGNEAU', values: [3, 8, 14, 1, 5, 10, 16, 13] },
        { name: 'C.MEYER', values: [2, 7, 13, 8, 12, 6, 4, 9] },
        { name: 'G. BERNH', values: [1, 5, 8, 2, 9, 7, 12, 6] },
        { name: 'H. DEBRUYNE', values: [4, 5, 8, 7, 9, 3, 14, 13] },
        { name: 'MARIO PUTRINO', values: [8, 10, 16, 3, 4, 1, 6, 14] },
        { name: 'JOHAN GERARD', values: [7, 4, 1, 3, 2, 10, 8, 12] },
        { name: 'LE PARISIEN', values: [3, 7, 9, 12, 8, 5, 4, 1] },
        { name: 'LE REPUBLICAIN', values: [2, 4, 10, 6, 14, 1, 5, 16] },
        { name: 'QUINTENET', values: [4, 1, 7, 16, 5, 13, 9, 3] },
        { name: 'AIP', values: [7, 4, 10, 12, 14, 16, 5, 8] },
        { name: 'SUD-OUEST', values: [8, 2, 13, 1, 3, 5, 4, 6] },
        { name: 'PRESSE OCEAN', values: [1, 10, 7, 12, 9, 13, 2, 8] },
        { name: 'RADIO HAUTE', values: [4, 8, 14, 16, 3, 5, 1, 6] },
    ];
    const listTypeData = [
        { name: 'Liste type', values: [1, 7, 8, 3, 2, 12, 4, 6, 5, 16, 9, 10, 13, 14, 11, 15] },
        { name: 'N. de fois Cités', values: [22, 21, 18, 18, 17, 15, 13, 10, 9, 8, 6, 5, 5, 3, 0, 0] },
        { name: 'Pts attribués :', values: [47, 45, 39, 36, 36, 30, 30, 22, 22, 12, 10, 7, 7, 5, 3, 0] },
    ];
    const coupDeCoeurTable = [
        { name: 'Coup De Coeur', values: [10] },
        { name: 'Photo', values: [1, 7] },
        { name: 'Forme', values: [1, 12, 14, 7, 3] },
        { name: 'Régularité', values: [2, 10, 9, 13, 8] },
        { name: 'Progrès', values: [10, 5, 8, 6, 1] },
        { name: 'Jackpot', values: [15, 11, '-', '-'] },
        { name: 'Chance Régulière', values: [3, 8, 12, 5, 16] },
        { name: 'Cites En 1er P.', values: [7, 4, 1, 3, 2] },
    ]

    return (
        <div ref={ref} className="bg-white p-1 font-sans text-black max-w-[800px] mx-auto w-full" style={style}>
            <h1 className="text-center text-4xl font-black tracking-tighter" style={{ fontFamily: '"Arial Black", sans-serif' }}>MAIN RACE — 14:15PM</h1>
            <div className="bg-black text-white text-center p-1 my-1 text-sm font-bold" style={{ fontFamily: '"Arial Black", sans-serif' }}>
                PMU ALR1-PRONOSTICS DIMANCHE 09 NOVEMBRE 2025-ALR1 14H15
            </div>
            
            <div className="flex gap-1">
                <div className="w-2/3">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border p-0.5 w-[20%]">PMU 18+</th>
                                {tableHeader.map(h => <th key={h} className="border p-0.5">{h}</th>)}
                            </tr>
                            <tr>
                                <td className="border p-0.5 font-bold">Cote</td>
                                {coteData.map((c, i) => <td key={i} className="border p-0.5 text-center text-[10px]">{c}</td>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map(row => (
                                <tr key={row.name}>
                                    <td className="border p-0.5 font-bold">● {row.name}</td>
                                    {row.values.map((val, idx) => <td key={idx} className="border p-0.5 text-center font-bold">{val}</td>)}
                                    {Array(16 - row.values.length).fill(0).map((_, i) => <td key={i} className="border p-0.5"></td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <table className="w-full border-collapse text-xs mt-1">
                        <tbody>
                             {listTypeData.map(row => (
                                <tr key={row.name}>
                                    <td className="border p-0.5 font-bold w-[20%]">● {row.name}</td>
                                    {row.values.map((val, idx) => <td key={idx} className="border p-0.5 text-center font-bold">{val}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="w-1/3 flex flex-col justify-between">
                    <BeteseAd />
                    <BeteseAd />
                    <BeteseAd />
                    <BeteseAd />
                </div>
            </div>

            <div className="flex gap-1 mt-1 text-xs">
                <div className="w-1/4 border p-1">
                    <h3 className="font-bold underline">SYNTHESE PMU.FR</h3>
                    <p className="font-bold">FAVORIS:</p>
                    <p>1.7.8.3.2.12.4.6</p>
                    <p className="font-bold">OUTSIDERS: 5.16</p>
                    <p className="font-bold">DELAISSES:</p>
                    <p>9.10.13.14.11.15</p>
                </div>
                <div className="w-1/4 border p-1">
                    <h3 className="font-bold underline">Pronostics de la Presse</h3>
                    <p>Sélection : 1.7.4</p>
                    <p>Belles Chances :</p>
                    <p>12.2.3.8.16</p>
                    <p>Outsiders :</p>
                    <p>9.5.6.13.14.10</p>
                    <p>Délaisses : 15.11</p>
                </div>
                <div className="w-1/2 border p-1 text-[10px] leading-tight">
                    <h3 className="font-bold underline">Coup de cœur</h3>
                    <p>Joh Spirit (10) a bien gagné à Bordeaux, dans le terrain lourd qu'elle affectionne. Elle a été lourdement pénalisée, mais avait gagné un Quintè+ en 38 en début d'année. Elle arrive dans sa saison favorite, a déjà bien couru sur ce parcours et retrouve son pilote fétiche. Elle aurait préféré une piste encore plus lourde, mais cela devrait quand même aller. Je serais déçu de ne pas la voir faire l'arrivée.</p>
                </div>
            </div>
            
            <div className="flex gap-1 mt-1 items-end">
                <div className="w-1/2">
                    <table className="w-full border-collapse text-xs">
                        <tbody>
                            {coupDeCoeurTable.map(row => (
                                <tr key={row.name}>
                                    <td className="border p-0.5 font-bold">● {row.name}</td>
                                    {row.values.map((v, i) => <td key={i} className="border p-0.5 text-center font-bold">{v}</td>)}
                                    {Array(5 - row.values.length).fill(0).map((_, i) => <td key={i} className="border p-0.5"></td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="w-1/2 flex flex-col">
                    <BeteseAd />
                    <span className="text-right font-black text-6xl tracking-widest mt-1" style={{ fontFamily: '"Arial Black", sans-serif' }}>2426089</span>
                </div>
            </div>
        </div>
    );
});


interface ProgramModalProps {
    isOpen: boolean;
    onClose: () => void;
    programImages: ProgramImage[];
}

export const ProgramModal: React.FC<ProgramModalProps> = ({ isOpen, onClose, programImages }) => {
    const programRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Zoom and Pan state
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

    // Touch pinch-to-zoom state
    const lastPinchDistRef = useRef<number | null>(null);
    const lastZoomRef = useRef(1);

    // Touch swipe state
    const touchStartXRef = useRef<number | null>(null);

    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [isOpen, activeIndex]);

    useEffect(() => {
        if (activeIndex > 0 && activeIndex >= programImages.length) {
            setActiveIndex(0);
        }
    }, [activeIndex, programImages.length]);

    const handleNext = useCallback(() => {
        if (programImages.length <= 1) return;
        setActiveIndex((prev) => (prev + 1) % programImages.length);
    }, [programImages.length]);
    const handlePrev = useCallback(() => {
        if (programImages.length <= 1) return;
        setActiveIndex((prev) => (prev - 1 + programImages.length) % programImages.length);
    }, [programImages.length]);

    const handleZoomIn  = () => setZoom(prev => Math.min(parseFloat((prev + 0.25).toFixed(2)), 4));
    const handleZoomOut = () => { setZoom(prev => { const next = Math.max(parseFloat((prev - 0.25).toFixed(2)), 1); if (next === 1) setPosition({ x: 0, y: 0 }); return next; }); };
    const handleZoomReset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === '+' || e.key === '=') handleZoomIn();
            if (e.key === '-') handleZoomOut();
            if (e.key === '0') handleZoomReset();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, handleNext, handlePrev, onClose]);

    const handleImageClick = () => {
        if (zoom === 1) setZoom(2);
        else handleZoomReset();
    };

    // Mouse drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) { e.preventDefault(); setIsDragging(true); setStartDrag({ x: e.clientX - position.x, y: e.clientY - position.y }); }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) { e.preventDefault(); setPosition({ x: e.clientX - startDrag.x, y: e.clientY - startDrag.y }); }
    };
    const handleMouseUpOrLeave = () => setIsDragging(false);

    // Touch events — swipe to navigate, pinch to zoom
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            touchStartXRef.current = e.touches[0].clientX;
        } else if (e.touches.length === 2) {
            touchStartXRef.current = null;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDistRef.current = Math.hypot(dx, dy);
            lastZoomRef.current = zoom;
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastPinchDistRef.current !== null) {
                const scale = dist / lastPinchDistRef.current;
                const newZoom = Math.min(Math.max(parseFloat((lastZoomRef.current * scale).toFixed(2)), 1), 4);
                setZoom(newZoom);
                if (newZoom === 1) setPosition({ x: 0, y: 0 });
            }
        }
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        lastPinchDistRef.current = null;
        if (e.changedTouches.length === 1 && touchStartXRef.current !== null && zoom === 1) {
            const diff = e.changedTouches[0].clientX - touchStartXRef.current;
            if (Math.abs(diff) > 50) {
                if (diff < 0) handleNext();
                else handlePrev();
            }
        }
        touchStartXRef.current = null;
    };

    const hasImages = programImages.length > 0;
    const currentImage = hasImages ? programImages[activeIndex] : null;

    const getCursorStyle = () => {
        if (zoom > 1) return isDragging ? 'grabbing' : 'grab';
        return hasImages ? 'zoom-in' : 'default';
    };

    const handleDownload = async () => {
        const imageUrl = currentImage?.url;
        if (imageUrl) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const fileExt = currentImage?.mediaType === 'video' ? 'mp4' : 'png';
                link.download = `betese-${currentImage?.type || 'program'}-${activeIndex + 1}.${fileExt}`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                return;
            } catch { /* fall through */ }
        }
        if (programRef.current) {
            try {
                const orig = programRef.current.style.transform;
                programRef.current.style.transform = 'scale(1) translate(0,0)';
                const canvas = await html2canvas(programRef.current, { scale: 2, useCORS: true });
                programRef.current.style.transform = orig;
                const link = document.createElement('a');
                link.download = `betese-${currentImage?.type || 'program'}-${activeIndex + 1}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                alert('Sorry, there was an error generating the image for download.');
            }
        }
    };

    const handleShare = async () => {
        if (!navigator.share) {
            const imageUrl = currentImage?.url;
            if (imageUrl && navigator.clipboard) {
                try { await navigator.clipboard.writeText(imageUrl); alert('Image link copied to clipboard! You can now paste and share it.'); }
                catch { alert('Sharing is not supported by your browser. Try downloading the image instead.'); }
            } else {
                alert('Sharing is not supported by your browser. Try downloading the image instead.');
            }
            return;
        }
        try {
            const imageUrl = currentImage?.url;
            if (imageUrl) {
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const fileExt = currentImage?.mediaType === 'video' ? 'mp4' : 'png';
                    const file = new File([blob], `betese-${currentImage?.type || 'program'}.${fileExt}`, { type: blob.type || 'application/octet-stream' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'Betese PMU', text: `Today's racing program from Betese PMU!`, files: [file] });
                        return;
                    }
                } catch { /* fall through */ }
            }
            if (programRef.current) {
                const orig = programRef.current.style.transform;
                programRef.current.style.transform = 'scale(1) translate(0,0)';
                const canvas = await html2canvas(programRef.current, { scale: 2, useCORS: true });
                programRef.current.style.transform = orig;
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const file = new File([blob], `betese-program.png`, { type: 'image/png' });
                        await navigator.share({ title: 'Betese PMU', text: `Today's racing program!`, files: [file] });
                    }
                }, 'image/png');
            }
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') alert('An error occurred while trying to share.');
        }
    };

    if (!isOpen) return null;

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const zoomPct = Math.round(zoom * 100);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
            <div
                className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${isFullscreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-5xl h-[95vh]'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <div className="min-w-0">
                            <p className="text-white font-black text-sm sm:text-base uppercase leading-none truncate">
                                {currentImage ? `Program — Page ${activeIndex + 1} of ${programImages.length}` : "Today's Racing Program"}
                            </p>
                            <p className="text-blue-200 text-[11px] font-medium leading-none mt-0.5">{today}</p>
                        </div>
                        <span className="flex-shrink-0 bg-yellow-400 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">LIVE</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setIsFullscreen(f => !f)}
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            {isFullscreen
                                ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            }
                        </button>
                        <button onClick={onClose} title="Close (Esc)" className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Hint bar ── */}
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-1 flex items-center justify-center gap-3 text-blue-600 text-[11px] font-semibold flex-shrink-0 flex-wrap">
                    <span>Tap image to zoom</span>
                    <span>·</span>
                    <span>Drag to pan when zoomed</span>
                    {programImages.length > 1 && <><span>·</span><span>Swipe or arrows to navigate</span></>}
                    <span>·</span>
                    <span>Use keyboard: left, right, +, -, 0</span>
                </div>

                {/* ── Main image area ── */}
                <div
                    className="flex-1 bg-gray-900 relative overflow-hidden"
                    style={{ cursor: getCursorStyle() }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                    onClick={handleImageClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <ActualProgram ref={programRef} imageSrc={currentImage?.url ?? null} mediaType={currentImage?.mediaType || 'image'} zoom={zoom} position={position} />

                    {/* Zoom badge */}
                    {zoom !== 1 && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-black px-3 py-1 rounded-full pointer-events-none">
                            {zoomPct}%
                        </div>
                    )}

                    {/* Prev / Next arrows */}
                    {hasImages && programImages.length > 1 && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full z-10 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full z-10 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </>
                    )}
                </div>

                {/* ── Thumbnail strip ── */}
                {hasImages && programImages.length > 1 && (
                    <div className="bg-gray-800 border-t border-gray-700 px-2 py-2 flex-shrink-0">
                        <div className="flex justify-center items-center gap-2 overflow-x-auto">
                            {programImages.map((image, index) => (
                                <button
                                    key={image.id}
                                    onClick={() => setActiveIndex(index)}
                                    className={`relative w-16 h-12 sm:w-20 sm:h-14 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${index === activeIndex ? 'border-yellow-400 scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-90'}`}
                                >
                                    {image.mediaType === 'video' ? (
                                        <video src={image.url} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                        <img src={image.url} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-bold">{index + 1}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Bottom toolbar ── */}
                <div className="bg-white border-t px-3 py-2 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }} disabled={zoom <= 1} title="Zoom out (-)" className="w-8 h-8 rounded-lg bg-white shadow-sm font-black text-lg disabled:opacity-30 hover:bg-gray-50 transition-colors flex items-center justify-center">−</button>
                        <button onClick={(e) => { e.stopPropagation(); handleZoomReset(); }} title="Reset zoom (0)" className="px-3 h-8 rounded-lg bg-white shadow-sm text-xs font-black hover:bg-gray-50 transition-colors min-w-[52px]">{zoomPct}%</button>
                        <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }} disabled={zoom >= 4} title="Zoom in (+)" className="w-8 h-8 rounded-lg bg-white shadow-sm font-black text-lg disabled:opacity-30 hover:bg-gray-50 transition-colors flex items-center justify-center">+</button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            disabled={!hasImages}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm disabled:bg-gray-300 transition-colors text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            Download
                        </button>
                        <button
                            onClick={handleShare}
                            disabled={!hasImages}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-sm disabled:bg-gray-300 transition-colors text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                            Share
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
