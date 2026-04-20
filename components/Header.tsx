
import React, { useState, useEffect, useMemo } from 'react';
import { User, ChatMessage, ChatThread } from '../types';
import { Logo } from './Logo';
import { useLanguage } from '../LanguageContext';
import { checkBackendConnection } from '../supabaseClient';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  walletFlash: boolean;
  onWalletFlashComplete: () => void;
  onOpenChat: () => void;
  onRefreshSystem?: () => void; // New recovery prop
  messages: ChatMessage[];
  threads: ChatThread[];
  isTestingMode?: boolean;
  onToggleTestingMode?: () => void;
  pendingDepositCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ 
    user, 
    onLogout, 
    walletFlash, 
    onWalletFlashComplete, 
    onOpenChat,
    onRefreshSystem,
    messages, 
    threads, 
    isTestingMode, 
    onToggleTestingMode,
    pendingDepositCount = 0
}) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (walletFlash) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
        onWalletFlashComplete();
      }, 700); 
      return () => clearTimeout(timer);
    }
  }, [walletFlash, onWalletFlashComplete]);

  useEffect(() => {
      const checkStatus = async () => {
          const status = await checkBackendConnection();
          setIsOnline(status);
      };
      checkStatus();
      const interval = setInterval(checkStatus, 30000);
      window.addEventListener('online', () => setIsOnline(true));
      window.addEventListener('offline', () => setIsOnline(false));
      return () => {
          clearInterval(interval);
          window.removeEventListener('online', () => setIsOnline(true));
          window.removeEventListener('offline', () => setIsOnline(false));
      };
  }, []);

  const handleManualRefresh = () => {
      if (onRefreshSystem) {
          setIsRefreshing(true);
          onRefreshSystem();
          setTimeout(() => setIsRefreshing(false), 1500);
      }
  };
  
  const unreadCount = useMemo(() => {
    if (!user) return 0;
    const userThreads = threads.filter(thread => {
        if (!thread.participantIds) return false;
        if (thread.participantIds.includes(user.id)) return true;
        if (user.role === 'Vendor' && thread.participantIds.includes('ALL_VENDORS')) return true;
        if (['Admin', 'Supervisor'].includes(user.role) && thread.participantIds.includes('BACK_OFFICE')) return true;
        return false;
    });

    let count = 0;
    for (const thread of userThreads) {
        if (!thread.participantIds) continue;
        const hasUnread = messages.some(msg => 
            msg.threadId === thread.id && 
            msg.readByIds && 
            !msg.readByIds.includes(user.id) && 
            msg.senderId !== user.id
        );
        if (hasUnread) count++;
    }
    return count;
  }, [messages, threads, user]);

  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex items-center flex-shrink-0">
            <Logo className="h-8 sm:h-10 w-auto" />
            <span className="ml-2 font-bold text-lg sm:text-xl text-betese-dark hidden md:block">Betese PMU</span>
            
            <button 
                onClick={handleManualRefresh}
                className={`ml-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${isRefreshing ? 'bg-yellow-100 text-yellow-700 animate-spin' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'}`}
                title="Fix Freeze / Sync System"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {isRefreshing ? 'FIXING...' : 'RECOVER'}
            </button>
          </div>
          
          <div className="flex items-center justify-end flex-grow gap-1 sm:gap-2 ml-2 min-w-0">
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg flex-shrink-0 mr-1">
                <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded text-[10px] font-bold ${language === 'en' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'}`}>EN</button>
                <button onClick={() => setLanguage('fr')} className={`px-2 py-1 rounded text-[10px] font-bold ${language === 'fr' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'}`}>FR</button>
            </div>

            {user && (
                <>
                {!isOnline && (
                    <span className="px-2 py-1 bg-red-600 text-white text-[9px] font-black rounded animate-pulse">OFFLINE</span>
                )}

                {user.role === 'Customer' && (
                    <div className={`p-1 px-2 rounded-lg transition-all flex-shrink-0 ${isFlashing ? 'bg-red-100 animate-pulse' : 'bg-green-100'}`}>
                        <span className="font-bold text-betese-green text-xs sm:text-sm">{user.walletBalance?.toFixed(2)}</span>
                    </div>
                )}

                <div className="text-right hidden sm:block mx-2">
                    <p className="font-semibold text-sm truncate max-w-[100px]">{user.name}</p>
                </div>

                <button onClick={onOpenChat} className="relative p-2 rounded-full hover:bg-gray-100 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {unreadCount > 0 && <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-red-100 bg-red-600 rounded-full">{unreadCount}</span>}
                </button>

                <button onClick={onLogout} className="p-2 ml-1 rounded-lg bg-red-50 hover:bg-red-100 transition-colors" title="Logout">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
                </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
