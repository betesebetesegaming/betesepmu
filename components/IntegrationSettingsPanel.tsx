
import React, { useState, useEffect } from 'react';
import { PaymentIntegrationConfig } from '../types';

interface IntegrationSettingsPanelProps {
    configs: PaymentIntegrationConfig[];
    onSave: (config: PaymentIntegrationConfig) => void;
}

export const IntegrationSettingsPanel: React.FC<IntegrationSettingsPanelProps> = ({ configs, onSave }) => {
    const [activeProvider, setActiveProvider] = useState<'Wave' | 'AfriMoney'>('Wave');
    const [formData, setFormData] = useState<PaymentIntegrationConfig>({
        provider: 'Wave',
        isEnabled: false,
        apiKey: '',
        apiSecret: '',
        merchantId: '',
        webhookUrl: '',
    });

    // Load initial data when provider switches or configs change
    useEffect(() => {
        const existingConfig = configs.find(c => c.provider === activeProvider);
        if (existingConfig) {
            setFormData(existingConfig);
        } else {
            // Defaults if not found
            setFormData({
                provider: activeProvider,
                isEnabled: false,
                apiKey: '',
                apiSecret: '',
                merchantId: '',
                // Placeholder logic for what a webhook URL might look like in the future
                webhookUrl: `https://api.betese.com/webhooks/${activeProvider.toLowerCase()}`, 
            });
        }
    }, [activeProvider, configs]);

    const handleChange = (field: keyof PaymentIntegrationConfig, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        alert(`${activeProvider} settings saved locally. (Backend integration required for live payments).`);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-betese-dark mb-4">Payment API Integrations</h2>
            <p className="text-sm text-gray-600 mb-6">
                Configure automatic payment gateways here. Enter the credentials provided by the mobile money operators.
                <br />
                <span className="text-red-600 font-bold">Note:</span> This is the interface for future backend integration. Do not enter real production keys until your secure server is ready.
            </p>

            <div className="flex mb-6 border-b">
                <button
                    onClick={() => setActiveProvider('Wave')}
                    className={`flex-1 py-3 text-center font-bold text-lg transition-colors ${
                        activeProvider === 'Wave' 
                            ? 'border-b-4 border-blue-500 text-blue-600 bg-blue-50' 
                            : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    Wave Mobile Money
                </button>
                <button
                    onClick={() => setActiveProvider('AfriMoney')}
                    className={`flex-1 py-3 text-center font-bold text-lg transition-colors ${
                        activeProvider === 'AfriMoney' 
                            ? 'border-b-4 border-orange-600 text-orange-700 bg-orange-50' 
                            : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    AfriMoney
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Enable {activeProvider} Automation</h3>
                        <p className="text-xs text-gray-500">When enabled, deposits will be processed automatically via API.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={formData.isEnabled}
                            onChange={(e) => handleChange('isEnabled', e.target.checked)}
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Key (Public Key)</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder={`e.g., ${activeProvider === 'Wave' ? 'wave_ci_...' : 'afri_key_...'}`}
                                value={formData.apiKey}
                                onChange={(e) => handleChange('apiKey', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="e.g., 1234-5678"
                                value={formData.merchantId}
                                onChange={(e) => handleChange('merchantId', e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret (Private Key)</label>
                            <input 
                                type="password" 
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="••••••••••••••••••••••"
                                value={formData.apiSecret}
                                onChange={(e) => handleChange('apiSecret', e.target.value)}
                            />
                            <p className="text-[10px] text-red-500 mt-1">Keep this secret! Never share it.</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-800 text-white rounded-lg">
                    <h4 className="font-bold text-sm mb-2 text-gray-300 uppercase tracking-wider">Webhook Configuration</h4>
                    <p className="text-xs text-gray-400 mb-2">Copy this URL and paste it into your {activeProvider} Developer Dashboard.</p>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black p-2 rounded font-mono text-sm text-green-400 truncate">
                            {formData.webhookUrl}
                        </code>
                        <button 
                            type="button"
                            onClick={() => navigator.clipboard.writeText(formData.webhookUrl)}
                            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-xs font-bold"
                        >
                            COPY
                        </button>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <button 
                        type="submit"
                        className="px-6 py-3 bg-betese-green text-white font-bold rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105"
                    >
                        Save {activeProvider} Settings
                    </button>
                </div>
            </form>
        </div>
    );
};
