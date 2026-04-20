
import React, { useState, useRef } from 'react';
import { ProgramImage } from '../types';

interface ProgramManagementPanelProps {
    programImages: ProgramImage[];
    onUpload: (imageDataUrl: string, type: 'program' | 'advertisement') => void;
    onDelete: (id: string) => void;
}

export const ProgramManagementPanel: React.FC<ProgramManagementPanelProps> = ({ programImages, onUpload, onDelete }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploadType, setUploadType] = useState<'program' | 'advertisement'>('program');
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

    const handleUpload = () => {
        if (preview) {
            onUpload(preview, uploadType);
            setPreview(null);
            setFile(null);
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
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
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {preview ? 'Change Image' : 'Choose Image'}
                        </button>
                        {file && <p className="text-sm text-center mt-2 text-gray-600">Selected: {file.name}</p>}
                    </div>
                    <div className="w-full md:w-1/3 p-2 border rounded-lg bg-gray-50 min-h-[100px] flex items-center justify-center">
                        {preview ? (
                            <img src={preview} alt="Program Preview" className="max-h-32 object-contain rounded" />
                        ) : (
                            <p className="text-gray-500 text-center">Image preview</p>
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
                            className="w-full px-6 py-3 bg-betese-green text-white font-bold rounded-lg shadow-md hover:bg-green-700"
                        >
                            Add & Publish New {uploadType === 'program' ? 'Program' : 'Ad'}
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
