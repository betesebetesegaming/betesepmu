
// FIX: Removed unnecessary self-import of BetSlip which caused a naming conflict.
export enum BetTypeOption {
  SimpleGagnant = "Simple Gagnant",
  SimplePlace = "Simple Placé",
  CoupleGagnant = "Couplé Gagnant",
  CouplePlace = "Couplé Placé",
  Tierce = "Tiercé",
  Quarte = "Quarté+",
  Quinte = "Quinté+",
  Multi4 = "Multi 4",
  Multi5 = "Multi 5",
  Multi6 = "Multi 6",
  Multi7 = "Multi 7",
}

export interface Payouts {
  ordreGagnant?: number;
  desordreGagnant?: number;
  coupleA?: number;
  coupleB?: number;
  coupleC?: number;
  tierceOrdre?: number;
  tierceDesordre?: number;
  quarteOrdre?: number;
  quarteDesordre?: number;
  quarteBonus3?: number;
  quinteOrdre?: number;
  quinteDesordre?: number;
  quinteBonus4?: number;
  quinteBonus3?: number;
  simpleGagnant?: number;
  simplePlaceA?: number;
  simplePlaceB?: number;
  simplePlaceC?: number;
  multi4?: number;
  multi5?: number;
  multi6?: number;
  multi7?: number;
}

export interface RaceResult {
  raceId: string;
  winningNumbers: number[];
  payouts: Payouts;
  // Optional secondary result for brackets/ties (Separate Report 1)
  bracketWinningNumbers?: number[];
  bracketPayouts?: Payouts;
  // Optional tertiary result for complex ties (Separate Report 2)
  bracket2WinningNumbers?: number[];
  bracket2Payouts?: Payouts;
  // Security audit trail
  enteredById?: string;
  enteredByName?: string;
  enteredAt?: Date;
  lastEditedById?: string;
  lastEditedByName?: string;
  lastEditedAt?: Date;
}


export interface Race {
  id: string;
  raceCode?: string;
  name: string;
  venue?: string;
  startDate: Date;
  endDate: Date;
  horseCount: number;
  nonRunners: number[];
  result?: RaceResult;
  disabledBetTypes?: BetTypeOption[];
  jackpot?: number; // Added Jackpot field
  updatedById?: string;
  updatedByName?: string;
  updatedAt?: Date;
}

export interface BetSelection {
  raceId: string;
  raceName: string;
  betType: BetTypeOption;
  numbers: number[];
  xCount: number;
  cost: number; // This is the base cost for one unit
  multiplier: number; // Individual multiplier for this selection
  pattern?: string[]; // Stores the ordered sequence, e.g., ["10", "X", "9"]
  fundingSource?: 'cash' | 'bonus' | 'mixed';
  bonusStakeAmount?: number;
  cashStakeAmount?: number;
}

export interface BetSlip {
  selections: BetSelection[];
  totalCost: number;
}

export interface WinningsBreakdown {
  selectionIndex: number;
  status: 'Win' | 'Loss' | 'Pending';
  // Win-specific details
  winType?: string;
  winningCombinations?: number;
  winningCombinationList?: number[][];
  payoutPerCombination?: number;  // The rapport value entered by admin
  basePrice?: number;             // Base price per unit (e.g. 25 GMD for Simple Gagnant)
  multiplier?: number;            // How many times the bet was played
  totalPayout?: number;
  source?: 'Primary' | 'Bracket 1' | 'Bracket 2';
}


export interface Ticket extends BetSlip {
  id: string;
  timestamp: Date;
  vendorId: string;
  vendorName: string;
  transactionChannel?: 'Online' | 'Terminal';
  status: 'Active' | 'Winning' | 'Lost' | 'Canceled' | 'Booked' | 'Paid';
  customerId?: string; // For online customers
  bookingCode?: string;
  winnings?: number;
  winningsBreakdown?: WinningsBreakdown[];
  canceledAt?: Date;
  canceledById?: string;
  canceledByName?: string;

  paidAt?: Date;
  paidById?: string;
  paidByName?: string;
}

export type PriceMap = { [key: number]: number };

export interface BetPricing {
  minHorses: number;
  basePrice?: number;
  priceMap: PriceMap;
  xPriceMap?: { [xCount: number]: { [numberCount: number]: number } };
  perHorsePrice?: number;
}

export type Role = 'Admin' | 'Supervisor' | 'Vendor' | 'Customer';

export interface User {
  id: string;
  name: string;
  role: Role;
  isLocked: boolean;
  phone?: string;
  password?: string;
  correctionPin?: string;
  walletBalance?: number;
  bonusBalance?: number;
  totalDepositedAmount?: number;
  firstDepositAt?: Date;
  createdById?: string;
  createdByName?: string;
}

export interface WithdrawalRequest {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: 'Pending' | 'Completed' | 'Canceled';
  requestedAt: Date;
  completedAt?: Date;
  processedBy?: string; // Vendor/Admin/Supervisor ID
  processedByName?: string;
}

export interface DepositRequest {
    id: string;
    customerId: string;
    customerName: string;
    amount: number;
    method: 'Wave' | 'AfriMoney';
    transactionId: string; // Storing Phone Number here
    status: 'Pending' | 'Approved' | 'Rejected';
    timestamp: Date;
    processedBy?: string;
    processedByName?: string; // Added to track the name of the staff who processed it
    processedAt?: Date;
}

export interface DepositLog {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string; // Added phone number for tracking
  amount: number;
  bonusAwarded?: number;
  bonusAdjustment?: number;
  processedById: string;
  processedByName: string;
  timestamp: Date;
  method: 'Cash' | 'Wave' | 'AfriMoney' | 'Correction'; // Added Correction
  transactionId?: string;
  note?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  readByIds: string[];
  contentType?: 'text' | 'audio';
  audioBase64?: string;
  audioDuration?: number; // in seconds
}

export interface ChatThread {
  id: string;
  participantIds: string[]; // Can include user IDs or 'ALL_VENDORS', 'BACK_OFFICE'
  name?: string; // For broadcast threads
  isBroadcast?: boolean;
  lastMessageTimestamp?: Date;
}

export interface PromotionRule {
    depositAmount: number;
    bonusAmount: number;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'first-deposit' | 'weekly' | 'special'; // Extensible for future promo types
  isActive: boolean;
  rules: PromotionRule[];
}

export interface ManualBetOrder {
  id: string;
  createdAt: Date;
  createdById: string;
  createdByName: string;
  assignedVendorId: string;
  selections: BetSelection[];
  totalCost: number;
  status: 'Pending' | 'Completed' | 'Canceled';
}

export interface PaymentIntegrationConfig {
    provider: 'Wave' | 'AfriMoney';
    isEnabled: boolean;
  environment: 'sandbox' | 'production';
    apiKey: string; 
    apiSecret: string; 
  signatureSecret: string;
    merchantId: string; 
  shortCode: string;
  merchantMsisdn: string;
  merchantDisplayName: string;
  currency: string;
  baseUrl: string;
    webhookUrl: string; 
  webhookSecret: string;
  callbackAuthToken: string;
  requestTimeoutMs: number;
}

// MOVED HERE from App.tsx to prevent circular dependency
export interface ProgramImage {
  id: string;
  type: 'program' | 'advertisement';
  url: string;
  mediaType: 'image' | 'video';
}
