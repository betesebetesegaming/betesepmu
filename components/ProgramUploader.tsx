
import React, { useState, useRef } from 'react';
import { ProgramImage } from '../types';

interface ProgramManagementPanelProps {
    programImages: ProgramImage[];
    onUpload: (file: File, type: 'program' | 'advertisement', mediaType: 'image' | 'video') => Promise<void>;
    onDelete: (id: string) => void;
}

export const ProgramManagementPanel: React.FC<ProgramManagementPanelProps> = ({ programImages, onUpload, onDelete }) => {
    const MIN_IMAGE_WIDTH = 1600;
    const MIN_IMAGE_HEIGHT = 2000;
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [qualityWarning, setQualityWarning] = useState<string | null>(null);
    const [uploadType, setUploadType] = useState<'program' | 'advertisement'>('program');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setQualityWarning(null);
            setFile(selectedFile);
            if (selectedFile.type.startsWith('image/')) {
                const tempUrl = URL.createObjectURL(selectedFile);
                const img = new Image();
                img.onload = () => {
                    if (img.naturalWidth < MIN_IMAGE_WIDTH || img.naturalHeight < MIN_IMAGE_HEIGHT) {
                        setQualityWarning(`Low resolution (${img.naturalWidth}x${img.naturalHeight}). For sharp reading, use at least ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}.`);
                    }
                    URL.revokeObjectURL(tempUrl);
                };
                img.onerror = () => URL.revokeObjectURL(tempUrl);
                img.src = tempUrl;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
        setIsUploading(true);
        try {
            await onUpload(file, uploadType, mediaType);
            setPreview(null);
            setFile(null);
            setQualityWarning(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Program & Ad Management</h2>
            
            <div className="p-4 border-2 border-dashed rounded-lg mb-6 space-y-4">
                <h3 className="font-semibold text-lg">Upload New Item</h3>
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-full md:w-1/3">
                        <input
                            type="file"
                            accept="image/*,video/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isUploading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={isUploading}
                        >
                            {preview ? 'Change File' : 'Choose Image / Video'}
                        </button>
                        {file && <p className="text-sm text-center mt-2 text-gray-600">Selected: {file.name}</p>}
                        {qualityWarning && <p className="text-xs text-amber-700 font-semibold mt-2">{qualityWarning}</p>}
                    </div>
                    <div className="w-full md:w-1/3 p-2 border rounded-lg bg-gray-50 min-h-[100px] flex items-center justify-center">
                        {preview ? (
                            file?.type.startsWith('video/') ? (
                                <video src={preview} className="max-h-32 object-contain rounded" muted playsInline />
                            ) : (
                                <img src={preview} alt="Program Preview" className="max-h-32 object-contain rounded" />
                            )
                        ) : (
                            <p className="text-gray-500 text-center">Image / Video preview</p>
                        )}
                    </div>
                     <div className="w-full md:w-1/3 space-y-2">
                        <p className="font-medium">Item Type:</p>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="uploadType" value="program" checked={uploadType === 'program'} onChange={() => setUploadType('program')} />
                                Program
                            </label>
                             <label className="flex items-center gap-2">
                                <input type="radio" name="uploadType" value="advertisement" checked={uploadType === 'advertisement'} onChange={() => setUploadType('advertisement')} />
                                Advertisement
                            </label>
                        </div>
                    </div>
                </div>
                {preview && (
                    <div className="mt-4">
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="w-full px-6 py-3 bg-betese-green text-white font-bold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    Uploading to server...
                                </>
                            ) : (
                                `Add & Publish New ${uploadType === 'program' ? 'Program' : 'Ad'}`
                            )}
                        </button>
                    </div>
                )}
            </div>
            
            <div>
                 <h3 className="font-semibold text-lg mb-2">Currently Published ({programImages.length})</h3>
                 {programImages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No programs or ads have been uploaded.</p>
                 ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto pr-2">
                        {programImages.map(image => (
                            <div key={image.id} className="border rounded-lg p-2 shadow relative">
                                <img src={image.url} alt={image.type} className="w-full h-40 object-contain rounded-md bg-gray-100" />
                                <div className="flex justify-between items-center mt-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${image.type === 'program' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {image.type}
                                    </span>
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
