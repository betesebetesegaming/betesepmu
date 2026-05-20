
import React, { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { BetSlip, BetTypeOption, Ticket, BetSelection, User, Role, WithdrawalRequest, Race, RaceResult, DepositLog, ChatMessage, ChatThread, Promotion, PromotionRule, DepositRequest, PaymentIntegrationConfig, ProgramImage, ManualBetOrder } from './types';
import { BET_PRICING } from './constants';
import { Header } from './components/Header';
import { ConfirmationModal } from './components/ConfirmationModal';
import { BookingCodeModal } from './components/BookingCodeModal';
import { WithdrawalCodeModal } from './components/WithdrawalCodeModal';
import { SEVEN_DAYS_IN_MS, BETTING_CUTOFF_MS, calculateTicketWinnings, validateTicketForPlacement, validateTicketAgainstRaceState, normalizeGambiaPhone } from './utils';
import { LanguageProvider } from './LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { deferWork } from './perf';
import { 
    supabase, dbPlaceBet, dbPayoutTicket, dbFetchUsers, dbFetchRaces, 
    dbFetchLiveTickets, checkBackendConnection, dbSaveRace, 
    dbUpdateRace, dbDeleteRace, dbUpdateNonRunners, dbSaveRaceResult,
    dbFetchDepositRequests, dbFetchWithdrawalRequests, dbDepositRequest,
    dbMarkDepositRequestApproved, dbRejectDepositRequest, dbCancelWithdrawal,
    dbCreateWithdrawalRequest, dbAddUser, dbFetchPromotions,
    dbTogglePromotionStatus, dbUpdatePromotion, dbMovePromotion,
    dbCreatePromotion, dbDeletePromotion, dbFetchProgramImages,
    dbAddProgramImage, dbDeleteProgramImage, dbUploadProgramFile, dbFetchPaymentConfigs,
    dbSavePaymentConfig, dbFetchManualBetOrders, dbCreateManualBetOrder,
    dbCancelManualBetOrder, dbMarkManualBetOrderCompleted, dbPayForBooking,
    dbProcessWithdrawalRequest, dbFetchChatThreads, dbFetchChatMessages,
    dbSendChatMessage, dbMarkThreadAsRead, dbSettleRaceTickets, dbCancelTicket,
    dbToggleUserLock, dbAdminResetPassword, dbRecalculateAllTicketsSafely,
    dbApplyCustomerDeposit, dbApplyCustomerBalanceAdjustment, dbFreshStart, dbFetchUserBalance,
    dbMigrateLegacyBookedTicketsToActive, dbFetchDepositLogs, dbInsertDepositLog,
    dbGenerateAndSendOTP, dbFetchOTPConfig, dbVerifyOTP
} from './supabaseClient';

const LAZY_CHUNK_RETRY_KEY = 'betese_lazy_chunk_retry';
const ACTIVE_USER_ID_KEY = 'betese_active_user_id';
const ACTIVE_USER_CACHE_KEY = 'betese_active_user_cache';

const normalizeCachedUser = (value: any): User | null => {
    if (!value || typeof value !== 'object') return null;
    const id = String(value.id || '').trim();
    const name = String(value.name || '').trim();
    const role = normalizeRole(value.role);
    if (!id || !name) return null;

    return {
        id,
        name,
        role,
        isLocked: Boolean(value.isLocked),
        phone: value.phone || undefined,
        password: value.password || undefined,
        correctionPin: value.correctionPin || undefined,
        walletBalance: Number(value.walletBalance ?? 0),
        bonusBalance: Number(value.bonusBalance ?? 0),
        totalDepositedAmount: Number(value.totalDepositedAmount ?? 0),
        firstDepositAt: value.firstDepositAt ? new Date(value.firstDepositAt) : undefined,
        createdById: value.createdById || undefined,
        createdByName: value.createdByName || undefined,
    };
};

const readCachedActiveUser = (): User | null => {
    try {
        const raw = localStorage.getItem(ACTIVE_USER_CACHE_KEY);
        if (!raw) return null;
        return normalizeCachedUser(JSON.parse(raw));
    } catch {
        return null;
    }
};

const writeCachedActiveUser = (user: User): void => {
    try {
        localStorage.setItem(ACTIVE_USER_CACHE_KEY, JSON.stringify({
            ...user,
            firstDepositAt: user.firstDepositAt ? user.firstDepositAt.toISOString() : undefined,
        }));
    } catch {}
};

const clearCachedActiveUser = (): void => {
    try {
        localStorage.removeItem(ACTIVE_USER_CACHE_KEY);
    } catch {}
};

const lazyWithChunkRecovery = <T,>(importer: () => Promise<{ default: T }>) =>
    lazy(async () => {
        try {
            const mod = await importer();
            try { sessionStorage.removeItem(LAZY_CHUNK_RETRY_KEY); } catch {}
            return mod;
        } catch (error) {
            const msg = String((error as any)?.message || error || '');
            const isChunkLoadError = /failed to fetch dynamically imported module|loading chunk|chunkloaderror|importing a module script failed/i.test(msg);
            if (isChunkLoadError && typeof window !== 'undefined') {
                let hasRetried = false;
                try {
                    hasRetried = sessionStorage.getItem(LAZY_CHUNK_RETRY_KEY) === '1';
                } catch {}
                if (!hasRetried) {
                    try { sessionStorage.setItem(LAZY_CHUNK_RETRY_KEY, '1'); } catch {}
                    const url = new URL(window.location.href);
                    url.searchParams.set('refresh', Date.now().toString());
                    window.location.replace(url.toString());
                    await new Promise(() => {});
                }
                try { sessionStorage.removeItem(LAZY_CHUNK_RETRY_KEY); } catch {}
            }
            throw error;
        }
    });

const LoginScreen = lazyWithChunkRecovery(() => import('./components/LoginScreen').then(m => ({ default: m.LoginScreen })));
const BettingTerminal = lazyWithChunkRecovery(() => import('./components/BettingTerminal').then(m => ({ default: m.BettingTerminal })));
const AdminDashboard = lazyWithChunkRecovery(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SupervisorDashboard = lazyWithChunkRecovery(() => import('./components/SupervisorDashboard').then(m => ({ default: m.SupervisorDashboard })));
const CustomerDashboard = lazyWithChunkRecovery(() => import('./components/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const TicketModal = lazyWithChunkRecovery(() => import('./components/TicketModal').then(m => ({ default: m.TicketModal })));
const ChatPanel = lazyWithChunkRecovery(() => import('./components/ChatSystem').then(m => ({ default: m.ChatPanel })));
const EmergencyRecover = lazyWithChunkRecovery(() => import('./components/EmergencyRecover').then(m => ({ default: m.EmergencyRecover })));

const LoadingPane: React.FC = () => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">Loading...</div>
);

const buildDepositVerificationDefaults = (request: Pick<DepositRequest, 'method' | 'status' | 'processedBy' | 'processedByName'> & Partial<DepositRequest>) => {
    if (request.method !== 'Wave') {
        return {
            verificationStatus: request.verificationStatus || 'NotStarted' as const,
            verificationSource: request.verificationSource,
            verificationMessage: request.verificationMessage,
            providerReference: request.providerReference,
            verifiedAt: request.verifiedAt,
        };
    }

    if (request.verificationStatus) {
        return {
            verificationStatus: request.verificationStatus,
            verificationSource: request.verificationSource,
            verificationMessage: request.verificationMessage,
            providerReference: request.providerReference,
            verifiedAt: request.verifiedAt,
        };
    }

    if (request.status === 'Approved') {
        const isClientFallback = request.processedBy === 'SYSTEM' || request.processedByName === 'Wave Direct Deposit';
        return {
            verificationStatus: 'Verified' as const,
            verificationSource: isClientFallback ? 'client-fallback' as const : 'manual-review' as const,
            verificationMessage: isClientFallback
                ? 'Credited through temporary client fallback. Replace with webhook confirmation for production.'
                : 'Approved after manual review.',
            providerReference: request.providerReference,
            verifiedAt: request.verifiedAt,
        };
    }

    if (request.status === 'Rejected') {
        return {
            verificationStatus: 'VerificationFailed' as const,
            verificationSource: request.verificationSource || 'manual-review' as const,
            verificationMessage: request.verificationMessage || 'Deposit request rejected before provider confirmation.',
            providerReference: request.providerReference,
            verifiedAt: request.verifiedAt,
        };
    }

    return {
        verificationStatus: 'PendingProviderConfirmation' as const,
        verificationSource: request.verificationSource,
        verificationMessage: request.verificationMessage || 'Waiting for Wave webhook/status verification.',
        providerReference: request.providerReference,
        verifiedAt: request.verifiedAt,
    };
};

const getTicketFunding = (ticket: Pick<Ticket, 'selections' | 'totalCost'>) => {
    const metadata = Array.isArray(ticket.selections) && ticket.selections.length > 0 ? ticket.selections[0] : null;
    const bonusStake = Number(metadata?.bonusStakeAmount || 0);
    const cashStake = Number(metadata?.cashStakeAmount ?? Math.max(0, Number(ticket.totalCost || 0) - bonusStake));
    const fundingSource = metadata?.fundingSource || (bonusStake > 0 ? (cashStake > 0 ? 'mixed' : 'bonus') : 'cash');
    return {
        bonusStake: Number(bonusStake.toFixed(2)),
        cashStake: Number(cashStake.toFixed(2)),
        fundingSource,
    } as const;
};

const normalizeRole = (role: unknown): Role => {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'admin') return 'Admin';
    if (value === 'supervisor') return 'Supervisor';
    if (value === 'vendor') return 'Vendor';
    return 'Customer';
};

const normalizePromotionRules = (rules: PromotionRule[]): PromotionRule[] => {
    const cleaned = (rules || [])
        .map(rule => ({
            depositAmount: Number(Number(rule.depositAmount || 0).toFixed(2)),
            bonusAmount: Number(Number(rule.bonusAmount || 0).toFixed(2)),
        }))
        .filter(rule => rule.depositAmount > 0 && rule.bonusAmount > 0);

    const byDeposit = new Map<number, number>();
    cleaned.forEach(rule => {
        const prev = byDeposit.get(rule.depositAmount) || 0;
        if (rule.bonusAmount > prev) byDeposit.set(rule.depositAmount, rule.bonusAmount);
    });

    return Array.from(byDeposit.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([depositAmount, bonusAmount]) => ({ depositAmount, bonusAmount }));
};

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file as data URL.'));
        reader.readAsDataURL(file);
    });
};

const AppContent: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => readCachedActiveUser());
    const [users, setUsers] = useState<User[]>([]);
    const [usersReady, setUsersReady] = useState(false);
    const [sessionRestorePending, setSessionRestorePending] = useState(() => {
        try {
            return !readCachedActiveUser() && Boolean(localStorage.getItem(ACTIVE_USER_ID_KEY));
        } catch {
            return false;
        }
    });
    const [races, setRaces] = useState<Race[]>([]);
  const [placedTickets, setPlacedTickets] = useState<Ticket[]>([]); 
  const [systemKey, setSystemKey] = useState(0); 
  
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [depositLogs, setDepositLogs] = useState<DepositLog[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [manualBetOrders, setManualBetOrders] = useState<ManualBetOrder[]>([]);
  const [programImages, setProgramImages] = useState<ProgramImage[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [seenWinningTickets, setSeenWinningTickets] = useState<Set<string>>(new Set());
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentIntegrationConfig[]>([]);
    const duplicatePhoneLockInFlightRef = useRef(false);
        const legacyBookedMigrationDoneRef = useRef(false);

  const [betSlip, setBetSlip] = useState<BetSlip>({ selections: [], totalCost: 0 });
  const isBettingInFlightRef = useRef(false); // prevents double-click on Place Bet / Book Bet
    const [isBettingInProgress, setIsBettingInProgress] = useState(false);
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [paidTicketModal, setPaidTicketModal] = useState<Ticket | null>(null);
  const [ticketToReprint, setTicketToReprint] = useState<Ticket | null>(null);
  const [walletFlash, setWalletFlash] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [effectiveTime, setEffectiveTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
    const serverTimeOffsetMsRef = useRef(0);

    const waitMs = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
    const withRetry = async <T,>(op: () => Promise<T>, attempts = 3, pauseMs = 300): Promise<T> => {
        let lastErr: unknown;
        for (let i = 0; i < attempts; i++) {
            try {
                return await op();
            } catch (e) {
                lastErr = e;
                if (i < attempts - 1) await waitMs(pauseMs * (i + 1));
            }
        }
        throw lastErr;
    };

    const isSunmiLite = useMemo(() => {
            if (typeof window === 'undefined') return false;
            const ua = String(window.navigator?.userAgent || '').toLowerCase();
            const params = new URLSearchParams(window.location.search);
            return ua.includes('sunmi') || ua.includes('t2mini') || params.get('lite') === '1';
    }, []);

  const syncEffectiveTimeWithServer = useCallback(async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) return;

      try {
          const response = await fetch(`${supabaseUrl}/rest/v1/races?select=id&limit=1`, {
              method: 'GET',
              headers: {
                  apikey: supabaseAnonKey,
                  Authorization: `Bearer ${supabaseAnonKey}`,
              },
          });
          const dateHeader = response.headers.get('date');
          if (!dateHeader) return;

          const serverNow = new Date(dateHeader);
          if (Number.isNaN(serverNow.getTime())) return;

          serverTimeOffsetMsRef.current = serverNow.getTime() - Date.now();
          setEffectiveTime(new Date(Date.now() + serverTimeOffsetMsRef.current));
      } catch {
          // Fall back to device time when server time cannot be resolved.
      }
  }, []);

  const loadLiveSystemData = async (user?: User) => {
      if (!supabase) return;
      try {
          // Always attempt to load data — don't gate on HEAD probe which can fail
          // even when Supabase is fully reachable. Mark online after data loads.
          setIsOnline(true);

          if (!legacyBookedMigrationDoneRef.current) {
              try {
                  await dbMigrateLegacyBookedTicketsToActive();
              } catch (migrationError) {
                  console.error('Legacy booking migration failed:', migrationError);
              } finally {
                  legacyBookedMigrationDoneRef.current = true;
              }
          }

          const targetUser = user || currentUser;

          // CRITICAL DATA FIRST: Users, races, tickets, financial transactions
          const [
              usersResult,
              racesResult,
              depositsResult,
              withdrawalsResult,
              depositLogsResult,
              manualBetsResult,
              liveTicketsResult,
          ] = await Promise.allSettled([
              withRetry(() => dbFetchUsers(), 3, 350),
              withRetry(() => dbFetchRaces(), 2, 250),
              withRetry(() => dbFetchDepositRequests(), 2, 250),
              withRetry(() => dbFetchWithdrawalRequests(), 2, 250),
              withRetry(() => dbFetchDepositLogs(), 2, 250),
              withRetry(() => dbFetchManualBetOrders(), 2, 250),
              targetUser ? withRetry(() => dbFetchLiveTickets(targetUser), 2, 250) : Promise.resolve([] as Ticket[])
          ]);
          
          const criticalSuccess = [
              usersResult,
              racesResult,
              depositsResult,
              withdrawalsResult,
              depositLogsResult,
              manualBetsResult,
              liveTicketsResult,
          ].some(r => r.status === 'fulfilled');

          setIsOnline(criticalSuccess);

          if (usersResult.status === 'fulfilled' && usersResult.value && usersResult.value.length > 0) {
              const normalizedUsers = usersResult.value.map(u => ({ ...u, role: normalizeRole(u.role) }));
              setUsers(normalizedUsers);
              if (targetUser) {
                  const freshCurrentUser = normalizedUsers.find((item) => item.id === targetUser.id);
                  if (freshCurrentUser && !freshCurrentUser.isLocked) {
                      setCurrentUser(freshCurrentUser);
                      writeCachedActiveUser(freshCurrentUser);
                  } else if (freshCurrentUser?.isLocked) {
                      setCurrentUser(null);
                      clearCachedActiveUser();
                  }
              }
          }
          if (racesResult.status === 'fulfilled') setRaces(racesResult.value || []);
          
          // Map snake_case to camelCase for requests with robust safety
          // and normalize status/method to prevent UI/report mismatches.
          if (depositsResult.status === 'fulfilled') {
              setDepositRequests((depositsResult.value || []).map((r: any) => {
              const rawMethod = String(r.method || '').trim().toLowerCase();
              const normalizedMethod: 'Wave' | 'AfriMoney' = rawMethod === 'afrimoney' ? 'AfriMoney' : 'Wave';

              const rawStatus = String(r.status || '').trim().toLowerCase();
              const normalizedStatus: 'Pending' | 'Approved' | 'Rejected' =
                  rawStatus === 'approved' ? 'Approved' : rawStatus === 'rejected' ? 'Rejected' : 'Pending';

              return {
              id: r.id, 
              customerId: r.customer_id, 
              customerName: r.customer_name || 'Quick Deposit', // Added missing required property
              amount: Number(r.amount) || 0, 
              method: normalizedMethod,
              transactionId: r.transaction_id, 
              status: normalizedStatus,
              timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
              processedBy: r.processed_by, 
              processedByName: r.processed_by_name, 
              processedAt: r.processed_at ? new Date(r.processed_at) : undefined,
              ...buildDepositVerificationDefaults({
                  method: normalizedMethod,
                  status: normalizedStatus,
                  processedBy: r.processed_by,
                  processedByName: r.processed_by_name,
                  providerReference: r.provider_reference,
                  verificationStatus: (r.verification_status as DepositRequest['verificationStatus']) || undefined,
                  verificationSource: (r.verification_source as DepositRequest['verificationSource']) || undefined,
                  verificationMessage: r.verification_message,
                  verifiedAt: r.verified_at ? new Date(r.verified_at) : undefined,
              })
          }}));
          }

          if (depositLogsResult.status === 'fulfilled') setDepositLogs(depositLogsResult.value || []);

          if (withdrawalsResult.status === 'fulfilled') {
              setWithdrawalRequests((withdrawalsResult.value || []).map((r: any) => ({
              id: r.id, 
              customerId: r.user_id, // Corrected from userId to customerId to match type
              customerName: r.user_name || 'Client',
              amount: Number(r.amount) || 0, 
              status: r.status,
              code: r.code, 
              requestedAt: r.requested_at ? new Date(r.requested_at) : new Date(),
              completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
              processedBy: r.processed_by,
              processedByName: r.processed_by_name
          })));
          }

          if (manualBetsResult.status === 'fulfilled') setManualBetOrders(manualBetsResult.value || []);
          if (liveTicketsResult.status === 'fulfilled') setPlacedTickets(liveTicketsResult.value || []);
          
          // DEFERRED DATA: Load non-critical features after app is interactive
          deferWork(() => {
              Promise.allSettled([
                  withRetry(() => dbFetchPromotions(), 2, 250),
                  withRetry(() => dbFetchChatThreads(), 2, 250),
                  withRetry(() => dbFetchChatMessages(), 2, 250),
                  withRetry(() => dbFetchProgramImages(), 2, 250),
                  withRetry(() => dbFetchPaymentConfigs(), 2, 250),
              ]).then(([promotionsResult, threadsResult, messagesResult, programImagesResult, paymentConfigsResult]) => {
                  try {
                      if (promotionsResult.status === 'fulfilled') setPromotions(promotionsResult.value || []);
                      if (threadsResult.status === 'fulfilled') setThreads(threadsResult.value || []);
                      if (messagesResult.status === 'fulfilled') setMessages(messagesResult.value || []);
                      if (programImagesResult.status === 'fulfilled') setProgramImages(programImagesResult.value || []);
                      if (paymentConfigsResult.status === 'fulfilled') setPaymentConfigs(paymentConfigsResult.value || []);
                  } catch (err) {
                      console.error("Deferred data load error:", err);
                  }
              }).catch(err => {
                  console.error("Deferred Promise.allSettled error:", err);
              });
          });
      } catch (err) {
          console.error("Data Sync Error:", err);
          setIsOnline(false);
      }
  };

  const handleRefreshSystem = () => {
      setBetSlip({ selections: [], totalCost: 0 });
      setLastTicket(null);
      setSystemKey(prev => prev + 1);
      loadLiveSystemData();
  };

  useEffect(() => { loadLiveSystemData(); }, []);

  // Fast early user fetch so the login form works immediately on page load
  useEffect(() => {
      let isMounted = true;
      const readyTimeout = window.setTimeout(() => {
          if (isMounted) {
              setUsersReady(true);
              setSessionRestorePending(false);
          }
      }, 7000);

      if (!supabase) {
          setUsersReady(true);
          setSessionRestorePending(false);
          return () => {
              isMounted = false;
              window.clearTimeout(readyTimeout);
          };
      }

      withRetry(() => dbFetchUsers(), 3, 350)
          .then(fetched => {
              if (!isMounted) return;
              if (fetched && fetched.length > 0) {
                  const normalizedUsers = fetched.map(u => ({ ...u, role: normalizeRole(u.role) }));
                  setUsers(normalizedUsers);

                  // Restore active session after refresh/recovery on terminals.
                  const rememberedUserId = localStorage.getItem(ACTIVE_USER_ID_KEY);
                  if (rememberedUserId && !currentUser) {
                      const restored = normalizedUsers.find(u => u.id === rememberedUserId);
                      if (restored && !restored.isLocked) {
                          setCurrentUser(restored);
                      }
                  }
              }
          })
          .catch(() => {
              // Keep login accessible even if initial fetch fails or stalls.
          })
          .finally(() => {
              if (isMounted) {
                  setUsersReady(true);
                  setSessionRestorePending(false);
              }
              window.clearTimeout(readyTimeout);
          });

      return () => {
          isMounted = false;
          window.clearTimeout(readyTimeout);
      };
  }, []);

  useEffect(() => {
      if (!supabase || !currentUser) return;
      const userSub = supabase.channel('public:users').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` }, async (payload) => {
          setCurrentUser(prev => prev ? {
              ...prev,
              name: (payload.new as any)?.name ?? prev.name,
              role: normalizeRole((payload.new as any)?.role),
              isLocked: Boolean((payload.new as any)?.is_locked),
              phone: (payload.new as any)?.phone ?? prev.phone,
              password: (payload.new as any)?.password ?? prev.password,
              walletBalance: Number((payload.new as any)?.wallet_balance ?? prev.walletBalance ?? 0),
              bonusBalance: Number((payload.new as any)?.bonus_balance ?? prev.bonusBalance ?? 0),
              totalDepositedAmount: Number((payload.new as any)?.total_deposited_amount ?? prev.totalDepositedAmount ?? 0),
              firstDepositAt: (payload.new as any)?.first_deposit_at ? new Date((payload.new as any).first_deposit_at) : prev.firstDepositAt,
              createdById: (payload.new as any)?.created_by_id ?? prev.createdById,
              createdByName: (payload.new as any)?.created_by_name ?? prev.createdByName
          } : null);
          const updatedUsers = await dbFetchUsers();
          setUsers((updatedUsers || []).map(u => ({ ...u, role: normalizeRole(u.role) })));
      }).subscribe();
      
      let ticketFilter = '';
      if(currentUser.role === 'Vendor') ticketFilter = `vendor_id=eq.${currentUser.id}`;
      else if(currentUser.role === 'Customer') ticketFilter = `customer_id=eq.${currentUser.id}`;
      
      const ticketSub = supabase.channel('public:tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: ticketFilter }, async () => {
          const updatedTickets = await dbFetchLiveTickets(currentUser); setPlacedTickets(updatedTickets);
      }).subscribe();
      const raceSub = supabase.channel('public:races').on('postgres_changes', { event: '*', schema: 'public', table: 'races' }, async () => {
          const updatedRaces = await dbFetchRaces(); setRaces(updatedRaces);
      }).subscribe();
      return () => { supabase?.removeChannel(userSub); supabase?.removeChannel(ticketSub); supabase?.removeChannel(raceSub); };
  }, [currentUser?.id]);

  useEffect(() => {
      if (!supabase || duplicatePhoneLockInFlightRef.current) return;

      const byPhone = new Map<string, User[]>();
      (users || [])
          .filter(u => u.role === 'Customer')
          .forEach(u => {
              const normalizedPhone = normalizeGambiaPhone(u.phone || '');
              if (!normalizedPhone) return;
              const bucket = byPhone.get(normalizedPhone) || [];
              bucket.push(u);
              byPhone.set(normalizedPhone, bucket);
          });

      const duplicateUsers = Array.from(byPhone.values())
          .filter(group => group.length > 1)
          .flat();

      const idsToLock = duplicateUsers.filter(u => !u.isLocked).map(u => u.id);
      if (idsToLock.length === 0) return;

      duplicatePhoneLockInFlightRef.current = true;

      // Immediately block duplicate-phone customers in UI while persisting lock in DB.
      setUsers(prev => (prev || []).map(u => idsToLock.includes(u.id) ? { ...u, isLocked: true } : u));
      setCurrentUser(prev => prev && idsToLock.includes(prev.id) ? { ...prev, isLocked: true } : prev);

      void Promise.all(idsToLock.map((id) => dbToggleUserLock(id, true).catch(() => null))).finally(() => {
          duplicatePhoneLockInFlightRef.current = false;
      });
  }, [users]);

  useEffect(() => {
      syncEffectiveTimeWithServer();
      const interval = setInterval(() => setEffectiveTime(new Date(Date.now() + serverTimeOffsetMsRef.current)), isSunmiLite ? 5000 : 1000);
      const resyncInterval = setInterval(() => { void syncEffectiveTimeWithServer(); }, 5 * 60 * 1000);
      return () => {
          clearInterval(interval);
          clearInterval(resyncInterval);
      };
  }, [isSunmiLite, syncEffectiveTimeWithServer]);

  useEffect(() => {
      if (typeof document === 'undefined') return;
      document.body.classList.toggle('sunmi-lite', isSunmiLite);
      return () => document.body.classList.remove('sunmi-lite');
  }, [isSunmiLite]);

  const handleAddRace = async (race: Race) => {
      const normalize = (value: string) => value.trim().toLowerCase();
      const sameCodeOrName = (r: Race) => {
          const sameCode = race.raceCode && r.raceCode && normalize(race.raceCode) === normalize(r.raceCode);
          const sameName = normalize(r.name || '') === normalize(race.name || '');
          const sameEndTime = Math.abs((r.endDate?.getTime?.() || 0) - (race.endDate?.getTime?.() || 0)) < 60_000;
          return Boolean(sameCode || (sameName && sameEndTime));
      };

      if ((races || []).some(sameCodeOrName)) {
          alert('Duplicate race blocked: same race code or same name/time already exists.');
          return;
      }

      try {
          if (supabase) { await dbSaveRace(race); } 
          else { setRaces(prev => [...prev, race]); }
          loadLiveSystemData();
      } catch (e: any) { alert("Failed to save race: " + e.message); }
  };

  const handleUpdateRace = async (race: Race) => {
      const raceWithAudit: Race = {
          ...race,
          updatedById: currentUser?.id,
          updatedByName: currentUser?.name,
          updatedAt: effectiveTime,
      };
      try {
          if (supabase) { await dbUpdateRace(raceWithAudit); } 
          else { setRaces(prev => (prev || []).map(r => r.id === race.id ? raceWithAudit : r)); }
      } catch (e: any) { alert("Failed to update race: " + e.message); }
  };

  const handleDeleteRace = async (race: Race) => {
      if (!confirm("Are you sure you want to delete this race?")) return;
      try {
          if (supabase) {
              await dbDeleteRace(race.id);
              setRaces(prev => (prev || []).filter(r => r.id !== race.id));
          } else {
              setRaces(prev => (prev || []).filter(r => r.id !== race.id));
          }
      } catch (e: any) { alert("Failed to delete race: " + e.message); }
  };

  const handleUpdateNonRunners = async (raceId: string, nonRunners: number[]) => {
      const normalized = [...new Set((nonRunners || []).map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0))]
          .sort((a, b) => a - b);
      try {
          if (supabase) {
              await dbUpdateNonRunners(raceId, normalized);
              await loadLiveSystemData(currentUser || undefined);
          } else {
              setRaces(prev => (prev || []).map(r => r.id === raceId ? { ...r, nonRunners: normalized } : r));
          }
      } catch (e: any) {
          alert("Failed to save non-runners: " + (e?.message || e));
      }
  };

  const settleRaceTicketsLocally = useCallback((result: RaceResult, updatedRaces: Race[]) => {
      const relevantTickets = (placedTickets || []).filter(ticket =>
          ['Active', 'Winning', 'Paid', 'Lost'].includes(ticket.status)
          && ticket.selections.some(selection => selection.raceId === result.raceId)
      );

      if (relevantTickets.length === 0) return;

      const customerIds = Array.from(new Set(relevantTickets.map(ticket => ticket.customerId).filter(Boolean))) as string[];
      const walletBalanceMap = new Map<string, number>();
      const bonusBalanceMap = new Map<string, number>();

      customerIds.forEach(customerId => {
          const customer = (users || []).find(user => user.id === customerId);
          walletBalanceMap.set(customerId, Number(customer?.walletBalance || 0));
          bonusBalanceMap.set(customerId, Number(customer?.bonusBalance || 0));
      });

      const settledTicketMap = new Map<string, Ticket>();

      relevantTickets.forEach(ticket => {
          const evaluation = calculateTicketWinnings(ticket, updatedRaces);
          const allSelectionsResolved = ticket.selections.every(selection => {
              const race = updatedRaces.find(item => item.id === selection.raceId);
              return Boolean(race?.result?.winningNumbers?.length);
          });

          const nextWinnings = Number(evaluation.totalWinnings.toFixed(2));
          const previousWinnings = Number(ticket.winnings || 0);
          const isOnlineCustomer = Boolean(ticket.customerId);
          const wasPaidOnline = isOnlineCustomer && ticket.status === 'Paid';
          const funding = getTicketFunding(ticket);
          const creditsBonusWallet = isOnlineCustomer && funding.bonusStake > 0;

          let nextStatus = ticket.status;
          let paidAt = ticket.paidAt;
          let paidById = ticket.paidById;
          let paidByName = ticket.paidByName;
          let settledWinnings = nextWinnings;

          if (allSelectionsResolved) {
              if (nextWinnings > 0) {
                  if (isOnlineCustomer) {
                      nextStatus = 'Paid';
                      paidAt = paidAt || new Date();
                      paidById = paidById || 'SYSTEM';
                      paidByName = paidByName || (creditsBonusWallet ? 'System Bonus Credit' : 'System Auto Credit');
                  } else {
                      nextStatus = ticket.status === 'Paid' ? 'Paid' : 'Winning';
                  }
              } else {
                  nextStatus = 'Lost';
                  paidAt = undefined;
                  paidById = undefined;
                  paidByName = undefined;
              }
          }

          if (wasPaidOnline && (nextStatus !== 'Paid' || settledWinnings < previousWinnings)) {
              nextStatus = 'Paid';
              settledWinnings = previousWinnings;
              paidAt = paidAt || new Date();
              paidById = paidById || 'SYSTEM';
              paidByName = paidByName || (creditsBonusWallet ? 'System Bonus Credit' : 'System Auto Credit');
          }

          if (isOnlineCustomer && ticket.customerId) {
              const previousCredited = ticket.status === 'Paid' ? previousWinnings : 0;
              const nextCredited = nextStatus === 'Paid' ? settledWinnings : 0;
              const delta = Number((nextCredited - previousCredited).toFixed(2));
              if (delta !== 0) {
                  if (creditsBonusWallet) {
                      const currentBonus = Number(bonusBalanceMap.get(ticket.customerId) || 0);
                      bonusBalanceMap.set(ticket.customerId, Number((currentBonus + delta).toFixed(2)));
                  } else {
                      const currentWallet = Number(walletBalanceMap.get(ticket.customerId) || 0);
                      walletBalanceMap.set(ticket.customerId, Number((currentWallet + delta).toFixed(2)));
                  }
              }
          }

          settledTicketMap.set(ticket.id, {
              ...ticket,
              status: nextStatus,
              winnings: settledWinnings || undefined,
              winningsBreakdown: evaluation.breakdown,
              paidAt,
              paidById,
              paidByName,
          });
      });

      setPlacedTickets(prev => (prev || []).map(ticket => settledTicketMap.get(ticket.id) || ticket));

      if (customerIds.length > 0) {
          setUsers(prev => (prev || []).map(user => {
              if (!customerIds.includes(user.id)) return user;
              return {
                  ...user,
                  walletBalance: Number((walletBalanceMap.get(user.id) ?? user.walletBalance ?? 0).toFixed(2)),
                  bonusBalance: Number((bonusBalanceMap.get(user.id) ?? user.bonusBalance ?? 0).toFixed(2)),
              };
          }));

          setCurrentUser(prev => {
              if (!prev || !customerIds.includes(prev.id)) return prev;
              return {
                  ...prev,
                  walletBalance: Number((walletBalanceMap.get(prev.id) ?? prev.walletBalance ?? 0).toFixed(2)),
                  bonusBalance: Number((bonusBalanceMap.get(prev.id) ?? prev.bonusBalance ?? 0).toFixed(2)),
              };
          });
      }
  }, [placedTickets, users]);

  const handleSaveRaceResult = async (result: RaceResult): Promise<boolean> => {
      if (!currentUser || currentUser.role !== 'Admin') {
          alert("Only Admin can enter or edit race results.");
          return false;
      }

      const existingRace = (races || []).find(r => r.id === result.raceId);
      const isEdit = !!(existingRace?.result?.winningNumbers?.length);
      const now = new Date();

      // Stamp audit trail
      const auditedResult: RaceResult = {
          ...result,
          lastEditedById: currentUser.id,
          lastEditedByName: currentUser.name,
          lastEditedAt: now,
          // Preserve original entry info on edits; set it fresh on first entry
          enteredById: isEdit ? (existingRace?.result?.enteredById ?? currentUser.id) : currentUser.id,
          enteredByName: isEdit ? (existingRace?.result?.enteredByName ?? currentUser.name) : currentUser.name,
          enteredAt: isEdit ? (existingRace?.result?.enteredAt ?? now) : now,
      };

      const nextRaces = (races || []).map(r => r.id === auditedResult.raceId ? { ...r, result: auditedResult } : r);

      try {
          if (supabase) {
              // 1. Save race result immediately (fast: single row update)
              await dbSaveRaceResult(auditedResult);
              // 2. Update UI immediately so modal can close
              setRaces(nextRaces);
              alert("Result saved. Settling tickets in background...");
              // 3. Settle tickets + reload data in background — don't block the user
              dbSettleRaceTickets(auditedResult, nextRaces)
                  .then(() => loadLiveSystemData(currentUser))
                  .catch((bgErr: any) => console.error("Background settle error:", bgErr));
          } else {
              setRaces(nextRaces);
              settleRaceTicketsLocally(auditedResult, nextRaces);
              alert("Result saved successfully.");
          }
          return true;
      } catch (e: any) {
          loadLiveSystemData(currentUser).catch(() => {});
          alert("Failed to save result: " + e.message);
          return false;
      }
  };

  const handleRecalculateAllTickets = async () => {
      if (!currentUser || currentUser.role !== 'Admin') {
          alert('Only Admin can recalculate all tickets.');
          return;
      }
      if (!supabase) {
          alert('Recalculation requires database mode.');
          return;
      }
      await dbRecalculateAllTicketsSafely();
      await loadLiveSystemData(currentUser);
  };

  const handleFreshStart = async () => {
      if (!currentUser || currentUser.role !== 'Admin') {
          alert('Only Admin can perform fresh start.');
          return;
      }
      if (!supabase) {
          alert('Fresh start requires database mode.');
          return;
      }
      const confirmed = window.confirm('⚠️ FRESH START - This will delete ALL races, tickets, and reset all wallet balances to 0. All user accounts will be kept. Continue?');
      if (!confirmed) return;
      try {
          const result = await dbFreshStart();
          setRaces([]);
          setPlacedTickets([]);
          setBetSlip({ selections: [], totalCost: 0 });
          await loadLiveSystemData(currentUser);
          alert('✅ Fresh start complete: All races and tickets cleared, wallets reset to 0.');
      } catch (err: any) {
          alert('Fresh start failed: ' + err.message);
      }
  };

  const payoutTicket = async (ticketId: string) => {
      if(!currentUser) return;
      const ticket = (placedTickets || []).find(t => t.id === ticketId);
      if(!ticket || !ticket.winnings) return;
      if (ticket.status === 'Paid' || ticket.paidAt) {
          alert(`This ticket is already paid${ticket.paidByName ? ` by ${ticket.paidByName}` : ''}.`);
          return;
      }
      if (ticket.customerId) {
          alert('Online customer tickets are settled automatically by the system. Manual payment is only for vendor cashout tickets.');
          return;
      }
      if(supabase) {
          try {
              const success = await dbPayoutTicket(ticketId, ticket.winnings, currentUser.id, currentUser.name);
              if(success) {
                  const paidTicket = { ...ticket, status: 'Paid' as const, paidAt: new Date(), paidById: currentUser.id, paidByName: currentUser.name };
                  setPlacedTickets(prev => (prev || []).map(t => t.id === ticketId ? paidTicket : t));
                  setPaidTicketModal(paidTicket);
              } else { alert("Ticket already paid or invalid."); }
          } catch(e: any) { alert("Payout failed: " + e.message); }
      }
  };

  const updateBetSlip = (newSelection: Omit<BetSelection, 'cost' | 'multiplier'>) => {
    const pricing = BET_PRICING[newSelection.betType];
    let cost = 0;
    if (pricing) {
        if (pricing.perHorsePrice) cost = (newSelection.numbers.length + newSelection.xCount) * pricing.perHorsePrice;
        else if (newSelection.xCount > 0) cost = pricing.xPriceMap?.[newSelection.xCount]?.[newSelection.numbers.length] ?? 0;
        else cost = pricing.priceMap[newSelection.numbers.length] ?? 0;
    }
    setBetSlip(prev => {
      const updated = { ...newSelection, cost, multiplier: 1 };
      const newSelections = [...prev.selections, updated];
      const totalCost = Number(newSelections.reduce((sum, s) => sum + (s.cost * s.multiplier), 0).toFixed(2));
      return { selections: newSelections, totalCost };
    });
  };

  const placeBet = async () => {
    if (!currentUser || betSlip.selections.length === 0) return;
    if (isBettingInFlightRef.current) return;
    isBettingInFlightRef.current = true;
        setIsBettingInProgress(true);

    try {
      // Recalculate totalCost fresh from selections to eliminate floating-point drift
      const recomputedCost = Number(betSlip.selections.reduce((sum, s) => sum + (s.cost * s.multiplier), 0).toFixed(2));
      const validSlip = { selections: betSlip.selections, totalCost: recomputedCost };

      const placementValidation = validateTicketForPlacement(validSlip);
      if (!placementValidation.valid) {
          alert(`Invalid ticket formula: ${placementValidation.message}`);
          return;
      }

      const raceStateValidation = validateTicketAgainstRaceState(betSlip.selections, races || []);
      if (!raceStateValidation.valid) {
          alert(`Selection blocked: ${raceStateValidation.message}`);
          return;
      }

    // ONLINE CUSTOMER WALLET CHECK
    if (currentUser.role === 'Customer') {
        let liveWalletBalance = Number(currentUser.walletBalance || 0);
        let liveBonusBalance = Number(currentUser.bonusBalance || 0);

        if (supabase) {
            try {
                const liveBalance = await dbFetchUserBalance(currentUser.id);
                liveWalletBalance = liveBalance.walletBalance;
                liveBonusBalance = liveBalance.bonusBalance;

                setCurrentUser(prev => prev ? {
                    ...prev,
                    walletBalance: liveBalance.walletBalance,
                    bonusBalance: liveBalance.bonusBalance,
                } : prev);
                setUsers(prev => prev.map(user => user.id === currentUser.id
                    ? { ...user, walletBalance: liveBalance.walletBalance, bonusBalance: liveBalance.bonusBalance }
                    : user
                ));
            } catch (balanceError: any) {
                alert(`Unable to verify wallet balance: ${balanceError.message}`);
                return;
            }
        }

        const totalAvailable = Number((liveWalletBalance + liveBonusBalance).toFixed(2));
        if (totalAvailable < betSlip.totalCost) {
            setWalletFlash(true);
            alert(`INSUFFICIENT BALANCE: Available GMD ${totalAvailable.toFixed(2)} (Cash ${liveWalletBalance.toFixed(2)}, Bonus ${liveBonusBalance.toFixed(2)}), but this bet needs GMD ${betSlip.totalCost.toFixed(2)}.`);
            return;
        }
    }

    const now = effectiveTime.getTime();
    const isClosed = betSlip.selections.some(s => {
        const r = (races || []).find(race => race.id === s.raceId);
        return !r || (r.endDate.getTime() - now) <= BETTING_CUTOFF_MS;
    });
    if (isClosed) { alert("FAILED: Betting closed (2-minute cutoff reached)."); return; }
    
    const newTicket: Ticket = {
      id: Math.floor(10000000 + Math.random() * 90000000).toString(),
      timestamp: effectiveTime,
      vendorId: currentUser.role === 'Vendor' ? currentUser.id : '',
      vendorName: currentUser.name,
      status: 'Active',
      customerId: currentUser.role === 'Customer' ? currentUser.id : undefined,
      ...betSlip
    };

      try {
          if (supabase) { 
              await dbPlaceBet(newTicket, currentUser); 
              setPlacedTickets(prev => {
                  const exists = (prev || []).some(t => t.id === newTicket.id);
                  return exists ? prev : [...(prev || []), newTicket];
              });
              const updatedTickets = await dbFetchLiveTickets(currentUser);
              setPlacedTickets(updatedTickets);
          } else { 
              // LOCAL MOCK WALLET DEDUCTION
              if (currentUser.role === 'Customer') {
                  const bonusUsed = Math.min(currentUser.bonusBalance || 0, betSlip.totalCost);
                  const cashUsed = betSlip.totalCost - bonusUsed;
                  const updatedUser = {
                      ...currentUser,
                      walletBalance: Number(((currentUser.walletBalance || 0) - cashUsed).toFixed(2)),
                      bonusBalance: Number(((currentUser.bonusBalance || 0) - bonusUsed).toFixed(2))
                  };
                  setCurrentUser(updatedUser);
                  setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
              }
              setPlacedTickets(prev => [...prev, newTicket]); 
          }
          setLastTicket(newTicket);
          setBetSlip({ selections: [], totalCost: 0 });
      } catch (e: any) { alert(`Transaction Failed: ${e.message}`); }
    } finally {
      isBettingInFlightRef.current = false;
            setIsBettingInProgress(false);
    }
  };

  const bookBet = async () => {
      if (!currentUser || betSlip.selections.length === 0) return;
      if (isBettingInFlightRef.current) return;
      isBettingInFlightRef.current = true;
      setIsBettingInProgress(true);

      try {
          // Recalculate totalCost fresh to eliminate floating-point drift
          const recomputedCost = Number(betSlip.selections.reduce((sum, s) => sum + (s.cost * s.multiplier), 0).toFixed(2));
          const validSlip = { selections: betSlip.selections, totalCost: recomputedCost };

          const placementValidation = validateTicketForPlacement(validSlip);
          if (!placementValidation.valid) {
              alert(`Invalid ticket formula: ${placementValidation.message}`);
              return;
          }

          const raceStateValidation = validateTicketAgainstRaceState(betSlip.selections, races || []);
          if (!raceStateValidation.valid) {
              alert(`Selection blocked: ${raceStateValidation.message}`);
              return;
          }

          const now = effectiveTime.getTime();
          const isClosed = betSlip.selections.some(s => {
              const r = (races || []).find(race => race.id === s.raceId);
              return !r || (r.endDate.getTime() - now) <= BETTING_CUTOFF_MS;
          });
          if (isClosed) { alert("FAILED: Betting closed (2-minute cutoff reached)."); return; }

          const bookingCode = "B" + Math.random().toString(36).substring(2, 8).toUpperCase();
          const newTicket: Ticket = {
              id: Math.floor(10000000 + Math.random() * 90000000).toString(),
              timestamp: effectiveTime,
              vendorId: currentUser.role === 'Customer' ? '' : currentUser.id,
              vendorName: currentUser.name,
              status: 'Booked',
              bookingCode,
              customerId: currentUser.role === 'Customer' ? currentUser.id : undefined,
              ...validSlip
          };

          if (supabase) {
              await dbPlaceBet(newTicket, currentUser);
              setPlacedTickets(prev => {
                  const exists = (prev || []).some(t => t.id === newTicket.id);
                  return exists ? prev : [...(prev || []), newTicket];
              });
              const updatedTickets = await dbFetchLiveTickets(currentUser);
              setPlacedTickets(updatedTickets);
          } else {
              setPlacedTickets(prev => [...prev, newTicket]);
          }
          setLastTicket(newTicket);
          setBetSlip({ selections: [], totalCost: 0 });
          alert("BOOKING CREATED SUCCESSFULLY: Use the booking code to retrieve, collect payment, and activate the ticket.");
      } catch (e: any) {
          alert(`Booking Failed: ${e.message}`);
      } finally {
          isBettingInFlightRef.current = false;
          setIsBettingInProgress(false);
      }
  };

    const handleDeposit = async (customerId: string, amount: number, method: string = 'Cash', transactionId?: string, processedByOverride?: { id: string; name: string }) => {
    const cust = (users || []).find(u => u.id === customerId);
    if (!cust || !currentUser) return { success: false, bonusApplied: 0 };

        const normalizedAmount = Number(Number(amount).toFixed(2));
        if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
            return { success: false, bonusApplied: 0 };
        }

        if (normalizedAmount < 0 && currentUser.role !== 'Admin') {
            alert('Only Admin can remove money from customer wallet.');
            return { success: false, bonusApplied: 0 };
        }

        if (normalizedAmount < 0 && (cust.walletBalance || 0) < Math.abs(normalizedAmount)) {
            return { success: false, bonusApplied: 0 };
        }

        const customerPhone = normalizeGambiaPhone(cust.phone || '');
        const hasDuplicatePhone = !!customerPhone && (users || []).some(u =>
            u.role === 'Customer' &&
            u.id !== cust.id &&
            normalizeGambiaPhone(u.phone || '') === customerPhone
        );

        if (hasDuplicatePhone) {
            if (supabase && !cust.isLocked) {
                try {
                    await dbToggleUserLock(cust.id, true);
                } catch (e) {
                    console.error('Failed to auto-lock duplicate phone account', e);
                }
            }
            setUsers(prev => (prev || []).map(u => u.id === cust.id ? { ...u, isLocked: true } : u));
            if (currentUser.id === cust.id) setCurrentUser(prev => prev ? { ...prev, isLocked: true } : prev);
            alert('This customer is blocked: phone number is duplicated across accounts.');
            return { success: false, bonusApplied: 0 };
        }

        const firstDepositPromo = promotions
            .filter(p => p.isActive && p.type === 'first-deposit')
            .flatMap(p => p.rules || [])
            .filter(rule => normalizedAmount > 0 && normalizedAmount >= Number(rule.depositAmount || 0))
            .sort((a, b) => Number(b.depositAmount || 0) - Number(a.depositAmount || 0))[0];

        const isFirstDeposit = normalizedAmount > 0 && Number(cust.totalDepositedAmount || 0) <= 0;
        const bonusApplied = isFirstDeposit ? Number(Number(firstDepositPromo?.bonusAmount || 0).toFixed(2)) : 0;

        let nextWalletBalance = Number(((cust.walletBalance || 0) + normalizedAmount).toFixed(2));
        let nextBonusBalance = Number((cust.bonusBalance || 0).toFixed(2));
        let nextTotalDeposited = Number(cust.totalDepositedAmount || 0);
        let nextFirstDepositAt = cust.firstDepositAt;

        try {
            if (supabase) {
                const dbResult = await dbApplyCustomerDeposit(customerId, normalizedAmount, bonusApplied, effectiveTime);
                nextWalletBalance = dbResult.walletBalance;
                nextBonusBalance = dbResult.bonusBalance;
                nextTotalDeposited = dbResult.totalDepositedAmount;
                nextFirstDepositAt = dbResult.firstDepositAt ? new Date(dbResult.firstDepositAt) : cust.firstDepositAt;
            } else {
                nextBonusBalance = Number(((cust.bonusBalance || 0) + bonusApplied).toFixed(2));
                nextTotalDeposited = normalizedAmount > 0
                    ? Number(((cust.totalDepositedAmount || 0) + normalizedAmount).toFixed(2))
                    : Number(cust.totalDepositedAmount || 0);
                nextFirstDepositAt = !cust.firstDepositAt && normalizedAmount > 0 ? effectiveTime : cust.firstDepositAt;
            }
        } catch (e: any) {
            alert(`Deposit Error: ${e.message}`);
            return { success: false, bonusApplied: 0 };
        }

        const updated = {
            ...cust,
            walletBalance: nextWalletBalance,
            bonusBalance: nextBonusBalance,
            totalDepositedAmount: nextTotalDeposited,
            firstDepositAt: nextFirstDepositAt
        };

                if (supabase) {
                    const refreshedUsers = await dbFetchUsers();
                    const normalizedUsers = (refreshedUsers || []).map(u => ({ ...u, role: normalizeRole(u.role) }));
                    setUsers(normalizedUsers);
                    setCurrentUser(prev => {
                        if (!prev) return prev;
                        const refreshedCurrent = normalizedUsers.find(user => user.id === prev.id);
                        if (refreshedCurrent) return refreshedCurrent;
                        if (prev.id === customerId) return { ...prev, ...updated };
                        return prev;
                    });
                } else {
                    setUsers(prev => (prev || []).map(u => u.id === customerId ? updated : u));
                    setCurrentUser(prev => prev && prev.id === customerId ? { ...prev, ...updated } : prev);
                }

    const createdDepositLog: DepositLog = {
        id: `dl-${Date.now()}`,
        customerId,
        customerName: cust.name,
        customerPhone: cust.phone,
        amount: normalizedAmount,
        bonusAwarded: bonusApplied || undefined,
        processedById: processedByOverride?.id || currentUser.id,
        processedByName: processedByOverride?.name || currentUser.name,
        timestamp: effectiveTime,
        method: method as any,
        transactionId
    };

    if (supabase) {
        try {
            await dbInsertDepositLog(createdDepositLog);
            const latestLogs = await dbFetchDepositLogs();
            setDepositLogs(latestLogs || []);
        } catch (e) {
            console.error('Failed to persist deposit log, keeping local copy', e);
            setDepositLogs(prev => [...prev, createdDepositLog]);
        }
    } else {
        setDepositLogs(prev => [...prev, createdDepositLog]);
    }
        return { success: true, bonusApplied };
  };

    const handleCreateDepositRequest = async (amount: number, method: 'Wave' | 'AfriMoney', phone: string) => {
    if (!currentUser) return;
        const normalizedPhone = normalizeGambiaPhone(phone || '');
        if (!normalizedPhone) {
            alert('Use valid phone: Gambia local 7 digits or +220XXXXXXX; Senegal must be +221XXXXXXXXX only.');
                return;
        }
    const normalizedAmount = Number(amount.toFixed(2));
    const newRequest: DepositRequest = {
        id: Math.floor(10000000 + Math.random() * 90000000).toString(),
        customerId: currentUser.id,
        customerName: currentUser.name, // Added missing property
        amount: normalizedAmount,
        method,
        transactionId: normalizedPhone,
        status: 'Pending',
        timestamp: effectiveTime,
        providerReference: method === 'Wave' ? `WAVE-${effectiveTime.getTime()}-${Math.floor(Math.random() * 1000)}` : undefined,
        verificationStatus: method === 'Wave' ? 'PendingProviderConfirmation' : 'NotStarted',
        verificationSource: method === 'Wave' ? 'client-fallback' : 'manual-review',
        verificationMessage: method === 'Wave' ? 'Waiting for backend webhook/status verification.' : undefined,
    };

    try {
        if (supabase) {
            await dbDepositRequest(newRequest);
        }
        setDepositRequests(prev => [newRequest, ...(prev || []).filter(req => req.id !== newRequest.id)]);

        if (method === 'Wave') {
            // Wave payments are auto-credited immediately.
            // Backoffice receives a notification to verify on the Wave merchant portal.
            await handleDeposit(currentUser.id, normalizedAmount, 'Wave', normalizedPhone, { id: 'SYSTEM', name: 'Wave Auto-Credit' });
            if (supabase) {
                await dbMarkDepositRequestApproved(newRequest.id, 'SYSTEM', 'Wave Auto-Credit', effectiveTime);
            }
            setDepositRequests(prev => (prev || []).map(req => req.id === newRequest.id
                ? {
                    ...req,
                    status: 'Approved',
                    processedBy: 'SYSTEM',
                    processedByName: 'Wave Auto-Credit',
                    processedAt: effectiveTime,
                    verificationStatus: 'PendingProviderConfirmation',
                    verificationSource: 'client-fallback',
                    verificationMessage: 'Auto-credited. Backoffice must verify on Wave merchant portal.',
                  }
                : req
            ));
        }
        // AfriMoney stays Pending for manual backoffice approval.
    } catch (e: any) {
        alert(`Payment Error: ${e.message}`);
        console.error("Deposit Error:", e);
    }
  };

  const handleApproveDepositRequest = async (requestId: string) => {
      const request = (depositRequests || []).find(r => r.id === requestId);
      if (!request || request.status !== 'Pending' || !currentUser) return;
      
      try {
          const result = await handleDeposit(request.customerId, request.amount, request.method, request.transactionId);
          if (!result.success) {
              throw new Error('Unable to credit wallet for this request.');
          }

          if (supabase) {
              await dbMarkDepositRequestApproved(requestId, currentUser.id, currentUser.name, effectiveTime);
          }

          setDepositRequests(prev => (prev || []).map(r =>
              r.id === requestId
                  ? {
                      ...r,
                      status: 'Approved',
                      processedBy: currentUser.id,
                      processedByName: currentUser.name,
                      processedAt: effectiveTime,
                      verificationStatus: r.method === 'Wave' ? 'Verified' : r.verificationStatus,
                      verificationSource: r.method === 'Wave' ? 'manual-review' : r.verificationSource,
                      verificationMessage: r.method === 'Wave' ? 'Approved after manual review.' : r.verificationMessage,
                      verifiedAt: r.method === 'Wave' ? effectiveTime : r.verifiedAt,
                    }
                  : r
          ));
      } catch (e: any) {
          alert(`Approval Error: ${e.message}`);
      }
  };

  const handleAdminBalanceAdjustment = async (customerId: string, walletDelta: number, bonusDelta: number, note: string, approvalPin: string) => {
      if (!currentUser || currentUser.role !== 'Admin') {
          return { success: false, message: 'Only admin can adjust wallet or bonus balances.' };
      }

      const acceptedPins = new Set(
          [
              String(currentUser.correctionPin || '').trim(),
              String(currentUser.password || '').trim()
          ].filter(Boolean)
      );
      const providedPin = String(approvalPin || '').trim();
      if (acceptedPins.size === 0 || !acceptedPins.has(providedPin)) {
          return { success: false, message: 'Approval PIN is invalid.' };
      }

      const customer = (users || []).find(u => u.id === customerId && u.role === 'Customer');
      if (!customer) return { success: false, message: 'Customer not found.' };

      const normalizedWalletDelta = Number(Number(walletDelta || 0).toFixed(2));
      const normalizedBonusDelta = Number(Number(bonusDelta || 0).toFixed(2));
      if (!Number.isFinite(normalizedWalletDelta) || !Number.isFinite(normalizedBonusDelta)) {
          return { success: false, message: 'Invalid adjustment amounts.' };
      }
      if (normalizedWalletDelta === 0 && normalizedBonusDelta === 0) {
          return { success: false, message: 'Enter wallet or bonus adjustment.' };
      }

      const nextWallet = Number(((customer.walletBalance || 0) + normalizedWalletDelta).toFixed(2));
      const nextBonus = Number(((customer.bonusBalance || 0) + normalizedBonusDelta).toFixed(2));
      if (nextWallet < 0) return { success: false, message: 'Wallet cannot go below zero.' };
      if (nextBonus < 0) return { success: false, message: 'Bonus cannot go below zero.' };

      let appliedWallet = nextWallet;
      let appliedBonus = nextBonus;
      try {
          if (supabase) {
              const dbResult = await dbApplyCustomerBalanceAdjustment(customerId, normalizedWalletDelta, normalizedBonusDelta);
              appliedWallet = dbResult.walletBalance;
              appliedBonus = dbResult.bonusBalance;
          }
      } catch (e: any) {
          return { success: false, message: e.message || 'Failed to apply adjustment.' };
      }

      const updatedCustomer = { ...customer, walletBalance: appliedWallet, bonusBalance: appliedBonus };
      setUsers(prev => (prev || []).map(u => u.id === customerId ? updatedCustomer : u));
      setCurrentUser(prev => prev && prev.id === customerId ? { ...prev, ...updatedCustomer } : prev);

      const createdCorrectionLog: DepositLog = {
          id: `dl-${Date.now()}`,
          customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          amount: normalizedWalletDelta,
          bonusAdjustment: normalizedBonusDelta || undefined,
          processedById: currentUser.id,
          processedByName: currentUser.name,
          timestamp: effectiveTime,
          method: 'Correction',
          note: note?.trim() || undefined
      };

      if (supabase) {
          try {
              await dbInsertDepositLog(createdCorrectionLog);
              const latestLogs = await dbFetchDepositLogs();
              setDepositLogs(latestLogs || []);
          } catch (e) {
              console.error('Failed to persist correction log, keeping local copy', e);
              setDepositLogs(prev => [...prev, createdCorrectionLog]);
          }
      } else {
          setDepositLogs(prev => [...prev, createdCorrectionLog]);
      }

      return { success: true, message: 'Balance adjustment applied.' };
  };

  const handleRejectDepositRequest = async (requestId: string) => {
      if(!currentUser) return;
      try {
          if (supabase) {
              await dbRejectDepositRequest(requestId, currentUser.id, currentUser.name, effectiveTime);
          }
          setDepositRequests(prev => (prev || []).map(r => r.id === requestId ? {
              ...r,
              status: 'Rejected',
              processedBy: currentUser.id,
              processedByName: currentUser.name,
              processedAt: effectiveTime,
              verificationStatus: r.method === 'Wave' ? 'VerificationFailed' : r.verificationStatus,
              verificationSource: r.method === 'Wave' ? 'manual-review' : r.verificationSource,
              verificationMessage: r.method === 'Wave' ? 'Rejected before provider confirmation.' : r.verificationMessage,
          } : r));
      } catch (e: any) {
          alert(`Rejection Error: ${e.message}`);
      }
  };

    const processManualBet = async (orderId: string) => {
    const order = (manualBetOrders || []).find(o => o.id === orderId);
    if (!order || !currentUser) return;

        const manualValidation = validateTicketForPlacement({ selections: order.selections, totalCost: order.totalCost });
        if (!manualValidation.valid) {
            alert(`Invalid manual bet formula: ${manualValidation.message}`);
            return;
        }

        const manualRaceValidation = validateTicketAgainstRaceState(order.selections, races);
        if (!manualRaceValidation.valid) {
            alert(`Manual bet blocked: ${manualRaceValidation.message}`);
            return;
        }
    
    const newTicket: Ticket = {
      id: Math.floor(10000000 + Math.random() * 90000000).toString(),
      timestamp: effectiveTime,
      vendorId: currentUser.id,
      vendorName: currentUser.name,
      status: 'Active',
      selections: order.selections,
      totalCost: order.totalCost
    };

    try {
        if (supabase) { await dbPlaceBet(newTicket, currentUser); } 
        else { setPlacedTickets(prev => [...prev, newTicket]); }
        if (supabase) {
            await dbMarkManualBetOrderCompleted(orderId);
            loadLiveSystemData(currentUser);
        } else {
            setManualBetOrders(prev => (prev || []).map(o => o.id === orderId ? { ...o, status: 'Completed' } : o));
        }
        setLastTicket(newTicket);
    } catch (e: any) { alert(`Transaction Failed: ${e.message}`); }
  };

  const payForBooking = async (code: string): Promise<{ success: boolean; message: string; ticket?: Ticket }> => {
      const normalizeBookingCode = (value: string) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normalizedCode = normalizeBookingCode(code);
      if (!normalizedCode || !currentUser) return { success: false, message: 'Not found' };
      const ticket = (placedTickets || []).find(t => normalizeBookingCode(t.bookingCode || '') === normalizedCode);

      if (supabase) {
          try {
              const success = await dbPayForBooking(normalizedCode, currentUser.id, currentUser.name, effectiveTime);
              const nextTickets = await dbFetchLiveTickets(currentUser);
              setPlacedTickets(nextTickets);
              const activatedTicket = (nextTickets || []).find(
                t => normalizeBookingCode(t.bookingCode || '') === normalizedCode && t.status === 'Active'
              );

              if (!success) {
                  if (activatedTicket) {
                      setLastTicket(activatedTicket);
                      return { success: true, message: 'Booking already paid. Ticket is active.', ticket: activatedTicket };
                  }
                  return { success: false, message: 'Booking not found or already processed.' };
              }

              if (activatedTicket) setLastTicket(activatedTicket);
              return { success: true, message: 'Booking activated successfully.', ticket: activatedTicket };
          } catch (e: any) {
              return { success: false, message: e.message || 'Failed to activate booking.' };
          }
      }

      if (!ticket) return { success: false, message: 'Not found' };
      if (ticket.status === 'Active') {
          return { success: true, message: 'Booking already paid. Ticket is active.', ticket };
      }
      if (ticket.status !== 'Booked') {
          return { success: false, message: `Booking cannot be paid while status is ${ticket.status}.` };
      }

      const updated = { ...ticket, status: 'Active' as const, vendorId: currentUser.id, vendorName: currentUser.name };
      setPlacedTickets(prev => (prev || []).map(t => t.id === ticket.id ? updated : t));
      setLastTicket(updated);
      return { success: true, message: 'Paid', ticket: updated };
  };

  const cancelTicket = async (ticketRef: string) => {
      if (!currentUser) return;
      const normalizedRef = (ticketRef || '').trim();
      if (!normalizedRef) {
          alert('Ticket serial number is required.');
          return;
      }

      const targetTicket = (placedTickets || []).find((ticket) =>
          ticket.id === normalizedRef || ticket.bookingCode?.toUpperCase() === normalizedRef.toUpperCase()
      );

      if (!targetTicket) {
          alert('Ticket not found. Check serial number and try again.');
          return;
      }

      if (!['Active', 'Booked'].includes(targetTicket.status)) {
          alert(`Ticket cannot be canceled while status is ${targetTicket.status}.`);
          return;
      }

      if (currentUser.role === 'Customer' && targetTicket.customerId !== currentUser.id) {
          alert('You can only cancel your own ticket.');
          return;
      }

      const reachedCancelLockWindow = targetTicket.selections.some((selection) => {
          const race = (races || []).find((item) => item.id === selection.raceId);
          if (!race) return false;
          const cancelDeadline = race.startDate.getTime() - BETTING_CUTOFF_MS;
          return effectiveTime.getTime() >= cancelDeadline;
      });
      if (reachedCancelLockWindow) {
          alert('Cannot cancel ticket now. Cancellation is only allowed more than 2 minutes before race start.');
          return;
      }

      if (!confirm(`Cancel ticket #${targetTicket.id}?`)) return;

      try {
          if (supabase) {
              const result = await dbCancelTicket(targetTicket.id, currentUser.id, currentUser.name, effectiveTime);
              if (!result.success) {
                  alert(result.message || 'Cancel failed.');
                  return;
              }
              await loadLiveSystemData(currentUser);
              if (result.refundedAmount > 0) {
                  alert(`Ticket canceled and ${result.refundedAmount.toFixed(2)} refunded to customer wallet.`);
              }
              return;
          }

          setPlacedTickets((prev) => (prev || []).map((ticket) => {
              if (ticket.id !== targetTicket.id) return ticket;
              return {
                  ...ticket,
                  status: 'Canceled',
                  canceledAt: effectiveTime,
                  canceledById: currentUser.id,
                  canceledByName: currentUser.name
              };
          }));
      } catch (e: any) {
          alert('Cancel failed: ' + (e.message || e));
      }
  };

  const processWithdrawal = async (code: string, payoutMethod: 'Cash' | 'Wave' = 'Cash', payoutReference?: string) => {
      const req = (withdrawalRequests || []).find(r => r.code === code && r.status === 'Pending');
      if (!req || !currentUser) return false;

      const safeReference = String(payoutReference || '').replace(/[\[\]]/g, '').trim();
      const processedByName = payoutMethod === 'Wave'
          ? `${currentUser.name} [Wave${safeReference ? ` Ref:${safeReference}` : ''}]`
          : currentUser.name;

      if (supabase) {
          try {
              const success = await dbProcessWithdrawalRequest(code, currentUser.id, processedByName, effectiveTime);
              if (success) loadLiveSystemData(currentUser);
              return success;
          } catch (e) {
              console.error("Process withdrawal failed", e);
              return false;
          }
      }

      const updated = { ...req, status: 'Completed' as const, completedAt: effectiveTime, processedBy: currentUser.id, processedByName };
      setWithdrawalRequests(prev => (prev || []).map(r => r.id === req.id ? updated : r));
      return true;
  };

  const handleLogin = (user: User) => {
      const normalizedUser = { ...user, role: normalizeRole(user.role) };
      setCurrentUser(normalizedUser);
      try { localStorage.setItem(ACTIVE_USER_ID_KEY, normalizedUser.id); } catch {}
      writeCachedActiveUser(normalizedUser);
      if (supabase) {
          loadLiveSystemData(normalizedUser);
      }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setPlacedTickets([]);
      try { localStorage.removeItem(ACTIVE_USER_ID_KEY); } catch {}
      clearCachedActiveUser();
  };

  const handleCancelWithdrawal = async (requestId: string) => {
      try {
          if (supabase) {
              await dbCancelWithdrawal(requestId);
          } else {
              setWithdrawalRequests(prev => (prev || []).map(r => r.id === requestId ? { ...r, status: 'Canceled' } : r));
          }
      } catch (e: any) {
          alert("Cancel failed: " + e.message);
      }
  };

  const handleWithdrawalRequest = async (amount: number): Promise<WithdrawalRequest | null> => {
      if (!currentUser) return null;

      const baseRequest = {
        customerId: currentUser.id,
        customerName: currentUser.name,
        amount,
        status: 'Pending' as const,
        requestedAt: effectiveTime
      };

      try {
          if (supabase) {
              // Retry a few times in case random 6-digit code hits unique constraint.
              let savedRequest: WithdrawalRequest | null = null;
              for (let attempt = 0; attempt < 5; attempt++) {
                  const candidate: WithdrawalRequest = {
                      id: Math.floor(10000000 + Math.random() * 90000000).toString(),
                      code: Math.floor(100000 + Math.random() * 900000).toString(),
                      ...baseRequest
                  };
                  try {
                      await dbCreateWithdrawalRequest(candidate);
                      savedRequest = candidate;
                      break;
                  } catch (inner: any) {
                      const raw = String(inner?.message || '').toLowerCase();
                      const isCodeCollision = raw.includes('duplicate key') || raw.includes('unique') || raw.includes('withdrawal_requests_code_key');
                      if (!isCodeCollision || attempt === 4) throw inner;
                  }
              }

              if (!savedRequest) {
                  throw new Error('Unable to generate a unique withdrawal code. Please try again.');
              }

              const normalizedPhone = normalizeGambiaPhone(currentUser.phone || '');
              if (normalizedPhone) {
                  const otpResult = await dbGenerateAndSendOTP(normalizedPhone, savedRequest.code);
                  if (!otpResult.success) {
                      alert(`Withdrawal created, but OTP SMS could not be sent automatically. Share code manually via WhatsApp. Reason: ${otpResult.message}`);
                  }
              } else {
                  alert('Withdrawal created. Add a valid phone number on your customer profile to receive OTP by SMS automatically.');
              }

              // Update local state immediately so customer sees code without needing refresh.
              setWithdrawalRequests(prev => [savedRequest!, ...(prev || [])]);
              return savedRequest;
          } else {
              const newRequest: WithdrawalRequest = {
                  id: Math.floor(10000000 + Math.random() * 90000000).toString(),
                  code: Math.floor(100000 + Math.random() * 900000).toString(),
                  ...baseRequest
              };
              setWithdrawalRequests(prev => [newRequest, ...(prev || [])]);
              return newRequest;
          }
      } catch (e: any) {
          alert("Withdrawal Failed: " + e.message);
          return null;
      }
  };

    const addUser = async (name: string, role: Role, phone?: string, password?: string, correctionPin?: string, otpCode?: string) => {
    // Backward compatibility: some stale mobile bundles may call onSignUp(name, phone, password)
    // instead of onSignUp(name, 'Customer', phone, password).
    let resolvedRole: Role = role;
    let resolvedPhone = phone;
    let resolvedPassword = password;
    const validRoles: Role[] = ['Admin', 'Supervisor', 'Vendor', 'Customer'];
    if (!validRoles.includes(role) && !currentUser) {
        const inferredPhone = normalizeGambiaPhone(String(role || ''));
        if (inferredPhone) {
            resolvedRole = 'Customer';
            resolvedPhone = inferredPhone;
            resolvedPassword = String(phone || '');
        }
    }

    // Allow public self-signup for Customer accounts; privileged roles still require logged-in Admin.
    if (!currentUser && resolvedRole !== 'Customer') {
        alert('You must be logged in to create users.');
        return null;
    }

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
        alert('Name is required.');
        return null;
    }

    if (resolvedRole === 'Admin') {
        if (!currentUser || currentUser.role !== 'Admin') {
            alert('Only Admin can create another Admin account.');
            return null;
        }

        const latestUsers = supabase
            ? await dbFetchUsers().catch(() => users)
            : users;
        const normalizedLatestUsers = (latestUsers || []).map(u => ({ ...u, role: normalizeRole(u.role) }));
        const adminUsers = normalizedLatestUsers.filter(u => u.role === 'Admin');

        if (adminUsers.length >= 3) {
            alert('Maximum Admin accounts reached (3). Remove or change an existing Admin before creating another.');
            return null;
        }

        const duplicateAdminName = adminUsers.some(u => String(u.name || '').trim().toLowerCase() === trimmedName.toLowerCase());
        if (duplicateAdminName) {
            alert('An Admin with this name already exists. Use a different Admin name.');
            return null;
        }
    }

    const normalizedPhone = resolvedRole === 'Customer' ? normalizeGambiaPhone(resolvedPhone || '') : undefined;
    if (resolvedRole === 'Customer' && !normalizedPhone) {
        alert('Customer phone must be valid: Gambia local 7 digits or +220XXXXXXX; Senegal must be +221XXXXXXXXX only.');
        return null;
    }

    // Enforce OTP verification on public customer self-signup.
    if (!currentUser && resolvedRole === 'Customer' && normalizedPhone) {
        const otpConfig = await dbFetchOTPConfig();
        if (!otpConfig?.isEnabled) {
            alert('OTP verification is not configured or disabled. Contact Admin.');
            return null;
        }

        if (!String(otpCode || '').trim()) {
            alert('Enter SMS verification code to complete registration.');
            return null;
        }

        const verify = await dbVerifyOTP(normalizedPhone, String(otpCode).trim());
        if (!verify.success || !verify.isValid) {
            alert(verify.message || 'Invalid OTP code.');
            return null;
        }
    }

    if (resolvedRole === 'Customer' && normalizedPhone) {
        const duplicate = (users || []).find(u =>
            u.role === 'Customer' && normalizeGambiaPhone(u.phone || '') === normalizedPhone
        );

        if (duplicate) {
            if (supabase && !duplicate.isLocked) {
                try {
                    await dbToggleUserLock(duplicate.id, true);
                } catch (e) {
                    console.error('Failed to lock duplicate phone account', e);
                }
            }
            setUsers(prev => (prev || []).map(u => u.id === duplicate.id ? { ...u, isLocked: true } : u));
            alert('Duplicate phone detected. Account creation blocked and duplicate account locked for review.');
            return null;
        }
    }

    const newUser: User = {
                        id: resolvedRole === 'Customer' ? (normalizedPhone || Math.floor(10000000 + Math.random() * 90000000).toString()) : (resolvedRole.toUpperCase().slice(0, 3) + '-' + trimmedName.toUpperCase()),
            name: trimmedName,
            role: resolvedRole,
      isLocked: false,
      phone: normalizedPhone,
            password: resolvedPassword || 'password',
        correctionPin: resolvedRole === 'Admin' ? (correctionPin || resolvedPassword || 'password') : undefined,
      walletBalance: 0,
      bonusBalance: 0,
            createdById: currentUser?.id,
            createdByName: currentUser?.name
    };
    
    try {
        if (supabase) {
            await dbAddUser(newUser);
        } else {
            setUsers(prev => [...prev, newUser]);
        }
    } catch (e: any) {
        alert("Failed to add user: " + e.message);
    }
    return newUser;
  };

  const handleToggleLock = async (userId: string) => {
      const targetUser = (users || []).find((user) => user.id === userId);
      if (!targetUser) {
          alert('User not found.');
          return;
      }
      if (targetUser.role === 'Admin') {
          alert('Admin account cannot be locked.');
          return;
      }

      const nextLocked = !targetUser.isLocked;
      try {
          if (supabase) {
              await dbToggleUserLock(userId, nextLocked);
              await loadLiveSystemData(currentUser || undefined);
          } else {
              setUsers((prev) => (prev || []).map((user) => user.id === userId ? { ...user, isLocked: nextLocked } : user));
          }
      } catch (e: any) {
          alert('Failed to update lock status: ' + (e.message || e));
      }
  };

  const handleAdminResetPassword = (userId: string, newPass: string): { success: boolean; message: string } => {
      const normalizedPassword = (newPass || '').trim();
      if (normalizedPassword.length < 6) {
          return { success: false, message: 'Password must be at least 6 characters.' };
      }

      const run = async () => {
          try {
              if (supabase) {
                  await dbAdminResetPassword(userId, normalizedPassword);
                  await loadLiveSystemData(currentUser || undefined);
              } else {
                  setUsers((prev) => (prev || []).map((user) => user.id === userId ? { ...user, password: normalizedPassword } : user));
              }
          } catch (e: any) {
              alert('Failed to reset password: ' + (e.message || e));
          }
      };

      void run();
      return { success: true, message: 'Password reset successfully.' };
  };

  const handleTogglePromotionStatus = async (promoId: string) => {
      const current = promotions.find(p => p.id === promoId);
      if (!current) return;
      const next = !current.isActive;
      if (supabase) {
          try {
              await dbTogglePromotionStatus(promoId, next);
          } catch (e: any) {
              alert("Failed to update promotion status: " + e.message);
              return;
          }
      }
      setPromotions(prev => prev.map(p => p.id === promoId ? { ...p, isActive: next } : p));
  };

  const handleUpdatePromotion = async (promoId: string, newName: string, newRules: PromotionRule[]) => {
      const trimmedName = (newName || '').trim();
      if (!trimmedName) {
          alert('Promotion name cannot be empty.');
          return;
      }

      const currentPromo = promotions.find(p => p.id === promoId);
      const normalizedRules = normalizePromotionRules(newRules);
      if (currentPromo?.type === 'first-deposit' && normalizedRules.length === 0) {
          alert('First-deposit promotion requires at least one valid bonus rule.');
          return;
      }

      if (supabase) {
          try {
              await dbUpdatePromotion(promoId, trimmedName, normalizedRules);
          } catch (e: any) {
              alert("Failed to update promotion: " + e.message);
              return;
          }
      }
      setPromotions(prev => prev.map(p => p.id === promoId ? { ...p, name: trimmedName, rules: normalizedRules } : p));
  };

  const handleMovePromotion = async (id: string, direction: 'up' | 'down') => {
      if (supabase) {
          try {
              await dbMovePromotion(id, direction);
              const refreshed = await dbFetchPromotions();
              setPromotions(refreshed);
              return;
          } catch (e: any) {
              alert("Failed to reorder promotion: " + e.message);
              return;
          }
      }

      setPromotions(prev => {
          const idx = prev.findIndex(p => p.id === id);
          if (idx < 0) return prev;
          const nextIndex = direction === 'up' ? idx - 1 : idx + 1;
          if (nextIndex < 0 || nextIndex >= prev.length) return prev;
          const copy = [...prev];
          [copy[idx], copy[nextIndex]] = [copy[nextIndex], copy[idx]];
          return copy;
      });
  };

  const handleCreatePromotion = async (name: string, type: 'first-deposit' | 'weekly' | 'special') => {
      const trimmedName = (name || '').trim();
      if (!trimmedName) {
          alert('Promotion name is required.');
          return;
      }
      const duplicateName = promotions.some(p => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (duplicateName) {
          alert('Promotion name already exists.');
          return;
      }
      if (type === 'first-deposit' && promotions.some(p => p.type === 'first-deposit')) {
          alert('Only one first-deposit promotion is allowed. Edit the existing one instead.');
          return;
      }

      const promo: Promotion = {
          id: `promo-${Date.now()}`,
          name: trimmedName,
          type,
          isActive: true,
          rules: []
      };

      if (supabase) {
          try {
              await dbCreatePromotion(promo, promotions.length + 1);
          } catch (e: any) {
              alert("Failed to create promotion: " + e.message);
              return;
          }
      }
      setPromotions(prev => [...prev, promo]);
  };

  const handleDeletePromotion = async (id: string) => {
      if (supabase) {
          try {
              await dbDeletePromotion(id);
          } catch (e: any) {
              alert("Failed to delete promotion: " + e.message);
              return;
          }
      }
      setPromotions(prev => prev.filter(p => p.id !== id));
  };

  const handleAddProgramImage = async (file: File, type: 'program' | 'advertisement', mediaType: 'image' | 'video') => {
      const image: ProgramImage = {
          id: `media-${Date.now()}`,
          type,
          url: '',
          mediaType
      };

      if (supabase) {
          try {
              const url = await dbUploadProgramFile(file);
              image.url = url;
              await dbAddProgramImage(image);
          } catch (e: any) {
              const rawMessage = String(e?.message || e || 'Unknown upload error');
              const missingServerEnv = rawMessage.toLowerCase().includes('missing supabase server environment variables');

              if (missingServerEnv) {
                  try {
                      // Emergency fallback: keep upload functional even when Netlify server env vars are not configured.
                      image.url = await fileToDataUrl(file);
                      await dbAddProgramImage(image);
                      setProgramImages(prev => [image, ...prev]);
                      alert('Media uploaded successfully.');
                      console.warn('Program media uploaded in emergency fallback mode. Configure Netlify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full storage mode.');
                      return;
                  } catch (fallbackErr: any) {
                      alert('Failed to upload media: server env missing and fallback failed. ' + String(fallbackErr?.message || fallbackErr));
                      return;
                  }
              }

              alert("Failed to upload media: " + rawMessage);
              return;
          }
      } else {
          // No DB: use a temporary object URL (won't survive page refresh)
          image.url = URL.createObjectURL(file);
      }
      setProgramImages(prev => [image, ...prev]);
  };

  const handleDeleteProgramImage = async (id: string) => {
      if (supabase) {
          try {
              await dbDeleteProgramImage(id);
          } catch (e: any) {
              alert("Failed to delete media: " + e.message);
              return;
          }
      }
      setProgramImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSavePaymentConfig = async (config: PaymentIntegrationConfig) => {
      if (supabase) {
          try {
              await dbSavePaymentConfig(config);
          } catch (e: any) {
              alert("Failed to save payment settings: " + e.message);
              return;
          }
      }
      setPaymentConfigs(prev => {
          const idx = prev.findIndex(c => c.provider === config.provider);
          if (idx < 0) return [...prev, config];
          const copy = [...prev];
          copy[idx] = config;
          return copy;
      });
  };

  const handleCreateManualBet = async (selectionData: Omit<BetSelection, 'cost' | 'raceName'>, multiplier: number, totalCost: number, assignedVendorId: string) => {
      if (!currentUser) return;
      const race = races.find(r => r.id === selectionData.raceId);
      const selection: BetSelection = {
          ...selectionData,
          raceName: race?.name || selectionData.raceId,
          multiplier,
          cost: totalCost / Math.max(1, multiplier)
      };
      const order: ManualBetOrder = {
          id: `mbo-${Date.now()}`,
          createdAt: effectiveTime,
          createdById: currentUser.id,
          createdByName: currentUser.name,
          assignedVendorId,
          selections: [selection],
          totalCost,
          status: 'Pending'
      };

      if (supabase) {
          try {
              await dbCreateManualBetOrder(order);
          } catch (e: any) {
              alert("Failed to create manual bet: " + e.message);
              return;
          }
      }
      setManualBetOrders(prev => [order, ...prev]);
  };

  const handleCancelManualBet = async (orderId: string) => {
      if (supabase) {
          try {
              await dbCancelManualBetOrder(orderId);
          } catch (e: any) {
              alert("Failed to cancel manual bet: " + e.message);
              return;
          }
      }
      setManualBetOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Canceled' } : o));
  };

  const handleSendMessage = async (threadId: string | 'new', content: string, recipients: string[], audioData?: { base64: string; duration: number }) => {
      if (!currentUser) return;
      try {
          if (supabase) {
              await dbSendChatMessage(threadId, currentUser, content, recipients, audioData);
              const [nextThreads, nextMessages] = await Promise.all([dbFetchChatThreads(), dbFetchChatMessages()]);
              setThreads(nextThreads);
              setMessages(nextMessages);
          }
      } catch (e: any) {
          alert("Failed to send message: " + e.message);
      }
  };

  const handleMarkThreadAsRead = async (threadId: string) => {
      if (!currentUser || !threadId) return;
      if (supabase) {
          try {
              await dbMarkThreadAsRead(threadId, currentUser.id);
          } catch (e) {
              console.error("Failed to mark messages as read", e);
          }
      }
      setMessages(prev => prev.map(m => {
          if (m.threadId !== threadId) return m;
          if (m.readByIds.includes(currentUser.id)) return m;
          return { ...m, readByIds: [...m.readByIds, currentUser.id] };
      }));
  };

  if (!currentUser) {
      if (!usersReady || sessionRestorePending) {
          return <LoadingPane />;
      }
      return (
          <Suspense fallback={<LoadingPane />}>
              <LoginScreen onLogin={handleLogin} users={users} onSignUp={addUser} />
          </Suspense>
      );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
          <EmergencyRecover onRecover={handleRefreshSystem} />
      </Suspense>
      <Header
        user={currentUser}
        onLogout={handleLogout}
        walletFlash={walletFlash}
        onWalletFlashComplete={() => setWalletFlash(false)}
        onOpenChat={() => setIsChatOpen(true)}
        onRefreshSystem={handleRefreshSystem}
        onOpenProgram={currentUser?.role === 'Customer' ? () => setIsProgramModalOpen(true) : undefined}
        messages={messages}
        threads={threads}
        pendingDepositCount={(depositRequests || []).filter(r => r.status === 'Pending').length}
      />
            <main className={`max-w-7xl mx-auto ${isSunmiLite ? 'px-3 sm:px-4 py-4' : 'px-4 sm:px-6 lg:px-8 py-6'}`} key={systemKey}>
                <Suspense fallback={<LoadingPane />}>
        {currentUser.role === 'Vendor' && (
          <BettingTerminal
            races={races}
            betSlip={betSlip}
            onUpdateBetSlip={updateBetSlip}
            onClearBetSlip={() => setBetSlip({ selections: [], totalCost: 0 })}
            onInitiatePlaceBet={placeBet}
            lastTicket={lastTicket}
            onCloseTicket={() => setLastTicket(null)}
            onRemoveSelection={(index) => setBetSlip(prev => { const s = prev.selections.filter((_, i) => i !== index); return { selections: s, totalCost: Number(s.reduce((sum, x) => sum + (x.cost * x.multiplier), 0).toFixed(2)) }; })}
            onUpdateSelectionMultiplier={(index, m) => setBetSlip(prev => { const s = [...prev.selections]; if(s[index]) s[index].multiplier = Math.max(1, m); return { selections: s, totalCost: Number(s.reduce((sum, x) => sum + (x.cost * x.multiplier), 0).toFixed(2)) }; })}
            placedTickets={placedTickets}
            allTickets={placedTickets}
            onCancelTicket={cancelTicket}
            customers={(users || []).filter(u => u.role === 'Customer')}
            onDeposit={handleDeposit}
            onPayForBooking={payForBooking}
            onProcessWithdrawal={processWithdrawal}
            depositLogs={depositLogs}
            onPayoutTicket={payoutTicket}
            messages={messages}
            threads={threads}
            onOpenChat={() => setIsChatOpen(true)}
            effectiveTime={effectiveTime}
            currentUser={currentUser}
            withdrawalRequests={withdrawalRequests}
            onReprintTicket={setTicketToReprint}
            depositRequests={depositRequests}
            onApproveDepositRequest={handleApproveDepositRequest}
            onRejectDepositRequest={handleRejectDepositRequest}
            manualBetOrders={manualBetOrders}
            onProcessManualBet={processManualBet}
            onSaveRaceResult={handleSaveRaceResult}
                        isBettingInProgress={isBettingInProgress}
          />
        )}
        {(currentUser.role === 'Admin' || currentUser.role === 'Supervisor') && (
            currentUser.role === 'Admin' ? (
                <AdminDashboard
                    tickets={placedTickets}
                    races={races}
                    onAddRace={handleAddRace}
                    onUpdateRace={handleUpdateRace}
                    onDeleteRace={handleDeleteRace}
                    onUpdateNonRunners={handleUpdateNonRunners}
                    onSaveRaceResult={handleSaveRaceResult}
                    users={users}
                    onToggleLock={handleToggleLock}
                    onLockAllVendors={() => {}}
                    onAddUser={addUser}
                    onDeposit={handleDeposit}
                    onAdminAdjustBalance={handleAdminBalanceAdjustment}
                    depositLogs={depositLogs}
                    allTickets={placedTickets}
                    onCancelTicket={cancelTicket}
                    programImages={programImages}
                    onAddProgramImage={handleAddProgramImage}
                    onDeleteProgramImage={handleDeleteProgramImage}
                    promotions={promotions}
                    onTogglePromotionStatus={handleTogglePromotionStatus}
                    onUpdatePromotion={handleUpdatePromotion}
                    onMovePromotion={handleMovePromotion}
                    onCreatePromotion={handleCreatePromotion}
                    onDeletePromotion={handleDeletePromotion}
                    onAdminResetPassword={handleAdminResetPassword}
                    effectiveTime={effectiveTime}
                    currentUser={currentUser}
                    onPayoutTicket={payoutTicket}
                    onReprintTicket={setTicketToReprint}
                    depositRequests={depositRequests}
                    onApproveDepositRequest={handleApproveDepositRequest}
                    onRejectDepositRequest={handleRejectDepositRequest}
                    paymentConfigs={paymentConfigs}
                    onSavePaymentConfig={handleSavePaymentConfig}
                    manualBetOrders={manualBetOrders}
                    onCreateManualBet={handleCreateManualBet}
                    onCancelManualBet={handleCancelManualBet}
                    onRecalculateAllTickets={handleRecalculateAllTickets}
                    onFreshStart={handleFreshStart}
                />
            ) : (
                <SupervisorDashboard
                    tickets={placedTickets}
                    users={users}
                    onToggleLock={handleToggleLock}
                    onAddUser={addUser}
                    onDeposit={handleDeposit}
                    races={races}
                    onSaveRaceResult={handleSaveRaceResult}
                    onUpdateNonRunners={handleUpdateNonRunners}
                    depositLogs={depositLogs}
                    onUpdateRace={handleUpdateRace}
                    onDeleteRace={handleDeleteRace}
                    allTickets={placedTickets}
                    onCancelTicket={cancelTicket}
                    programImages={programImages}
                    onAddProgramImage={handleAddProgramImage}
                    onDeleteProgramImage={handleDeleteProgramImage}
                    promotions={promotions}
                    onTogglePromotionStatus={handleTogglePromotionStatus}
                    onUpdatePromotion={handleUpdatePromotion}
                    onMovePromotion={handleMovePromotion}
                    onCreatePromotion={handleCreatePromotion}
                    onDeletePromotion={handleDeletePromotion}
                    onAdminResetPassword={handleAdminResetPassword}
                    effectiveTime={effectiveTime}
                    currentUser={currentUser}
                    onPayoutTicket={payoutTicket}
                    onReprintTicket={setTicketToReprint}
                    depositRequests={depositRequests}
                    onApproveDepositRequest={handleApproveDepositRequest}
                    onRejectDepositRequest={handleRejectDepositRequest}
                    manualBetOrders={manualBetOrders}
                    onCreateManualBet={handleCreateManualBet}
                    onCancelManualBet={handleCancelManualBet}
                />
            )
        )}
        {currentUser.role === 'Customer' && (
             <CustomerDashboard 
                user={currentUser}
                races={races}
                betSlip={betSlip}
                onUpdateBetSlip={updateBetSlip}
                onClearBetSlip={() => setBetSlip({ selections: [], totalCost: 0 })}
                onInitiatePlaceBet={placeBet}
                onInitiateBookBet={bookBet}
                lastTicket={lastTicket}
                onCloseTicket={() => setLastTicket(null)}
                onRemoveSelection={(idx) => setBetSlip(prev => { const s = prev.selections.filter((_, i) => i !== idx); return { selections: s, totalCost: Number(s.reduce((sum, x) => sum + (x.cost * x.multiplier), 0).toFixed(2)) }; })}
                onUpdateSelectionMultiplier={(idx, m) => setBetSlip(prev => { const s = [...prev.selections]; if(s[idx]) s[idx].multiplier = Math.max(1, m); return { selections: s, totalCost: Number(s.reduce((sum, x) => sum + (x.cost * x.multiplier), 0).toFixed(2)) }; })}
                placedTickets={placedTickets}
                onCancelTicket={cancelTicket}
                seenWinningTickets={seenWinningTickets}
                onMarkWinningTicketAsSeen={(id) => setSeenWinningTickets(prev => new Set(prev).add(id))}
                onWithdrawalRequest={handleWithdrawalRequest}
                withdrawalRequests={withdrawalRequests}
                onWalletFlash={() => setWalletFlash(true)}
                programImages={programImages}
                promotions={promotions}
                onChangePassword={() => ({ success: true, message: 'Mock' })}
                effectiveTime={effectiveTime}
                onDepositRequest={handleCreateDepositRequest}
                depositRequests={depositRequests}
                onCancelWithdrawal={handleCancelWithdrawal}
                     isBettingInProgress={isBettingInProgress}
                externalOpenProgram={isProgramModalOpen}
                onExternalProgramClose={() => setIsProgramModalOpen(false)}
             />
        )}
                </Suspense>
      </main>
            <Suspense fallback={null}>
                    {paidTicketModal && <TicketModal ticket={paidTicketModal} onClose={() => setPaidTicketModal(null)} showPrintButton={true} races={races} />}
                    {ticketToReprint && <TicketModal ticket={ticketToReprint} onClose={() => setTicketToReprint(null)} showPrintButton={true} races={races} />}
                    <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} currentUser={currentUser} users={users} threads={threads} messages={messages} onSendMessage={handleSendMessage} onMarkAsRead={handleMarkThreadAsRead} />
            </Suspense>
    </ErrorBoundary>
  );
};

const App: React.FC = () => <LanguageProvider><AppContent /></LanguageProvider>;
export default App;
