
import React, { useRef, useState, useEffect } from 'react';
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


const ActualProgram = React.forwardRef<HTMLDivElement, { imageSrc: string | null, zoom: number, position: { x: number, y: number } }>(({ imageSrc, zoom, position }, ref) => {
    const style = {
        transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
        transition: 'transform 0.2s ease-out',
        transformOrigin: 'top left',
    };
    
    if (imageSrc) {
        return (
             <div ref={ref} className="bg-white p-1 flex justify-center items-center h-full w-full" style={style}>
                <img src={imageSrc} alt="Daily Program" className="max-w-full max-h-full h-auto object-contain" />
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

    // Zoom and Pan state
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Reset zoom and position when modal is opened or image changes
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [isOpen, activeIndex]);
    
    if (!isOpen) return null;

    const handleNext = () => setActiveIndex((prev) => (prev + 1) % programImages.length);
    const handlePrev = () => setActiveIndex((prev) => (prev - 1 + programImages.length) % programImages.length);
    
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 1));
    const handleZoomReset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

    const handleImageClick = () => {
        if (zoom === 1) {
            setZoom(2);
        } else {
            handleZoomReset();
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            e.preventDefault();
            setIsDragging(true);
            setStartDrag({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            setPosition({
                x: e.clientX - startDrag.x,
                y: e.clientY - startDrag.y,
            });
        }
    };

    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
    };

    const handleDownload = async () => {
        if (programRef.current) {
            try {
                // Temporarily reset transform for clean capture
                const originalTransform = programRef.current.style.transform;
                programRef.current.style.transform = 'scale(1) translate(0,0)';
                
                const canvas = await html2canvas(programRef.current, { scale: 2, useCORS: true });
                
                // Restore transform
                programRef.current.style.transform = originalTransform;

                const link = document.createElement('a');
                link.download = `betese-${programImages[activeIndex]?.type || 'program'}-${activeIndex + 1}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                console.error("Error generating image:", error);
                alert("Sorry, there was an error generating the image for download.");
            }
        }
    };

    const handleShare = async () => {
        if (programRef.current && navigator.share) {
            try {
                // Temporarily reset transform for clean capture
                const originalTransform = programRef.current.style.transform;
                programRef.current.style.transform = 'scale(1) translate(0,0)';

                const canvas = await html2canvas(programRef.current, { scale: 2, useCORS: true });
                
                 // Restore transform
                programRef.current.style.transform = originalTransform;

                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const file = new File([blob], `betese-${programImages[activeIndex]?.type || 'program'}.png`, { type: 'image/png' });
                        await navigator.share({
                            title: "Betese PMU Content",
                            text: `Here is today's ${programImages[activeIndex]?.type || 'program'} from Betese PMU!`,
                            files: [file],
                        });
                    }
                }, 'image/png');
            } catch (error) {
                 if ((error as DOMException).name !== 'AbortError') {
                    alert('An error occurred while trying to share.');
                }
            }
        } else {
            alert('Web Share is not supported by your browser. Try downloading the image instead.');
        }
    };
    
    const hasImages = programImages.length > 0;
    const currentImage = hasImages ? programImages[activeIndex] : null;

    const getCursorStyle = () => {
        if (zoom > 1) return isDragging ? 'grabbing' : 'grab';
        return hasImages ? 'zoom-in' : 'default';
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b">
                     <h2 className="text-xl font-bold text-betese-dark">
                        {currentImage ? `${currentImage.type.charAt(0).toUpperCase() + currentImage.type.slice(1)} (${activeIndex + 1}/${programImages.length})` : "Today's Racing Program"}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div 
                    className="flex-1 p-4 bg-gray-100 relative overflow-hidden"
                    style={{ cursor: getCursorStyle() }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                    onClick={handleImageClick}
                >
                     <ActualProgram ref={programRef} imageSrc={currentImage?.url ?? null} zoom={zoom} position={position} />
                     {hasImages && programImages.length > 1 && (
                         <>
                         <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 z-10">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                         </button>
                         </>
                     )}
                </div>
                 {hasImages && programImages.length > 1 && (
                     <div className="p-2 bg-gray-200 border-t">
                        <div className="flex justify-center items-center gap-2 overflow-x-auto">
                             {programImages.map((image, index) => (
                                 <button key={image.id} onClick={() => setActiveIndex(index)} className={`w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 ${index === activeIndex ? 'border-betese-green' : 'border-transparent'}`}>
                                     <img src={image.url} alt={`${image.type} ${index + 1}`} className="w-full h-full object-cover" />
                                 </button>
                             ))}
                         </div>
                     </div>
                 )}
                <div className="p-3 border-t bg-white flex justify-between items-center flex-wrap gap-2">
                     <div className="flex items-center gap-2">
                         <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }} disabled={zoom <= 1} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50">-</button>
                         <button onClick={(e) => { e.stopPropagation(); handleZoomReset(); }} className="text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">Reset</button>
                         <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }} disabled={zoom >= 3} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50">+</button>
                     </div>
                     <div className="flex gap-2">
                        <button
                           onClick={handleDownload}
                           disabled={!hasImages}
                           className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                           Download
                        </button>
                        {navigator.share && (
                           <button
                              onClick={handleShare}
                              disabled={!hasImages}
                              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400"
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                              Share
                           </button>
                        )}
                     </div>
                     <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
