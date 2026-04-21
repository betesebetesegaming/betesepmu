
import React, { useState, useRef } from 'react';
import { ProgramImage } from '../types';

interface ProgramManagementPanelProps {
    programImages: ProgramImage[];
    onUpload: (imageDataUrl: string, type: 'program' | 'advertisement', mediaType: 'image' | 'video') => void;
    onDelete: (id: string) => void;
}

export const ProgramManagementPanel: React.FC<ProgramManagementPanelProps> = ({ programImages, onUpload, onDelete }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState<'program' | 'advertisement'>('program');
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [inputMethod, setInputMethod] = useState<'file' | 'url'>('file');
    const [urlInput, setUrlInput] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setUrlInput(url);
        setPreview(url); // For URLs, the preview IS the url
    }

    const handleUpload = () => {
        if (preview) {
            onUpload(preview, uploadType, mediaType);
            setPreview(null);
            setFile(null);
            setUrlInput('');
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    
    const toggleMediaType = (type: 'image' | 'video') => {
        setMediaType(type);
        setPreview(null);
        setFile(null);
        setUrlInput('');
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Program & Ad Management</h2>
            
            <div className="p-4 border-2 border-dashed rounded-lg mb-6 space-y-4">
                <h3 className="font-semibold text-lg">Upload New Item</h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Column: Settings */}
                    <div className="w-full md:w-1/2 space-y-4">
                        
                        {/* Category Selection */}
                        <div>
                            <p className="font-bold text-gray-700 mb-2">1. Select Category:</p>
                            <div className="flex gap-4">
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${uploadType === 'program' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                                    <input type="radio" name="uploadType" value="program" checked={uploadType === 'program'} onChange={() => setUploadType('program')} className="h-4 w-4 text-betese-green focus:ring-betese-green" />
                                    <span className="font-semibold">Daily Program</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${uploadType === 'advertisement' ? 'bg-yellow-50 border-yellow-500 ring-1 ring-yellow-500' : 'hover:bg-gray-50'}`}>
                                    <input type="radio" name="uploadType" value="advertisement" checked={uploadType === 'advertisement'} onChange={() => setUploadType('advertisement')} className="h-4 w-4 text-betese-green focus:ring-betese-green" />
                                    <span className="font-semibold">TV Ad Ticker</span>
                                </label>
                            </div>
                        </div>

                        {/* Media Type Selection */}
                        <div>
                            <p className="font-bold text-gray-700 mb-2">2. Select Format:</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => toggleMediaType('image')}
                                    className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm ${mediaType === 'image' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    Image
                                </button>
                                <button 
                                    onClick={() => toggleMediaType('video')}
                                    className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm ${mediaType === 'video' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    Video
                                </button>
                            </div>
                        </div>

                        {/* Dynamic Resolution Advice */}
                        <div className={`p-3 rounded border text-sm ${uploadType === 'advertisement' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                             <p className="font-bold mb-1">ℹ️ Recommended Size & Format for {uploadType === 'advertisement' ? 'Ad Ticker' : 'Program'}:</p>
                             {uploadType === 'advertisement' ? (
                                 <ul className="list-disc pl-4 space-y-1">
                                     <li><strong>Size:</strong> 560 pixels (Width) x 304 pixels (Height).</li>
                                     <li><strong>Orientation:</strong> Landscape (Horizontal).</li>
                                     {mediaType === 'video' && <li><strong>Video Format:</strong> MP4 Video (Codec: H.264).</li>}
                                     <li>Square or Portrait images will be cut off!</li>
                                 </ul>
                             ) : (
                                 <ul className="list-disc pl-4 space-y-1">
                                     <li><strong>Size:</strong> 1920 x 1080 pixels (Full HD).</li>
                                     <li><strong>Orientation:</strong> 16:9 Landscape.</li>
                                 </ul>
                             )}
                        </div>
                    </div>

                    {/* Right Column: Upload & Preview */}
                    <div className="w-full md:w-1/2 space-y-4">
                        {/* Input Method */}
                        <div className="flex items-center gap-4 text-sm mb-2">
                             <label className="flex items-center gap-2 font-medium cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="inputMethod" 
                                    checked={inputMethod === 'file'} 
                                    onChange={() => { setInputMethod('file'); setPreview(null); }} 
                                />
                                Upload File
                             </label>
                             <label className="flex items-center gap-2 font-medium cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="inputMethod" 
                                    checked={inputMethod === 'url'} 
                                    onChange={() => { setInputMethod('url'); setPreview(null); }} 
                                />
                                Enter URL
                             </label>
                        </div>

                        {inputMethod === 'file' ? (
                            <>
                                <input
                                    type="file"
                                    accept={mediaType === 'image' ? "image/*" : "video/mp4,video/webm"}
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full px-4 py-8 border-2 border-dashed border-gray-300 bg-gray-50 text-gray-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" /></svg>
                                    <span>{preview ? 'Change File' : `Click to Upload ${mediaType === 'image' ? 'Image' : 'Video'}`}</span>
                                    {file && <span className="text-xs text-betese-green bg-green-100 px-2 py-1 rounded">{file.name}</span>}
                                </button>
                            </>
                        ) : (
                            <input 
                                type="text"
                                placeholder={`Paste ${mediaType} link here...`}
                                value={urlInput}
                                onChange={handleUrlChange}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                            />
                        )}

                        {/* Preview Area */}
                        {preview && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-gray-300 bg-black">
                                {mediaType === 'image' ? (
                                    <img src={preview} alt="Preview" className="w-full h-40 object-contain" />
                                ) : (
                                    <video src={preview} className="w-full h-40 object-contain" controls muted />
                                )}
                            </div>
                        )}

                        {preview && (
                            <button
                                onClick={handleUpload}
                                className="w-full px-6 py-3 bg-betese-green text-white font-bold rounded-lg shadow-md hover:bg-green-700 transform transition hover:scale-105"
                            >
                                Publish to TV
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <div>
                 <h3 className="font-semibold text-lg mb-2">Currently Published ({programImages.length})</h3>
                 {programImages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No programs or ads have been uploaded.</p>
                 ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto pr-2">
                        {programImages.map(image => (
                            <div key={image.id} className="border rounded-lg p-2 shadow relative bg-white group">
                                {image.mediaType === 'video' ? (
                                     <div className="relative w-full h-40 bg-black rounded-md overflow-hidden">
                                        <video src={image.url} className="w-full h-full object-cover opacity-80" muted />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white opacity-80" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
                                        </div>
                                     </div>
                                ) : (
                                    <img src={image.url} alt={image.type} className="w-full h-40 object-contain rounded-md bg-gray-100" />
                                )}
                                
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex gap-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${image.type === 'program' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {image.type === 'advertisement' ? 'Ad' : 'Prog'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${image.mediaType === 'video' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                                            {image.mediaType}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => onDelete(image.id)} 
                                        className="p-1 rounded-full hover:bg-red-100 text-red-500"
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
            </div>
        </div>
    );
};
