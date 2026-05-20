
import React, { useState } from 'react';
import { User, Role } from '../types';
import { Logo } from './Logo';
import { RulesModal } from './RulesModal';
import { useLanguage } from '../LanguageContext';
import { normalizeGambiaPhone } from '../utils';
import { dbFetchOTPConfig, dbGenerateAndSendOTP } from '../supabaseClient';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
        onSignUp: (name: string, role: Role, phone?: string, password?: string, correctionPin?: string, otpCode?: string) => Promise<User | null>;
}

// Modern Input Field with Icon support
const ModernInput: React.FC<{
    id: string;
    label: string;
    value: string;
    onChange: (val: string) => void;
    type?: string;
    icon?: React.ReactNode;
}> = ({ id, label, value, onChange, type = 'text', icon }) => (
    <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 ml-1">
            {label}
        </label>
        <div className="relative rounded-xl shadow-sm">
            {icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    {icon}
                </div>
            )}
            <input
                id={id}
                name={id}
                type={type}
                className={`block w-full rounded-xl border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm py-3 transition-all ${icon ? 'pl-10' : 'pl-4'}`}
                placeholder={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
            />
        </div>
    </div>
);

const SignUpForm: React.FC<{ onSignUp: (name: string, phone: string, password: string, otpCode?: string) => Promise<User | null>; onBack: () => void; users: User[]; onOpenRules: () => void; }> = ({ onSignUp, onBack, users, onOpenRules }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpRequired, setOtpRequired] = useState(false);
    const [info, setInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setInfo('');
        if (!name || !phone || !password || !confirmPassword) {
            setError(t('error_fill_fields'));
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const normalizedPhone = normalizeGambiaPhone(phone || '');
        if (!normalizedPhone) {
            setError('Use valid phone: Gambia local 7 digits or +220XXXXXXX; Senegal must be +221XXXXXXXXX only.');
            return;
        }

        if (users.some(u => normalizeGambiaPhone(u.phone || '') === normalizedPhone)) {
            setError('This phone number is already registered.');
            return;
        }

        setIsSubmitting(true);
        try {
            const otpConfig = await dbFetchOTPConfig();
            if (!otpConfig) {
                setError('OTP setup is missing on server. Please ask Admin to configure OTP before new customer registration.');
                return;
            }

            if (!otpConfig.isEnabled) {
                setError('OTP verification is currently disabled. Please contact support/admin.');
                return;
            }

            const shouldUseOtp = true;

            if (shouldUseOtp && !otpSent) {
                const sent = await dbGenerateAndSendOTP(normalizedPhone);
                if (!sent.success) {
                    setError(sent.message || 'Failed to send OTP code.');
                    return;
                }

                setOtpRequired(true);
                setOtpSent(true);
                setInfo('Verification code sent by SMS. Enter the code below, then click Create Account again.');
                return;
            }

            if (shouldUseOtp && !otpCode.trim()) {
                setError('Enter the SMS verification code to continue.');
                return;
            }

            const createdUser = await onSignUp(name, normalizedPhone, password, otpCode.trim());
            if (!createdUser) {
                setError('Unable to create account. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
         <div className="animate-fade-in-up">
            <div className="text-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900">{t('create_account')}</h1>
                <p className="mt-2 text-sm text-gray-600">{t('join_message')}</p>
            </div>
            
            {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}
            {info && (
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700 text-sm rounded">
                    <p className="font-bold">Verification</p>
                    <p>{info}</p>
                </div>
            )}

            <form className="space-y-5" onSubmit={handleSignUp}>
                <ModernInput 
                    id="signup-name" 
                    label={t('full_name')} 
                    value={name} 
                    onChange={setName}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                />
                <ModernInput 
                    id="signup-phone" 
                    label="Mobile Money Number (User ID)" 
                    value={phone} 
                    onChange={setPhone} 
                    type="tel"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                />
                <p className="text-[10px] text-gray-500 -mt-3 ml-2">This number will be used for all deposits & withdrawals.</p>

                <ModernInput 
                    id="signup-password" 
                    label={t('password')} 
                    value={password} 
                    onChange={setPassword} 
                    type="password"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                />
                <ModernInput 
                    id="signup-confirm-password" 
                    label={t('confirm_password')} 
                    value={confirmPassword} 
                    onChange={setConfirmPassword} 
                    type="password"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                />

                {(otpRequired || otpSent) && (
                    <>
                        <ModernInput
                            id="signup-otp"
                            label="SMS Verification Code"
                            value={otpCode}
                            onChange={setOtpCode}
                            type="text"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 .552-.448 1-1 1H9a1 1 0 100 2h1a3 3 0 100-6H9a1 1 0 010-2h2a1 1 0 011 1m-7 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                        />
                        <p className="text-[11px] text-blue-700 -mt-3 ml-2 font-semibold">Customer should enter the code received by text message before account creation is completed.</p>
                    </>
                )}
                
                <div className="text-xs text-gray-500 text-center px-4">
                    {t('agree_terms')} <button type="button" onClick={onOpenRules} className="text-green-600 hover:text-green-800 font-semibold underline">{t('official_rules_link')}</button>.
                    <br/><span className="text-red-500 font-bold">{t('must_be_18')}</span>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-betese-green to-green-600 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition hover:-translate-y-0.5"
                >
                    {isSubmitting ? 'Please wait...' : t('open_account')}
                </button>
            </form>
            
            <div className="mt-6 text-center">
                <button onClick={onBack} type="button" className="text-sm font-medium text-gray-600 hover:text-betese-dark flex items-center justify-center gap-2 w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    {t('already_have_account')}
                </button>
            </div>
        </div>
    );
};

const LoginForm: React.FC<{ onLogin: (user: User) => void; users: User[]; onSwitchToSignUp: () => void; onOpenRules: () => void; }> = ({ onLogin, users, onSwitchToSignUp, onOpenRules }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError(t('error_fill_fields'));
            return;
        }

        const rawUsername = username.trim();
        const lowerCaseUsername = rawUsername.toLowerCase();
        const normalizedInputPhone = normalizeGambiaPhone(rawUsername);

        // Allow login with name (staff), raw/normalized phone, or account ID.
        const user = users.find(u => 
            u.name.toLowerCase() === lowerCaseUsername || 
            u.id.toLowerCase() === lowerCaseUsername ||
            (u.phone && normalizeGambiaPhone(u.phone) === normalizedInputPhone) ||
            normalizeGambiaPhone(u.id) === normalizedInputPhone
        );

        if (user) {
            if ((user.password || '').trim() !== password.trim()) {
                setError('Invalid username or password.');
                return;
            }
            if (user.isLocked) {
                setError('Your account is locked. Please contact a supervisor.');
            } else {
                onLogin(user);
            }
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="animate-fade-in-up">
            <div className="text-center mb-8">
                <div className="flex justify-center mb-4 transform hover:scale-105 transition-transform duration-500">
                    <Logo className="text-4xl drop-shadow-md" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">{t('welcome')}</h2>
                <p className="text-gray-500 text-sm">{t('login_title')}</p>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded shadow-sm">
                    <p className="font-bold">Access Denied</p>
                    <p>{error}</p>
                </div>
            )}

            <form className="space-y-6" onSubmit={handleLogin}>
                <ModernInput 
                    id="username" 
                    label="Account ID / Mobile Number / Username" 
                    value={username} 
                    onChange={setUsername}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                />
                <p className="-mt-4 text-[11px] text-gray-500 font-semibold">You can sign in with your account ID, mobile number, or username.</p>
                <ModernInput 
                    id="password" 
                    label={t('password')} 
                    value={password} 
                    onChange={setPassword} 
                    type="password"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                />
                
                <button 
                    type="submit" 
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-betese-green to-green-600 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition hover:-translate-y-0.5"
                >
                    {t('sign_in')}
                </button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-sm text-gray-500 mb-2">{t('dont_have_account')}</p>
                <button 
                    onClick={onSwitchToSignUp} 
                    className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                >
                   {t('create_customer_account')}
                </button>
            </div>

            <div className="mt-8 pt-4 border-t border-gray-100 text-center">
                <button onClick={onOpenRules} className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors">
                    {t('official_rules_link')} & Terms of Service
                </button>
            </div>
        </div>
    );
};


export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users, onSignUp }) => {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

    const handleSignUpAndLogin = async (name: string, phone: string, password: string, otpCode?: string): Promise<User | null> => {
        const newUser = await onSignUp(name, 'Customer', phone, password, undefined, otpCode);
        if (!newUser) return null;
    onLogin(newUser);
        return newUser;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black p-4 sm:p-6 lg:p-8">
      
      {/* Background Decor - Abstract shapes */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-20 animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden border border-white/20">
        {/* Top Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-yellow-400 via-betese-green to-green-800"></div>
        
        <div className="p-8 sm:p-10">
            {isSigningUp ? (
                <SignUpForm onSignUp={handleSignUpAndLogin} onBack={() => setIsSigningUp(false)} users={users} onOpenRules={() => setIsRulesOpen(true)} />
            ) : (
                <LoginForm onLogin={onLogin} users={users} onSwitchToSignUp={() => setIsSigningUp(true)} onOpenRules={() => setIsRulesOpen(true)} />
            )}
            
            {/* Language Selection */}
            <div className="mt-8 flex justify-center">
                <div className="bg-gray-100 p-1 rounded-lg flex shadow-inner">
                    <button 
                        onClick={() => setLanguage('en')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            language === 'en' 
                            ? 'bg-white text-betese-green shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        English
                    </button>
                    <button 
                        onClick={() => setLanguage('fr')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            language === 'fr' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Français
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
