
import React, { useState } from 'react';

export const AppQRCodePanel: React.FC = () => {
    // Get the real current URL of the app
    const appUrl = window.location.href;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}`;

    const [copyButtonText, setCopyButtonText] = useState('Copy Link');

    const handleCopy = () => {
        navigator.clipboard.writeText(appUrl).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Link'), 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
            alert('Failed to copy URL.');
        });
    };

    const handleShareWhatsApp = () => {
        const message = `🔥 Join Betese PMU Online! \n\nClick here to start betting: \n${appUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-3">Share App with Customer</h3>
      <div className="flex flex-col items-center text-center space-y-6">
        
        {/* Method 1: Direct Link & WhatsApp (Easiest) */}
        <div className="w-full bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-bold text-blue-800 mb-2">OPTION 1: Send Link (Easiest)</p>
            <p className="text-xs text-gray-600 mb-3">Click below to send the app link directly to the customer's phone.</p>
            
            <button 
                onClick={handleShareWhatsApp}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-lg shadow-md hover:bg-green-600 flex items-center justify-center gap-2 mb-3 transition-transform transform active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
                Share App via WhatsApp
            </button>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    readOnly 
                    value={appUrl} 
                    className="flex-1 p-2 text-xs border rounded bg-white text-gray-500" 
                />
                <button 
                    onClick={handleCopy}
                    className="px-3 py-1 bg-gray-600 text-white text-xs font-bold rounded hover:bg-gray-700"
                >
                    {copyButtonText}
                </button>
            </div>
        </div>

        {/* Method 2: QR Code */}
        <div className="w-full bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm font-bold text-gray-700 mb-2">OPTION 2: Scan QR Code</p>
            <div className="flex justify-center p-2 bg-white rounded border border-gray-200 inline-block">
                 <img src={qrCodeUrl} alt="App QR Code" width="150" height="150" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Open Camera app and scan.</p>
        </div>

      </div>
    </div>
  );
};
