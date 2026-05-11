
import React, { useState, useEffect } from 'react';
import { PaymentIntegrationConfig, OTPConfig } from '../types';
import { AfriMoneyLogo } from './AfriMoneyLogo';
import { WaveLogo } from './WaveLogo';
import { dbFetchOTPConfig, dbSaveOTPConfig } from '../supabaseClient';

interface IntegrationSettingsPanelProps {
    configs: PaymentIntegrationConfig[];
    onSave: (config: PaymentIntegrationConfig) => Promise<void>;
}

export const IntegrationSettingsPanel: React.FC<IntegrationSettingsPanelProps> = ({ configs, onSave }) => {
    const [activeProvider, setActiveProvider] = useState<'Wave' | 'AfriMoney' | 'OTP'>('Wave');
    const [showOTPConfig, setShowOTPConfig] = useState(false);
    const [otpConfig, setOTPConfig] = useState<OTPConfig>({
        isEnabled: false,
        provider: 'builtin',
        apiKey: '',
        apiSecret: '',
        codeLength: 4,
        expiryMinutes: 5,
        maxRetries: 3,
        message: 'Your BETESE verification code is: {{code}}'
    });
    const [formData, setFormData] = useState<PaymentIntegrationConfig>({
        provider: 'Wave',
        isEnabled: false,
        environment: 'sandbox',
        apiKey: '',
        apiSecret: '',
        signatureSecret: '',
        merchantId: '',
        shortCode: '',
        merchantMsisdn: '',
        merchantDisplayName: '',
        currency: 'GMD',
        baseUrl: '',
        webhookUrl: '',
        webhookSecret: '',
        callbackAuthToken: '',
        requestTimeoutMs: 30000,
    });

    // Load initial data when provider switches or configs change
    useEffect(() => {
        if (activeProvider === 'OTP') return; // Skip payment config loading for OTP tab

        const existingConfig = configs.find(c => c.provider === activeProvider as any);
        if (existingConfig) {
            setFormData(existingConfig);
        } else {
            // Defaults if not found
            setFormData({
                provider: activeProvider as any,
                isEnabled: false,
                environment: 'sandbox',
                apiKey: '',
                apiSecret: '',
                signatureSecret: '',
                merchantId: '',
                shortCode: '',
                merchantMsisdn: '',
                merchantDisplayName: '',
                currency: 'GMD',
                baseUrl: '',
                // Placeholder logic for what a webhook URL might look like in the future
                webhookUrl: `https://api.betese.com/webhooks/${(activeProvider as string).toLowerCase()}`, 
                webhookSecret: '',
                callbackAuthToken: '',
                requestTimeoutMs: 30000,
            });
        }
    }, [activeProvider, configs]);

    // Load OTP config
    useEffect(() => {
        if (activeProvider !== 'OTP') return;
        const loadOTP = async () => {
            try {
                const config = await dbFetchOTPConfig();
                if (config) {
                    setOTPConfig(config);
                }
            } catch (err) {
                console.error('Failed to load OTP config:', err);
            }
        };
        loadOTP();
    }, [activeProvider, showOTPConfig]);

    const handleChange = (field: keyof PaymentIntegrationConfig, value: string | boolean | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleOTPChange = (field: keyof OTPConfig, value: string | boolean | number) => {
        setOTPConfig(prev => ({ ...prev, [field]: value }));
    };

    const isValidHttpUrl = (value: string) => /^https?:\/\//i.test((value || '').trim());

    const validateBeforeSave = () => {
        if (!formData.isEnabled) return null;

        const requiredFields: Array<{ label: string; value: string }> = [
            { label: 'API Key', value: formData.apiKey },
            { label: 'Client Secret', value: formData.apiSecret },
            { label: 'Signature Secret', value: formData.signatureSecret },
            { label: 'Merchant ID', value: formData.merchantId },
            { label: 'Merchant MSISDN', value: formData.merchantMsisdn },
            { label: 'Base API URL', value: formData.baseUrl },
            { label: 'Webhook URL', value: formData.webhookUrl },
            { label: 'Webhook Secret', value: formData.webhookSecret },
            { label: 'Callback Auth Token', value: formData.callbackAuthToken },
        ];

        const missing = requiredFields.filter(item => !item.value.trim()).map(item => item.label);
        if (missing.length > 0) {
            return `Missing required fields for enabled gateway: ${missing.join(', ')}`;
        }
        if (!isValidHttpUrl(formData.baseUrl)) {
            return 'Base API URL must start with http:// or https://';
        }
        if (!isValidHttpUrl(formData.webhookUrl)) {
            return 'Webhook URL must start with http:// or https://';
        }
        if (Number(formData.requestTimeoutMs) < 1000) {
            return 'Request timeout must be at least 1000ms.';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateBeforeSave();
        if (validationError) {
            alert(validationError);
            return;
        }
        await onSave({
            ...formData,
            baseUrl: formData.baseUrl.trim(),
            webhookUrl: formData.webhookUrl.trim(),
            currency: (formData.currency || 'GMD').trim().toUpperCase(),
            requestTimeoutMs: Math.max(1000, Number(formData.requestTimeoutMs || 30000)),
        });
        alert(`${activeProvider} settings saved locally. (Backend integration required for live payments).`);
    };

    const handleOTPSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbSaveOTPConfig(otpConfig);
            alert('OTP configuration saved successfully!');
            setShowOTPConfig(false);
        } catch (err: any) {
            alert(`Failed to save OTP config: ${err.message}`);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-betese-dark mb-4">Payment API Integrations</h2>
            <p className="text-sm text-gray-600 mb-6">
                Configure automatic payment gateways here. Enter the credentials provided by the mobile money operators.
                <br />
                <span className="text-red-600 font-bold">Note:</span> This is the interface for future backend integration. Do not enter real production keys until your secure server is ready.
            </p>

            <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-black text-blue-900 uppercase tracking-wide mb-2">Provider Readiness Checklist</h3>
                <ul className="text-xs text-blue-900 space-y-1">
                    <li>API credentials: key, secret, signature secret.</li>
                    <li>Merchant identity: merchant ID, shortcode, merchant MSISDN/display name.</li>
                    <li>Connectivity: base API URL, webhook URL, callback auth token.</li>
                    <li>Security: webhook secret and callback token generated per provider.</li>
                    <li>Operational: environment mode, currency, request timeout configured.</li>
                </ul>
            </div>

            <div className="flex mb-6 border-b">
                <button
                    onClick={() => setActiveProvider('Wave')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold text-lg transition-colors ${
                        activeProvider === 'Wave' 
                            ? 'border-b-4 border-blue-500 bg-blue-50' 
                            : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <WaveLogo height={24} />
                </button>
                <button
                    onClick={() => setActiveProvider('AfriMoney')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold text-lg transition-colors ${
                        activeProvider === 'AfriMoney' 
                            ? 'border-b-4 border-purple-700 bg-purple-50' 
                            : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <AfriMoneyLogo height={24} />
                </button>
                <button
                    onClick={() => setActiveProvider('OTP')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold text-lg transition-colors ${
                        activeProvider === 'OTP' 
                            ? 'border-b-4 border-orange-500 bg-orange-50' 
                            : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    🔐 OTP
                </button>
            </div>

            {activeProvider !== 'OTP' ? (
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            value={formData.environment}
                            onChange={(e) => handleChange('environment', e.target.value as 'sandbox' | 'production')}
                        >
                            <option value="sandbox">Sandbox / Test</option>
                            <option value="production">Production</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                            placeholder="GMD"
                            value={formData.currency}
                            onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Request Timeout (ms)</label>
                        <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                            min={1000}
                            step={500}
                            value={formData.requestTimeoutMs}
                            onChange={(e) => handleChange('requestTimeoutMs', Number(e.target.value || 30000))}
                        />
                    </div>
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Short Code / Service Code</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="e.g., 12345"
                                value={formData.shortCode}
                                onChange={(e) => handleChange('shortCode', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant MSISDN</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="e.g., 2207xxxxxx"
                                value={formData.merchantMsisdn}
                                onChange={(e) => handleChange('merchantMsisdn', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Display Name</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="e.g., Betese PMU"
                                value={formData.merchantDisplayName}
                                onChange={(e) => handleChange('merchantDisplayName', e.target.value)}
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Signature Secret</label>
                            <input
                                type="password"
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="Used for request signing and verification"
                                value={formData.signatureSecret}
                                onChange={(e) => handleChange('signatureSecret', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Callback Auth Token</label>
                            <input
                                type="password"
                                className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                                placeholder="Bearer token expected from provider callback"
                                value={formData.callbackAuthToken}
                                onChange={(e) => handleChange('callbackAuthToken', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Base API URL</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                            placeholder={activeProvider === 'Wave' ? 'https://api.wave.com/...' : 'https://api.afrimoney.com/...'}
                            value={formData.baseUrl}
                            onChange={(e) => handleChange('baseUrl', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                        <input
                            type="password"
                            className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                            placeholder="Secret used to validate webhook signature"
                            value={formData.webhookSecret}
                            onChange={(e) => handleChange('webhookSecret', e.target.value)}
                        />
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
            ) : (
            // OTP Configuration Form
            <form onSubmit={handleOTPSubmit} className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">📱 Customer Phone Verification (OTP)</h3>
                        <p className="text-xs text-gray-500">Enable SMS-based one-time password verification for customer registration.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={otpConfig.isEnabled}
                            onChange={(e) => handleOTPChange('isEnabled', e.target.checked)}
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SMS Provider</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            value={otpConfig.provider}
                            onChange={(e) => handleOTPChange('provider', e.target.value)}
                        >
                            <option value="builtin">Mock / Development (No SMS Sent)</option>
                            <option value="twilio">Twilio</option>
                            <option value="aws_sns">AWS SNS</option>
                            <option value="custom">Custom Provider</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Select the SMS service provider for sending OTP codes.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SMS From Number</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded font-mono text-sm"
                            placeholder="e.g., 2207xxxxxx or BETESE"
                            value={otpConfig.phoneFromNumber || ''}
                            onChange={(e) => handleOTPChange('phoneFromNumber', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code Length</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            value={otpConfig.codeLength}
                            onChange={(e) => handleOTPChange('codeLength', Number(e.target.value))}
                        >
                            <option value={4}>4 digits</option>
                            <option value={5}>5 digits</option>
                            <option value={6}>6 digits</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code Expiry (minutes)</label>
                        <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            min={1}
                            max={60}
                            value={otpConfig.expiryMinutes}
                            onChange={(e) => handleOTPChange('expiryMinutes', Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                        <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            min={1}
                            max={10}
                            value={otpConfig.maxRetries}
                            onChange={(e) => handleOTPChange('maxRetries', Number(e.target.value))}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMS Message Template</label>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded font-mono text-xs"
                        rows={3}
                        placeholder="Your BETESE verification code is: {{code}}"
                        value={otpConfig.message}
                        onChange={(e) => handleOTPChange('message', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use {'{{code}}'} as placeholder for the OTP code. Message must contain {'{{code}}'}.</p>
                </div>

                {!otpConfig.isEnabled && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 font-semibold">⚠️ OTP is currently <strong>DISABLED</strong></p>
                        <p className="text-xs text-yellow-700 mt-1">Enable OTP above, configure your SMS provider, then save to activate customer phone verification.</p>
                    </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-bold text-sm text-blue-900 mb-2">📋 Setup Checklist</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                        <li>✓ Select SMS provider type</li>
                        <li>✓ Enter API credentials (if not builtin/mock mode)</li>
                        <li>✓ Set code length, expiry, and retry limits</li>
                        <li>✓ Enable the toggle and save</li>
                        <li>✓ Test registration with a valid phone number</li>
                    </ul>
                </div>

                {otpConfig.provider !== 'builtin' && otpConfig.isEnabled && (!otpConfig.apiKey || !otpConfig.apiSecret) && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-semibold">⚠️ Missing API Credentials</p>
                        <p className="text-xs text-red-700 mt-1">You selected a non-mock provider but haven't entered API credentials. SMS sending will fail until you provide valid credentials.</p>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button 
                        type="button"
                        onClick={() => setActiveProvider('Wave')}
                        className="px-6 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition-transform transform hover:scale-105"
                    >
                        Back
                    </button>
                    <button 
                        type="submit"
                        className="px-6 py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-transform transform hover:scale-105"
                    >
                        Save OTP Settings
                    </button>
                </div>
            </form>
            )}
        </div>
    );
};
