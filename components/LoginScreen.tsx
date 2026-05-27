
import React, { useMemo, useState } from 'react';
import { User, Role } from '../types';
import { Logo } from './Logo';
import { RulesModal } from './RulesModal';
import { useLanguage } from '../LanguageContext';
import {
    composeInternationalPhone,
    SUPPORTED_COUNTRIES,
    type SupportedCountry,
} from '../utils';
import {
    dbFindUser,
    dbAuthenticateViaFunction,
} from '../firebaseClient';

/**
 * Country picker + national-number input. Renders a dropdown of supported
 * countries (flag emoji + dial code) on the left and a digit-only input on
 * the right. The input's max length and placeholder change with the selected
 * country.
 *
 * `value` and `onChange` are the national digits (no country code, no spaces).
 * Pair this with `composeInternationalPhone(country, value)` on submit.
 */
interface CountryPhoneInputProps {
    id: string;
    label: string;
    country: SupportedCountry;
    onCountryChange: (c: SupportedCountry) => void;
    value: string;
    onChange: (digits: string) => void;
    autoFocus?: boolean;
}

const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
    id,
    label,
    country,
    onCountryChange,
    value,
    onChange,
    autoFocus,
}) => {
    const handleNationalChange = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, country.nationalDigits);
        onChange(digits);
    };

    const handleCountrySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = SUPPORTED_COUNTRIES.find((c) => c.code === e.target.value);
        if (!next) return;
        onCountryChange(next);
        // Trim any digits that now exceed the new country's allowed length.
        if (value.length > next.nationalDigits) {
            onChange(value.slice(0, next.nationalDigits));
        }
    };

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 ml-1">
                {label}
            </label>
            <div className="flex gap-2">
                <div className="relative">
                    <select
                        aria-label="Country"
                        value={country.code}
                        onChange={handleCountrySelect}
                        className="appearance-none rounded-xl border border-gray-300 bg-gray-50 py-3 pl-3 pr-8 text-sm font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    >
                        {SUPPORTED_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.flag} {c.dialCode}
                            </option>
                        ))}
                    </select>
                    <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                </div>
                <input
                    id={id}
                    name={id}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    autoFocus={autoFocus}
                    maxLength={country.nationalDigits}
                    value={value}
                    onChange={(e) => handleNationalChange(e.target.value)}
                    placeholder={country.placeholder}
                    className="flex-1 block w-full rounded-xl border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm py-3 px-4 transition-all tracking-widest font-semibold"
                    required
                />
            </div>
            <p className="text-[11px] text-gray-500 font-semibold ml-1">
                {country.flag} {country.name} — enter {country.nationalDigits} digits, e.g.{' '}
                <span className="font-mono">{country.placeholder}</span>.
            </p>
        </div>
    );
};

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
        onSignUp: (name: string, role: Role, phone?: string, password?: string, correctionPin?: string) => Promise<User | null>;
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

const SignUpForm: React.FC<{ onSignUp: (name: string, phone: string, password: string) => Promise<User | null>; onBack: () => void; users: User[]; onOpenRules: () => void; }> = ({ onSignUp, onBack, users, onOpenRules }) => {
    const [name, setName] = useState('');
    const [country, setCountry] = useState<SupportedCountry>(SUPPORTED_COUNTRIES[0]);
    const [phoneDigits, setPhoneDigits] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const knownPhonesByCountry = useMemo(() => {
        const known = new Set<string>();
        for (const u of users) {
            for (const c of SUPPORTED_COUNTRIES) {
                const normalised = composeInternationalPhone(c, (u.phone || '').replace(/\D/g, ''));
                if (normalised) known.add(normalised);
            }
        }
        return known;
    }, [users]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name || !phoneDigits || !password || !confirmPassword) {
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

        const normalizedPhone = composeInternationalPhone(country, phoneDigits);
        if (!normalizedPhone) {
            setError(
                `Enter your ${country.nationalDigits}-digit ${country.name} mobile number (e.g. ${country.placeholder}).`,
            );
            return;
        }

        if (knownPhonesByCountry.has(normalizedPhone)) {
            setError('This phone number is already registered.');
            return;
        }

        setIsSubmitting(true);
        try {
            const createdUser = await onSignUp(name, normalizedPhone, password);
            if (!createdUser) {
                setError('Unable to create account. Please check your details and try again, or contact support.');
            }
        } catch (err: any) {
            setError(err?.message || 'Account creation failed. Please try again or contact support.');
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

            <form className="space-y-5" onSubmit={handleSignUp}>
                <ModernInput
                    id="signup-name"
                    label={t('full_name')}
                    value={name}
                    onChange={setName}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                />
                <CountryPhoneInput
                    id="signup-phone"
                    label="Mobile Money Number (User ID)"
                    country={country}
                    onCountryChange={setCountry}
                    value={phoneDigits}
                    onChange={setPhoneDigits}
                />
                <p className="text-[10px] text-gray-500 -mt-2 ml-2">This number will be used for all deposits &amp; withdrawals.</p>

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

                <div className="text-xs text-gray-500 text-center px-4">
                    {t('agree_terms')} <button type="button" onClick={onOpenRules} className="text-green-600 hover:text-green-800 font-semibold underline">{t('official_rules_link')}</button>.
                    <br/><span className="text-red-500 font-bold">{t('must_be_18')}</span>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-betese-green to-green-600 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition hover:-translate-y-0.5"
                >
                    {isSubmitting ? 'Creating account…' : t('open_account')}
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
    const [country, setCountry] = useState<SupportedCountry>(SUPPORTED_COUNTRIES[0]);
    const [phoneDigits, setPhoneDigits] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!phoneDigits || !password) {
            setError(t('error_fill_fields'));
            return;
        }

        const normalizedPhone = composeInternationalPhone(country, phoneDigits);
        if (!normalizedPhone) {
            setError(
                `Enter your ${country.nationalDigits}-digit ${country.name} mobile number (e.g. ${country.placeholder}).`,
            );
            return;
        }
        const trimmedPassword = password.trim();

        // Fast path: preloaded users array. Only used when password matches —
        // if mismatched we still fall through to the server check below, since
        // the local cache may be stale (admin password reset, etc.).
        const localMatch = users.find((u) => {
            const compareToPhone = (val: string | undefined) => {
                if (!val) return false;
                // Try every supported country prefix so admins-created accounts
                // (which may live with a different country code) still match.
                for (const c of SUPPORTED_COUNTRIES) {
                    const normalised = composeInternationalPhone(c, val.replace(/\D/g, ''));
                    if (normalised && normalised === normalizedPhone) return true;
                }
                return val === normalizedPhone;
            };
            return compareToPhone(u.phone) || compareToPhone(u.id);
        });

        if (localMatch && (localMatch.password || '').trim() === trimmedPassword) {
            if (localMatch.isLocked) {
                setError('Your account is locked. Please contact a supervisor.');
                return;
            }
            onLogin(localMatch);
            return;
        }

        // Fallback 1: direct database query (catches users not yet in preloaded array)
        let user: User | null = null;
        try {
            user = await dbFindUser(normalizedPhone);
        } catch {
            user = null;
        }

        if (user && (user.password || '').trim() === trimmedPassword) {
            if (user.isLocked) {
                setError('Your account is locked. Please contact a supervisor.');
                return;
            }
            onLogin(user);
            return;
        }

        // Fallback 2: server-side API route (bypasses client-side RLS/grant issues)
        try {
            const serverUser = await dbAuthenticateViaFunction(normalizedPhone, trimmedPassword);
            if (serverUser) {
                if (serverUser.isLocked) {
                    setError('Your account is locked. Please contact a supervisor.');
                    return;
                }
                onLogin(serverUser);
                return;
            }
        } catch (serviceErr: any) {
            if (localMatch || user) {
                setError('Invalid phone number or password.');
                return;
            }
            const msg = String(serviceErr?.message || '').trim();
            setError(
                msg
                    ? `Login service error: ${msg}`
                    : 'Login service is temporarily unavailable. Please ask the administrator to check server configuration.'
            );
            return;
        }

        setError('Invalid phone number or password.');
    };

    return (
        <div className="animate-fade-in-up">
            <div className="text-center mb-8">
                <div className="flex justify-center mb-4 transform hover:scale-105 transition-transform duration-500">
                    <Logo className="h-20 w-auto drop-shadow-md" />
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
                <CountryPhoneInput
                    id="phone"
                    label="Mobile number"
                    country={country}
                    onCountryChange={setCountry}
                    value={phoneDigits}
                    onChange={setPhoneDigits}
                    autoFocus
                />
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

    const handleSignUpAndLogin = async (name: string, phone: string, password: string): Promise<User | null> => {
        const newUser = await onSignUp(name, 'Customer', phone, password);
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
