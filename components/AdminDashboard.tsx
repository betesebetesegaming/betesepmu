
import React, { useState, useMemo } from 'react';
import { Ticket, Race, User, Role, RaceResult, DepositLog, Promotion, PromotionRule, DepositRequest, PaymentIntegrationConfig, ProgramImage, ManualBetOrder, BetSelection } from '../types';
import { RaceManagement } from './RaceManagement';
import { UserAccountManagement, RoleFilter } from './VendorManagement';
import { TicketDetailsTable } from './TicketDetailsTable';
import { CustomerDepositPanel } from './CustomerDepositPanel';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { CombinationSearch } from './CombinationSearch';
import { ProgramManagementPanel } from './ProgramManagementPanel';
import { PromotionManagementPanel } from './PromotionManagementPanel';
import { PayoutReportView } from './PayoutReportView';
import { RapportModal } from './RapportModal';
import { RaceResultsManagement } from './RaceResultsManagement';
import { TestPrintPanel } from './TestPrintPanel';
import { getEffectiveTicketStatus, triggerPrint } from '../utils';
import { RecentResultsPanel } from './RecentResultsPanel';
import { IntegrationSettingsPanel } from './IntegrationSettingsPanel';
import { SupportPanel } from './SupportPanel';
import { TicketCheckPanel } from './TicketCheckPanel';
import { BookingRetrievalPanel } from './BookingRetrievalPanel';
import { AutomaticRaffleDrawerPanel } from './AutomaticRaffleDrawerPanel';

type FilterRole = Role | 'All';
type AdminView = 'DASHBOARD' | 'ANALYTICS' | 'PROGRAM' | 'USERS' | 'EOD' | 'RACES' | 'REPORTS' | 'TICKETS' | 'PRINTING' | 'TICKET_PAYOUT' | 'INTEGRATIONS' | 'SUPPORT' | 'MANUAL_BETS' | 'RAFFLE_DRAW' | 'TICKET_INFORMATION';

export const TicketToolsView: React.FC<{
    allTickets: Ticket[];
    onCancelTicket: (ticketId: string) => void;
    races: Race[];
    onPayoutTicket: (ticketId: string) => void;
    effectiveTime: Date;
    currentUser: User;
    onReprintTicket: (ticket: Ticket) => void;
}> = ({ allTickets = [], onCancelTicket, races = [], onPayoutTicket, effectiveTime, onReprintTicket }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TicketCheckPanel allTickets={allTickets} onPayoutTicket={onPayoutTicket} onCancelTicket={onCancelTicket} onReprintTicket={onReprintTicket} />
                <BookingRetrievalPanel 
                    allTickets={allTickets} 
                    onPayForBooking={async () => ({ success: false, message: 'Payout only. Use Terminal for booking payment.' })}
                    onPrintBookingSlip={onReprintTicket} 
                    races={races} 
                    effectiveTime={effectiveTime} 
                />
            </div>
            <CombinationSearch allTickets={allTickets} races={races} onCancelTicket={onCancelTicket} effectiveTime={effectiveTime} />
        </div>
    );
};


interface AdminDashboardProps {
    tickets: Ticket[];
    races: Race[];
    onAddRace: (race: Race) => void;
    users: User[];
    onToggleLock: (userId: string) => void;
    onLockAllVendors: () => void;
    onAddUser: (name: string, role: Role, phone?: string, password?: string) => void;
    onDeposit: (customerId: string, amount: number, method: string) => { success: boolean; bonusApplied: number | null };
    onSaveRaceResult: (result: RaceResult) => void;
    onUpdateNonRunners: (raceId: string, nonRunners: number[]) => void;
    depositLogs: DepositLog[];
    onUpdateRace: (race: Race) => void;
    onDeleteRace: (race: Race) => void;
    allTickets: Ticket[];
    onCancelTicket: (ticketId: string) => void;
    programImages: ProgramImage[];
    onAddProgramImage: (file: File, type: 'program' | 'advertisement', mediaType: 'image' | 'video') => Promise<void>;
    onDeleteProgramImage: (id: string) => void;
    promotions: Promotion[];
    onTogglePromotionStatus: (promoId: string) => void;
    onUpdatePromotion: (promoId: string, newName: string, newRules: PromotionRule[]) => void;
    onMovePromotion: (id: string, direction: 'up' | 'down') => void;
    onCreatePromotion: (name: string, type: 'first-deposit' | 'weekly' | 'special') => void;
    onDeletePromotion: (id: string) => void;
    onAdminResetPassword: (userId: string, newPass: string) => { success: boolean, message: string };
    effectiveTime: Date;
    currentUser: User;
    onPayoutTicket: (ticketId: string) => void;
    onReprintTicket: (ticket: Ticket) => void;
    depositRequests: DepositRequest[];
    onApproveDepositRequest: (requestId: string) => void;
    onRejectDepositRequest: (requestId: string) => void;
    paymentConfigs: PaymentIntegrationConfig[];
    onSavePaymentConfig: (config: PaymentIntegrationConfig) => void;
    manualBetOrders: ManualBetOrder[];
    onCreateManualBet: (selectionData: Omit<BetSelection, 'cost' | 'raceName'>, multiplier: number, totalCost: number, assignedVendorId: string) => void;
    onCancelManualBet: (orderId: string) => void;
    onRecalculateAllTickets: () => Promise<void>;
}

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
    Back to Dashboard
  </button>
);

type AdminIconKind = 'analytics' | 'manual' | 'raffle' | 'program' | 'users' | 'races' | 'tools' | 'reports' | 'integrations' | 'support' | 'printing' | 'pmu';

const AdminMenuGraphic: React.FC<{ kind: AdminIconKind }> = ({ kind }) => {
    const photoMap: Record<AdminIconKind, { src: string; alt: string }> = {
        analytics: { src: 'https://images.unsplash.com/photo-1551281044-8b25b0b5c8ce?w=140&h=140&fit=crop&q=80', alt: 'analytics' },
        manual: { src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=140&h=140&fit=crop&q=80', alt: 'manual bets' },
        raffle: { src: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=140&h=140&fit=crop&q=80', alt: 'raffle' },
        program: { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=140&h=140&fit=crop&q=80', alt: 'program' },
        users: { src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=140&h=140&fit=crop&q=80', alt: 'users' },
        races: { src: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=140&h=140&fit=crop&q=80', alt: 'horse race' },
        tools: { src: 'https://images.unsplash.com/photo-1498079022511-d15614cb1c02?w=140&h=140&fit=crop&q=80', alt: 'tools' },
        reports: { src: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=140&h=140&fit=crop&q=80', alt: 'reports' },
        integrations: { src: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=140&h=140&fit=crop&q=80', alt: 'payment integration' },
        support: { src: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=140&h=140&fit=crop&q=80', alt: 'support' },
        printing: { src: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=140&h=140&fit=crop&q=80', alt: 'printing' },
        pmu: { src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=140&h=140&fit=crop&q=80', alt: 'pari mutuel' },
    };

    return (
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/40 shadow-lg ring-2 ring-white/25">
            <img src={photoMap[kind].src} alt={photoMap[kind].alt} className="w-full h-full object-cover" loading="lazy" />
        </div>
    );
};

const AdminMenu: React.FC<{ setView: (view: AdminView) => void; }> = ({ setView }) => {
    const menuItems = [
        { view: 'TICKET_INFORMATION', label: 'Terminal Log / Ticket Information', iconKind: 'reports' as AdminIconKind, color: 'from-lime-600 to-green-700' },
        { view: 'ANALYTICS', label: 'Analytics Dashboard', iconKind: 'analytics' as AdminIconKind, color: 'from-green-500 to-green-700' },
        { view: 'RAFFLE_DRAW', label: 'Automatic Raffle Draw', iconKind: 'raffle' as AdminIconKind, color: 'from-amber-500 to-orange-700' },
        { view: 'PROGRAM', label: 'Program & Ads', iconKind: 'program' as AdminIconKind, color: 'from-blue-500 to-blue-700' },
        { view: 'USERS', label: 'User Accounts', iconKind: 'users' as AdminIconKind, color: 'from-purple-500 to-purple-700' },
        { view: 'RACES', label: 'Race Management', iconKind: 'races' as AdminIconKind, color: 'from-orange-500 to-orange-700' },
        { view: 'TICKET_PAYOUT', label: 'Office Payouts', iconKind: 'tools' as AdminIconKind, color: 'from-cyan-500 to-blue-500' },
        { view: 'REPORTS', label: 'Payout Reports', iconKind: 'reports' as AdminIconKind, color: 'from-yellow-500 to-yellow-600' },
        { view: 'INTEGRATIONS', label: 'Payment API', iconKind: 'integrations' as AdminIconKind, color: 'from-yellow-600 to-orange-600' },
        { view: 'SUPPORT', label: 'Support & Snapshot', iconKind: 'support' as AdminIconKind, color: 'from-red-600 to-red-800' },
        { view: 'PRINTING', label: 'Test Print', iconKind: 'printing' as AdminIconKind, color: 'from-slate-500 to-slate-700' },
    ];
    return (
        <div>
            <h2 className="text-3xl font-bold text-betese-dark mb-6 text-center">Admin Control Panel</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {menuItems.map(item => (
                    <button key={item.view} onClick={() => setView(item.view as AdminView)} className={`p-6 rounded-lg shadow-lg text-white font-bold text-left flex flex-col justify-between h-40 transition-all transform hover:-translate-y-1 bg-gradient-to-br ${item.color}`}>
                        <AdminMenuGraphic kind={item.iconKind} />
                        <h3 className="text-2xl">{item.label}</h3>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
    // Defensive destructuring
    const { 
        users = [], onToggleLock, onLockAllVendors, onAddUser, onDeposit, depositLogs = [], races = [], onAddRace,
        onUpdateRace, onDeleteRace, allTickets = [], onCancelTicket, programImages = [], onAddProgramImage,
        onDeleteProgramImage, promotions = [], onTogglePromotionStatus, onUpdatePromotion, onAdminResetPassword,
        effectiveTime, currentUser, onPayoutTicket, onSaveRaceResult, onReprintTicket,
        onMovePromotion, onCreatePromotion, onDeletePromotion, paymentConfigs = [], onSavePaymentConfig,
        manualBetOrders = [], onCreateManualBet, onCancelManualBet, depositRequests = []
    } = props;
    
    const [view, setView] = useState<AdminView>('DASHBOARD');
    const [selectedRole, setSelectedRole] = useState<FilterRole>('All');
    const [rapportModalRace, setRapportModalRace] = useState<Race | null>(null);

    const adminSales = (allTickets || []).reduce((sum, t) => sum + (t?.totalCost || 0), 0);
    const adminPayouts = (allTickets || []).filter(t => t?.status === 'Paid').reduce((sum, t) => sum + (t?.winnings || 0), 0);
    const adminNet = adminSales - adminPayouts;
    const handlePrintAdminReport = () => triggerPrint('printable-admin-ticket-information');

    const renderCurrentView = () => {
        switch (view) {
            case 'ANALYTICS': return <div className="space-y-6"><AnalyticsDashboard tickets={allTickets} races={races} /><PromotionManagementPanel promotions={promotions} onToggleStatus={onTogglePromotionStatus} onUpdatePromotion={onUpdatePromotion} onMovePromotion={onMovePromotion} onCreatePromotion={onCreatePromotion} onDeletePromotion={onDeletePromotion} /></div>;
            case 'RAFFLE_DRAW': return <AutomaticRaffleDrawerPanel users={users} tickets={allTickets} effectiveTime={effectiveTime} />;
            case 'PROGRAM': return <div className="space-y-6"><ProgramManagementPanel programImages={programImages} onUpload={onAddProgramImage} onDelete={onDeleteProgramImage} /><CombinationSearch allTickets={allTickets} races={races} onCancelTicket={onCancelTicket} effectiveTime={effectiveTime} /></div>;
            case 'USERS': return <div className="flex flex-col md:flex-row gap-6"><RoleFilter selectedRole={selectedRole} onSelectRole={setSelectedRole} /><div className="flex-1 space-y-6"><UserAccountManagement users={selectedRole === 'All' ? users : users.filter(u => u.role === selectedRole)} onToggleLock={onToggleLock} onAddUser={onAddUser} onAdminResetPassword={onAdminResetPassword} creatableRoles={['Supervisor', 'Vendor', 'Customer']} /><CustomerDepositPanel customers={users.filter(u => u.role === 'Customer')} onDeposit={onDeposit} depositLogs={depositLogs} depositRequests={depositRequests} onApproveDepositRequest={props.onApproveDepositRequest} onRejectDepositRequest={props.onRejectDepositRequest} currentUserRole={currentUser.role} /></div></div>;
            case 'RACES': return <div className="space-y-6"><RaceManagement races={races} onAddRace={onAddRace} onUpdateNonRunners={props.onUpdateNonRunners} onUpdateRace={onUpdateRace} onDeleteRace={onDeleteRace} effectiveTime={effectiveTime} /><RaceResultsManagement races={races} tickets={allTickets} onSave={onSaveRaceResult} effectiveTime={effectiveTime} /></div>;
            case 'REPORTS': return <PayoutReportView races={races} onPrintRequest={setRapportModalRace} effectiveTime={effectiveTime} />;
            case 'TICKET_PAYOUT': return <TicketToolsView allTickets={allTickets} onCancelTicket={onCancelTicket} races={races} onPayoutTicket={onPayoutTicket} effectiveTime={effectiveTime} currentUser={currentUser} onReprintTicket={onReprintTicket} />;
            case 'TICKET_INFORMATION':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-yellow-500">
                            <div className="mb-6">
                                <h3 className="text-2xl font-black uppercase text-gray-800">Terminal Log</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Gross Sales</span><span className="block text-2xl font-black text-betese-green">GMD {adminSales.toFixed(0)}</span></div>
                                <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Paid Out</span><span className="block text-2xl font-black text-blue-600">GMD {adminPayouts.toFixed(0)}</span></div>
                                <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Vol.</span><span className="block text-2xl font-black text-gray-800">{allTickets.length}</span></div>
                                <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Net Profit</span><span className="block text-2xl font-black text-orange-600">GMD {adminNet.toFixed(0)}</span></div>
                            </div>
                            <TicketDetailsTable
                                title="Full Transaction History"
                                tickets={allTickets}
                                races={races}
                                onCancelTicket={onCancelTicket}
                                onPayoutTicket={onPayoutTicket}
                            />
                        </div>
                    </div>
                );
            case 'INTEGRATIONS': return <IntegrationSettingsPanel configs={paymentConfigs} onSave={onSavePaymentConfig} />;
            case 'SUPPORT': return <SupportPanel onRecalculateAllTickets={props.onRecalculateAllTickets} />;
            case 'PRINTING': return <TestPrintPanel />;
            case 'DASHBOARD':
            default:
                return (
                    <div className="space-y-6">
                        <div className="bg-lime-50 border-l-8 border-lime-600 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow">
                            <div>
                                <h3 className="text-lg font-black text-lime-800 uppercase">Quick Access</h3>
                                <p className="text-sm text-lime-700">Open Terminal Log / Ticket Information from here.</p>
                            </div>
                            <button
                                onClick={() => setView('TICKET_INFORMATION')}
                                className="px-5 py-3 bg-lime-700 text-white font-black rounded-lg hover:bg-lime-800 transition-all"
                            >
                                Open Ticket Information
                            </button>
                        </div>
                        <RecentResultsPanel races={races} effectiveTime={effectiveTime} />
                        <AdminMenu setView={setView} />
                    </div>
                );
        }
    };
    
    return (
        <div className="space-y-6">
            {rapportModalRace && <RapportModal race={rapportModalRace} onClose={() => setRapportModalRace(null)} showPrintButton={true} />}
            {view !== 'DASHBOARD' && <BackButton onClick={() => setView('DASHBOARD')} />}
            {renderCurrentView()}

            <div
                id="printable-admin-ticket-information"
                className="absolute top-0 left-[-5000px] pointer-events-none"
                style={{ visibility: 'hidden' }}
                aria-hidden="true"
            >
                <div className="c b text-lg border-b-2 border-black text-center pb-1 uppercase">BETESE ADMIN TICKET INFORMATION</div>
                <div className="flex b text-[10px] my-2 justify-between">
                    <span>ADMIN: {currentUser.name}</span>
                    <span>{effectiveTime.toLocaleDateString()}</span>
                </div>
                <div className="solid"></div>
                <div className="flex justify-between py-1 b"><span>TOTAL TICKETS:</span><span>{allTickets.length}</span></div>
                <div className="flex justify-between py-1 b"><span>GROSS SALES:</span><span>GMD {adminSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>TOTAL PAID:</span><span>GMD {adminPayouts.toFixed(0)}</span></div>
                <div className="solid"></div>
                <div className="flex b my-2 justify-between items-center">
                    <span style={{fontSize:'12px'}}>NET REVENUE:</span>
                    <span className="huge">GMD {adminNet.toFixed(0)}</span>
                </div>
                <div className="solid"></div>
                <p className="c b text-[9px] mt-4 uppercase">Official Admin Report</p>
                <p className="c text-[8px] opacity-70 italic">Generated: {effectiveTime.toLocaleString()}</p>
            </div>
        </div>
    );
};
