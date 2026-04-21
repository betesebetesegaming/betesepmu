
import React, { useState, useMemo } from 'react';
import { Ticket, User, Role, Race, RaceResult, DepositLog, Promotion, PromotionRule, DepositRequest, ProgramImage, ManualBetOrder, BetSelection } from '../types';
import { UserAccountManagement, RoleFilter } from './VendorManagement';
import { CustomerDepositPanel } from './CustomerDepositPanel';
import { RaceManagement } from './RaceManagement';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { TicketDetailsTable } from './TicketDetailsTable';
import { ProgramManagementPanel } from './ProgramManagementPanel';
import { PromotionManagementPanel } from './PromotionManagementPanel';
import { PayoutReportView } from './PayoutReportView';
import { RapportModal } from './RapportModal';
import { RaceResultsManagement } from './RaceResultsManagement';
import { RecentResultsPanel } from './RecentResultsPanel';
import { ManualBetCreationPanel } from './ManualBetCreationPanel';
import { getEffectiveTicketStatus } from '../utils';
import { TicketToolsView } from './AdminDashboard';

type FilterRole = Role | 'All';
type SupervisorView = 'DASHBOARD' | 'USERS' | 'RACES' | 'REPORTS' | 'PROGRAM' | 'TICKET_PAYOUT' | 'MANUAL_BETS';

interface SupervisorDashboardProps {
    tickets: Ticket[];
    users: User[];
    onToggleLock: (userId: string) => void;
    onAddUser: (name: string, role: Role, phone?: string, password?: string) => void;
    onDeposit: (customerId: string, amount: number) => { success: boolean; bonusApplied: number | null };
    races: Race[];
    onSaveRaceResult: (result: RaceResult) => void;
    onUpdateNonRunners: (raceId: string, nonRunners: number[]) => void;
    depositLogs: DepositLog[];
    onUpdateRace: (race: Race) => void;
    onDeleteRace: (race: Race) => void;
    allTickets: Ticket[];
    onCancelTicket: (ticketId: string) => void;
    programImages: ProgramImage[];
    onAddProgramImage: (imageDataUrl: string, type: 'program' | 'advertisement') => void;
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
    manualBetOrders: ManualBetOrder[];
    onCreateManualBet: (selectionData: Omit<BetSelection, 'cost' | 'raceName'>, multiplier: number, totalCost: number, assignedVendorId: string) => void;
    onCancelManualBet: (orderId: string) => void;
}

const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-4 focus:outline-none transition-all ${
            isActive
                ? 'border-betese-green text-betese-green'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
        }`}
    >
        {label}
    </button>
);

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = (props) => {
    // Defensive destructuring
    const { 
        users = [], 
        races = [], 
        onToggleLock, 
        onAddUser, 
        onDeposit, 
        depositLogs = [], 
        onUpdateRace, 
        onDeleteRace, 
        allTickets = [], 
        onCancelTicket, 
        programImages = [], 
        onAddProgramImage, 
        onDeleteProgramImage, 
        promotions = [], 
        onTogglePromotionStatus, 
        onUpdatePromotion, 
        onAdminResetPassword, 
        effectiveTime, 
        currentUser, 
        onPayoutTicket, 
        onSaveRaceResult, 
        onReprintTicket,
        onMovePromotion, 
        onCreatePromotion, 
        onDeletePromotion,
        manualBetOrders = [],
        onCreateManualBet,
        onCancelManualBet,
        depositRequests = []
    } = props;

    const [view, setView] = useState<SupervisorView>('DASHBOARD');
    const [selectedVendorId, setSelectedVendorId] = useState<string>('All');
    const [rapportModalRace, setRapportModalRace] = useState<Race | null>(null);

    const filteredUsers = users.filter(user => user.role === 'Vendor' || user.role === 'Customer');
    const vendors = useMemo(() => users.filter(user => user.role === 'Vendor'), [users]);

    const filteredTickets = useMemo(() => {
        if (selectedVendorId === 'All') return allTickets;
        return allTickets.filter(t => t.vendorId === selectedVendorId);
    }, [allTickets, selectedVendorId]);

    const renderCurrentView = () => {
        switch (view) {
            case 'USERS':
                return (
                    <div className="space-y-6">
                        <UserAccountManagement 
                            users={filteredUsers} 
                            onToggleLock={onToggleLock} 
                            onAdminResetPassword={onAdminResetPassword}
                            onAddUser={onAddUser}
                            creatableRoles={['Vendor', 'Customer']}
                        />
                        <CustomerDepositPanel 
                            customers={users.filter(u => u.role === 'Customer')} 
                            onDeposit={onDeposit} 
                            depositLogs={depositLogs}
                            depositRequests={depositRequests}
                            onApproveDepositRequest={props.onApproveDepositRequest}
                            onRejectDepositRequest={props.onRejectDepositRequest}
                            currentUserRole={currentUser.role}
                        />
                    </div>
                );
            case 'RACES':
                 return (
                    <div className="space-y-6">
                        <RaceManagement 
                            races={races}
                            onAddRace={() => alert("Race creation is admin-only.")}
                            onUpdateNonRunners={props.onUpdateNonRunners}
                            onUpdateRace={onUpdateRace}
                            onDeleteRace={onDeleteRace}
                            effectiveTime={effectiveTime}
                        />
                        <RaceResultsManagement 
                            races={races}
                            tickets={allTickets}
                            effectiveTime={effectiveTime}
                            canEdit={false}
                        />
                    </div>
                );
            case 'MANUAL_BETS':
                return <ManualBetCreationPanel races={races} users={users} manualBetOrders={manualBetOrders} onCreateManualBet={onCreateManualBet} onCancelManualBet={onCancelManualBet} effectiveTime={effectiveTime} />;
            case 'REPORTS':
                return (
                    <div className="space-y-6">
                        <PayoutReportView races={races} onPrintRequest={setRapportModalRace} effectiveTime={effectiveTime} />
                        <TicketDetailsTable title="All Tickets" tickets={filteredTickets} races={races} />
                    </div>
                );
            case 'TICKET_PAYOUT':
                return <TicketToolsView allTickets={allTickets} onCancelTicket={onCancelTicket} races={races} onPayoutTicket={onPayoutTicket} effectiveTime={effectiveTime} currentUser={currentUser} onReprintTicket={onReprintTicket} />;
             case 'PROGRAM':
                return (
                    <div className="space-y-6">
                        <ProgramManagementPanel
                            programImages={programImages}
                            onUpload={onAddProgramImage}
                            onDelete={onDeleteProgramImage}
                        />
                        <PromotionManagementPanel 
                            promotions={promotions}
                            onToggleStatus={onTogglePromotionStatus}
                            onUpdatePromotion={onUpdatePromotion}
                            onMovePromotion={onMovePromotion}
                            onCreatePromotion={onCreatePromotion}
                            onDeletePromotion={onDeletePromotion}
                        />
                    </div>
                );
            case 'DASHBOARD':
            default:
                return (
                     <div className="space-y-6">
                        <RecentResultsPanel races={races} effectiveTime={effectiveTime} />
                        <AnalyticsDashboard tickets={filteredTickets} races={races} />
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6">
            {rapportModalRace && <RapportModal race={rapportModalRace} onClose={() => setRapportModalRace(null)} showPrintButton={true} />}
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-betese-dark">Supervisor Dashboard</h1>
                <div className="flex items-center gap-2">
                    <label htmlFor="vendor-filter" className="font-semibold text-sm sm:text-base">Filter by Vendor:</label>
                    <select
                        id="vendor-filter"
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                        className="p-2 border rounded-md bg-white shadow-sm"
                    >
                        <option value="All">All Vendors</option>
                        {vendors.map(vendor => (
                            <option value={vendor.id}>{vendor.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <TabButton label="Dashboard" isActive={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} />
                    <TabButton label="Manual Bets" isActive={view === 'MANUAL_BETS'} onClick={() => setView('MANUAL_BETS')} />
                    <TabButton label="User Management" isActive={view === 'USERS'} onClick={() => setView('USERS')} />
                    <TabButton label="Race Management" isActive={view === 'RACES'} onClick={() => setView('RACES')} />
                    <TabButton label="Program & Promotions" isActive={view === 'PROGRAM'} onClick={() => setView('PROGRAM')} />
                    <TabButton label="Reports & Tickets" isActive={view === 'REPORTS'} onClick={() => setView('REPORTS')} />
                    <TabButton label="Ticket Payout" isActive={view === 'TICKET_PAYOUT'} onClick={() => setView('TICKET_PAYOUT')} />
                </nav>
            </div>

            <div className="mt-6">
                {renderCurrentView()}
            </div>
        </div>
    );
};
