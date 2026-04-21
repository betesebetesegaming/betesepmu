
import { BetTypeOption, Race, BetPricing, User, ChatThread, ChatMessage, Promotion } from './types';

export const BET_PRICING: Record<BetTypeOption, BetPricing> = {
  [BetTypeOption.SimpleGagnant]: { minHorses: 1, perHorsePrice: 25, priceMap: {} },
  [BetTypeOption.SimplePlace]: { minHorses: 1, perHorsePrice: 25, priceMap: {} },
  [BetTypeOption.CoupleGagnant]: {
    minHorses: 2,
    basePrice: 30,
    priceMap: { 2: 30, 3: 90, 4: 180, 5: 300, 6: 450, 7: 630, 8: 840, 9: 1080, 10: 1350, 11: 1650, 12: 1980, 13: 2340, 14: 2730, 15: 3150, 16: 3600 },
    xPriceMap: { 1: { 1: 450 } },
  },
  [BetTypeOption.CouplePlace]: {
    minHorses: 2,
    basePrice: 30,
    priceMap: { 2: 30, 3: 90, 4: 180, 5: 300, 6: 450, 7: 630, 8: 840, 9: 1080, 10: 1350, 11: 1650, 12: 1980, 13: 2340, 14: 2730, 15: 3150, 16: 3600 },
    xPriceMap: { 1: { 1: 450 } },
  },
  [BetTypeOption.Tierce]: {
    minHorses: 3,
    basePrice: 15,
    priceMap: { 3: 15, 4: 60, 5: 150, 6: 300, 7: 525, 8: 840, 9: 1260, 10: 1800, 11: 2475, 12: 3300, 13: 4290, 14: 5460, 15: 6825, 16: 8400 },
    xPriceMap: { 1: { 2: 210 }, 2: { 1: 3150 } },
  },
  [BetTypeOption.Quarte]: {
    minHorses: 4,
    basePrice: 25,
    priceMap: { 4: 25, 5: 125, 6: 375, 7: 875, 8: 1750, 9: 3150, 10: 5250, 11: 8250, 12: 12375, 13: 17875, 14: 25025, 15: 34125, 16: 45500 },
    xPriceMap: { 1: { 3: 260 }, 2: { 2: 3640 }, 3: { 1: 54600 } },
  },
  [BetTypeOption.Quinte]: {
    minHorses: 5,
    basePrice: 25,
    priceMap: { 5: 25, 6: 150, 7: 525, 8: 1400, 9: 3150, 10: 6300, 11: 11550, 12: 19800, 13: 32175, 14: 50050, 15: 75075, 16: 109200 },
    xPriceMap: { 1: { 4: 250 }, 2: { 3: 2750 }, 3: { 2: 33000 }, 4: { 1: 429000 } },
  },
  [BetTypeOption.Multi4]: {
    minHorses: 4,
    basePrice: 40,
    priceMap: { 4: 40, 5: 200, 6: 600, 7: 1400, 8: 2800, 9: 5040, 10: 8400, 11: 13200, 12: 19800, 13: 28600, 14: 40040, 15: 54600, 16: 72800 },
  },
  [BetTypeOption.Multi5]: {
    minHorses: 5,
    basePrice: 40,
    priceMap: { 5: 40, 6: 240, 7: 840, 8: 2240, 9: 5040, 10: 10080, 11: 18480, 12: 31680, 13: 51480, 14: 80080, 15: 120120, 16: 174720 },
  },
  [BetTypeOption.Multi6]: {
    minHorses: 6,
    basePrice: 40,
    priceMap: { 6: 40, 7: 280, 8: 1120, 9: 3360, 10: 8400, 11: 18480, 12: 36960, 13: 68640, 14: 120120, 15: 200200, 16: 320320 },
  },
  [BetTypeOption.Multi7]: {
    minHorses: 7,
    basePrice: 40,
    priceMap: { 7: 40, 8: 320, 9: 1440, 10: 4800, 11: 13200, 12: 31680, 13: 68640, 14: 137280, 15: 257400, 16: 457600 },
  },
};

// Races will now be added manually via the UI for testing purposes.
export const MOCK_RACES: Race[] = [];

export const MOCK_USERS: User[] = [
    { id: 'ADMIN-001', name: 'admin', role: 'Admin', isLocked: false, password: 'password' },
    { id: 'SUPER-001', name: 'supervisor', role: 'Supervisor', isLocked: false, password: 'password', createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'VEND-JOHN', name: 'john', role: 'Vendor', isLocked: false, password: 'password', createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'VEND-JANE', name: 'jane', role: 'Vendor', isLocked: true, password: 'password', createdById: 'SUPER-001', createdByName: 'supervisor' },
    { id: 'VEND-NEW', name: 'vendor', role: 'Vendor', isLocked: false, password: 'password', createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'VEND-VENDOR2', name: 'vendor2', role: 'Vendor', isLocked: false, password: 'password', createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'CUST-001', name: 'Lamin', role: 'Customer', isLocked: false, phone: '111111', password: 'password', walletBalance: 1500, bonusBalance: 200, createdById: 'VEND-JOHN', createdByName: 'john' },
    { id: 'CUST-002', name: 'Aisha', role: 'Customer', isLocked: false, phone: '222222', password: 'password', walletBalance: 250, bonusBalance: 0, createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'CUST-USER', name: 'user', role: 'Customer', isLocked: false, phone: '123456', password: 'password', walletBalance: 1000, bonusBalance: 100, createdById: 'ADMIN-001', createdByName: 'admin' },
    { id: 'CUST-NEW-CUSTOMER', name: 'customer', role: 'Customer', isLocked: false, phone: '333333', password: 'password123', walletBalance: 500, bonusBalance: 0, createdById: 'ADMIN-001', createdByName: 'admin' },
];

export const MOCK_PROMOTIONS: Promotion[] = [
    {
        id: 'promo-first-deposit',
        name: 'First Deposit Welcome Bonus',
        type: 'first-deposit',
        isActive: true,
        rules: [
            { depositAmount: 200, bonusAmount: 50 },
            { depositAmount: 300, bonusAmount: 100 },
            { depositAmount: 500, bonusAmount: 200 },
        ],
    },
    {
        id: 'promo-monday',
        name: 'Monday Bonanza',
        type: 'weekly',
        isActive: true,
        rules: [],
    },
    {
        id: 'promo-friday',
        name: 'Happy Friday',
        type: 'weekly',
        isActive: true,
        rules: [],
    }
];

export const MOCK_CHAT_THREADS: ChatThread[] = [
  {
    id: 'broadcast-1',
    participantIds: ['ADMIN-001', 'ALL_VENDORS'],
    name: 'Broadcast to All Vendors',
    isBroadcast: true,
    lastMessageTimestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 10)),
  },
  {
    id: 'thread-vend-john',
    participantIds: ['VEND-JOHN', 'BACK_OFFICE'],
    lastMessageTimestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 5)),
  },
  {
    id: 'thread-vend-jane',
    participantIds: ['SUPER-001', 'VEND-JANE'],
    lastMessageTimestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 29)),
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    threadId: 'broadcast-1',
    senderId: 'ADMIN-001',
    senderName: 'admin',
    content: 'Good morning everyone. Please remember to lock your terminals at the end of the day. Sales reports are due by 6 PM.',
    timestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 10)),
    readByIds: ['ADMIN-001'],
  },
  {
    id: 'msg-2',
    threadId: 'thread-vend-john',
    senderId: 'VEND-JOHN',
    senderName: 'john',
    content: 'Hello, I have a question about a payout for ticket #12345678.',
    timestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 5)),
    readByIds: ['VEND-JOHN'],
  },
  {
    id: 'msg-3',
    threadId: 'thread-vend-jane',
    senderId: 'SUPER-001',
    senderName: 'supervisor',
    content: 'Jane, your account is currently locked. Can you please give me a call?',
    timestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 30)),
    readByIds: ['SUPER-001', 'VEND-JANE'],
  },
   {
    id: 'msg-4',
    threadId: 'thread-vend-jane',
    senderId: 'VEND-JANE',
    senderName: 'jane',
    content: 'Okay, calling you now.',
    timestamp: new Date(new Date().setMinutes(new Date().getMinutes() - 29)),
    readByIds: ['SUPER-001', 'VEND-JANE'],
  },
];