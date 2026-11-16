import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.ts';
import { RemoteDatabaseAdapter } from './pgAdapter.ts';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type AIRecommendationPayload,
  type BudgetRecord,
  type CategoryRecord,
  type CurrencyCode,
  type FinancialReportRecord,
  type NotificationRecord,
  type RecurringTransactionRecord,
  type SavingsContributionRecord,
  type SavingsGoalRecord,
  type ThemeMode,
  type TransactionRecord,
  type UserPublic,
} from '../shared/types.ts';

function demoUuid(group: number, index: number): string {
  const g = String(group).padStart(4, '0');
  const n = String(index).padStart(12, '0');
  return `00000000-${g}-4000-8000-${n}`;
}

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  currency: CurrencyCode;
  theme: ThemeMode;
  monthlyIncomeTarget: number;
  primaryGoal: string;
  budgetAlertsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  resetTokenHash?: string;
  resetTokenExpiresAt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  savingsGoals: SavingsGoalRecord[];
  savingsContributions: SavingsContributionRecord[];
  recurringTransactions: RecurringTransactionRecord[];
  notifications: NotificationRecord[];
  aiRecommendations: Array<AIRecommendationPayload & { userId: string }>;
  financialReports: FinancialReportRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'spendsense-db.json');

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftMonthDate(base: Date, monthOffset: number, dayOfMonth: number): string {
  const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(dayOfMonth, maxDay, monthOffset === 0 ? Math.max(1, base.getDate()) : maxDay);
  return formatDate(new Date(target.getFullYear(), target.getMonth(), clampedDay));
}

export function buildDefaultCategories(userId: string): CategoryRecord[] {
  const now = new Date().toISOString();
  const expenses: CategoryRecord[] = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(),
    userId,
    name,
    type: 'expense',
    isCustom: false,
    createdAt: now,
  }));
  const incomes: CategoryRecord[] = DEFAULT_INCOME_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(),
    userId,
    name,
    type: 'income',
    isCustom: false,
    createdAt: now,
  }));
  return [...expenses, ...incomes];
}

function createInitialSeedData(): DatabaseSchema {
  const now = new Date();
  const nowIso = now.toISOString();
  const demoUserId = demoUuid(1, 1);
  const currentMonth = formatMonth(now);

  const demoUser: StoredUser = {
    id: demoUserId,
    email: 'demo@spendsense.ai',
    passwordHash: hashPassword('Demo@1234'),
    fullName: 'Aarav Mehta',
    currency: 'INR',
    theme: 'light',
    monthlyIncomeTarget: 75000,
    primaryGoal: 'Build a 6-month emergency fund & upgrade laptop',
    budgetAlertsEnabled: true,
    weeklyDigestEnabled: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const categories = buildDefaultCategories(demoUserId);

  const txTemplates: Array<{
    monthOffset: number;
    day: number;
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    paymentMethod: string;
    description: string;
  }> = [
    // Month -3
    { monthOffset: -3, day: 1, title: 'Monthly Tech Salary', amount: 68000, type: 'income', category: 'Salary', paymentMethod: 'Bank Transfer', description: 'Primary monthly salary credit' },
    { monthOffset: -3, day: 3, title: 'Apartment Rent', amount: 16500, type: 'expense', category: 'Rent', paymentMethod: 'Bank Transfer', description: 'Monthly 1BHK apartment rent' },
    { monthOffset: -3, day: 5, title: 'FreshBasket Groceries', amount: 4800, type: 'expense', category: 'Groceries', paymentMethod: 'UPI', description: 'Monthly staples & produce' },
    { monthOffset: -3, day: 8, title: 'BESCOM Electricity Bill', amount: 1450, type: 'expense', category: 'Electricity', paymentMethod: 'UPI', description: 'Monthly power bill' },
    { monthOffset: -3, day: 10, title: 'Fiber Broadband Plan', amount: 999, type: 'expense', category: 'Internet', paymentMethod: 'UPI', description: '300 Mbps home fiber' },
    { monthOffset: -3, day: 14, title: 'Metro & Cab Commute', amount: 2350, type: 'expense', category: 'Transportation', paymentMethod: 'UPI', description: 'Office commute pass and rides' },
    { monthOffset: -3, day: 18, title: 'UI Consulting Milestone', amount: 9500, type: 'income', category: 'Freelancing', paymentMethod: 'Bank Transfer', description: 'Design audit freelance project' },
    { monthOffset: -3, day: 21, title: 'Dining & Coffee Shops', amount: 3900, type: 'expense', category: 'Food', paymentMethod: 'Credit Card', description: 'Team lunches and weekend cafes' },
    { monthOffset: -3, day: 25, title: 'Online Course Subscription', amount: 2400, type: 'expense', category: 'Education', paymentMethod: 'Debit Card', description: 'System architecture workshop' },
    { monthOffset: -3, day: 27, title: 'Apparel & Accessories', amount: 3600, type: 'expense', category: 'Shopping', paymentMethod: 'Credit Card', description: 'Workwear shirts and shoes' },

    // Month -2
    { monthOffset: -2, day: 1, title: 'Monthly Tech Salary', amount: 68000, type: 'income', category: 'Salary', paymentMethod: 'Bank Transfer', description: 'Primary monthly salary credit' },
    { monthOffset: -2, day: 3, title: 'Apartment Rent', amount: 16500, type: 'expense', category: 'Rent', paymentMethod: 'Bank Transfer', description: 'Monthly 1BHK apartment rent' },
    { monthOffset: -2, day: 6, title: 'SuperMart Groceries', amount: 5200, type: 'expense', category: 'Groceries', paymentMethod: 'UPI', description: 'Weekly groceries and dairy' },
    { monthOffset: -2, day: 8, title: 'BESCOM Electricity Bill', amount: 1620, type: 'expense', category: 'Electricity', paymentMethod: 'UPI', description: 'Monthly power bill' },
    { monthOffset: -2, day: 10, title: 'Fiber Broadband Plan', amount: 999, type: 'expense', category: 'Internet', paymentMethod: 'UPI', description: '300 Mbps home fiber' },
    { monthOffset: -2, day: 13, title: 'Dental & Pharmacy Visit', amount: 2100, type: 'expense', category: 'Healthcare', paymentMethod: 'Debit Card', description: 'Routine dental checkup' },
    { monthOffset: -2, day: 16, title: 'Metro & Fuel', amount: 2600, type: 'expense', category: 'Transportation', paymentMethod: 'UPI', description: 'Commute and weekend travel' },
    { monthOffset: -2, day: 19, title: 'Dining & Food Delivery', amount: 4650, type: 'expense', category: 'Food', paymentMethod: 'Credit Card', description: 'Weekday dinners and coffee' },
    { monthOffset: -2, day: 22, title: 'Weekend Hill Trip', amount: 4200, type: 'expense', category: 'Travel', paymentMethod: 'Credit Card', description: 'Short weekend getaway' },
    { monthOffset: -2, day: 26, title: 'Streaming & Cinema', amount: 1350, type: 'expense', category: 'Entertainment', paymentMethod: 'UPI', description: 'OTT plans & movie tickets' },

    // Month -1
    { monthOffset: -1, day: 1, title: 'Monthly Tech Salary', amount: 72000, type: 'income', category: 'Salary', paymentMethod: 'Bank Transfer', description: 'Revised monthly salary credit' },
    { monthOffset: -1, day: 3, title: 'Apartment Rent', amount: 16500, type: 'expense', category: 'Rent', paymentMethod: 'Bank Transfer', description: 'Monthly 1BHK apartment rent' },
    { monthOffset: -1, day: 5, title: 'Organic Groceries', amount: 5400, type: 'expense', category: 'Groceries', paymentMethod: 'UPI', description: 'Monthly groceries and fruits' },
    { monthOffset: -1, day: 8, title: 'BESCOM Electricity Bill', amount: 1580, type: 'expense', category: 'Electricity', paymentMethod: 'UPI', description: 'Monthly power bill' },
    { monthOffset: -1, day: 10, title: 'Fiber Broadband Plan', amount: 999, type: 'expense', category: 'Internet', paymentMethod: 'UPI', description: '300 Mbps home fiber' },
    { monthOffset: -1, day: 12, title: 'Product Advisory Retainer', amount: 8500, type: 'income', category: 'Freelancing', paymentMethod: 'Bank Transfer', description: 'SaaS analytics consultation' },
    { monthOffset: -1, day: 14, title: 'Commute & Rideshare', amount: 2450, type: 'expense', category: 'Transportation', paymentMethod: 'UPI', description: 'Daily metro and cab trips' },
    { monthOffset: -1, day: 17, title: 'Restaurants & Delivery', amount: 5100, type: 'expense', category: 'Food', paymentMethod: 'Credit Card', description: 'Lunch orders and social dinners' },
    { monthOffset: -1, day: 20, title: 'Electronics & Desk Gear', amount: 6400, type: 'expense', category: 'Shopping', paymentMethod: 'Credit Card', description: 'Ergonomic keyboard and lamp' },
    { monthOffset: -1, day: 24, title: 'Index Fund Dividend', amount: 1850, type: 'income', category: 'Investments', paymentMethod: 'Bank Transfer', description: 'Quarterly dividend payout' },
    { monthOffset: -1, day: 26, title: 'Personal Care & Fitness', amount: 1900, type: 'expense', category: 'Personal Care', paymentMethod: 'UPI', description: 'Gym renewal and grooming' },

    // Current Month (0)
    { monthOffset: 0, day: 1, title: 'Monthly Tech Salary', amount: 72000, type: 'income', category: 'Salary', paymentMethod: 'Bank Transfer', description: 'Primary monthly salary credit' },
    { monthOffset: 0, day: 2, title: 'Apartment Rent', amount: 16500, type: 'expense', category: 'Rent', paymentMethod: 'Bank Transfer', description: 'Monthly 1BHK apartment rent' },
    { monthOffset: 0, day: 3, title: 'FreshBasket Groceries', amount: 3450, type: 'expense', category: 'Groceries', paymentMethod: 'UPI', description: 'Bi-weekly grocery run' },
    { monthOffset: 0, day: 4, title: 'BESCOM Electricity Bill', amount: 1520, type: 'expense', category: 'Electricity', paymentMethod: 'UPI', description: 'Monthly power bill' },
    { monthOffset: 0, day: 5, title: 'Fiber Broadband Plan', amount: 999, type: 'expense', category: 'Internet', paymentMethod: 'UPI', description: '300 Mbps home fiber' },
    { monthOffset: 0, day: 6, title: 'Cafe & Lunch Orders', amount: 2850, type: 'expense', category: 'Food', paymentMethod: 'UPI', description: 'Workweek coffee & lunch' },
    { monthOffset: 0, day: 8, title: 'Metro Pass & Cabs', amount: 1850, type: 'expense', category: 'Transportation', paymentMethod: 'UPI', description: 'Office commute' },
    { monthOffset: 0, day: 10, title: 'Weekend Shopping Haul', amount: 4750, type: 'expense', category: 'Shopping', paymentMethod: 'Credit Card', description: 'Running shoes and home goods' },
    { monthOffset: 0, day: 11, title: 'UI Audit Freelance Bonus', amount: 6500, type: 'income', category: 'Freelancing', paymentMethod: 'Bank Transfer', description: 'Landing page UX review' },
    { monthOffset: 0, day: 12, title: 'Streaming & Book Club', amount: 1150, type: 'expense', category: 'Entertainment', paymentMethod: 'UPI', description: 'OTT subscriptions & books' },
    { monthOffset: 0, day: 14, title: 'Bistro Dinner with Friends', amount: 2450, type: 'expense', category: 'Food', paymentMethod: 'Credit Card', description: 'Weekend dinner' },
  ];

  const transactions: TransactionRecord[] = txTemplates.map((t, idx) => ({
    id: demoUuid(2, idx + 1),
    userId: demoUserId,
    title: t.title,
    amount: t.amount,
    type: t.type,
    category: t.category,
    date: shiftMonthDate(now, t.monthOffset, t.day),
    paymentMethod: t.paymentMethod,
    description: t.description,
    notes: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const budgets: BudgetRecord[] = [
    { id: demoUuid(3, 1), userId: demoUserId, month: currentMonth, category: 'Overall', limitAmount: 45000, createdAt: nowIso, updatedAt: nowIso },
    { id: demoUuid(3, 2), userId: demoUserId, month: currentMonth, category: 'Food', limitAmount: 6000, createdAt: nowIso, updatedAt: nowIso },
    { id: demoUuid(3, 3), userId: demoUserId, month: currentMonth, category: 'Groceries', limitAmount: 6000, createdAt: nowIso, updatedAt: nowIso },
    { id: demoUuid(3, 4), userId: demoUserId, month: currentMonth, category: 'Shopping', limitAmount: 5000, createdAt: nowIso, updatedAt: nowIso },
    { id: demoUuid(3, 5), userId: demoUserId, month: currentMonth, category: 'Transportation', limitAmount: 3000, createdAt: nowIso, updatedAt: nowIso },
    { id: demoUuid(3, 6), userId: demoUserId, month: currentMonth, category: 'Rent', limitAmount: 16500, createdAt: nowIso, updatedAt: nowIso },
  ];

  const sixMonthsOut = new Date(now.getFullYear(), now.getMonth() + 6, 15);
  const tenMonthsOut = new Date(now.getFullYear(), now.getMonth() + 10, 1);
  const fourMonthsOut = new Date(now.getFullYear(), now.getMonth() + 4, 20);

  const goal1Id = demoUuid(4, 1);
  const goal2Id = demoUuid(4, 2);
  const goal3Id = demoUuid(4, 3);

  const savingsGoals: SavingsGoalRecord[] = [
    {
      id: goal1Id,
      userId: demoUserId,
      name: 'Buy a Laptop',
      targetAmount: 85000,
      currentAmount: 42500,
      targetDate: formatDate(sixMonthsOut),
      monthlyContribution: 7500,
      category: 'Buy a laptop',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: goal2Id,
      userId: demoUserId,
      name: '6-Month Emergency Fund',
      targetAmount: 240000,
      currentAmount: 135000,
      targetDate: formatDate(tenMonthsOut),
      monthlyContribution: 12000,
      category: 'Emergency fund',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: goal3Id,
      userId: demoUserId,
      name: 'Himalayan Autumn Trip',
      targetAmount: 40000,
      currentAmount: 18000,
      targetDate: formatDate(fourMonthsOut),
      monthlyContribution: 5500,
      category: 'Travel',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const savingsContributions: SavingsContributionRecord[] = [
    {
      id: demoUuid(5, 1),
      goalId: goal1Id,
      userId: demoUserId,
      amount: 10000,
      contributedAt: shiftMonthDate(now, 0, 5),
      note: 'Monthly laptop transfer',
      createdAt: nowIso,
    },
    {
      id: demoUuid(5, 2),
      goalId: goal2Id,
      userId: demoUserId,
      amount: 15000,
      contributedAt: shiftMonthDate(now, 0, 2),
      note: 'Emergency reserve sweep',
      createdAt: nowIso,
    },
  ];

  const recurringTransactions: RecurringTransactionRecord[] = [
    {
      id: demoUuid(6, 1),
      userId: demoUserId,
      title: 'Monthly Tech Salary',
      amount: 72000,
      type: 'income',
      category: 'Salary',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      startDate: shiftMonthDate(now, -3, 1),
      endDate: '',
      lastGeneratedDate: shiftMonthDate(now, 0, 1),
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: demoUuid(6, 2),
      userId: demoUserId,
      title: 'Apartment Rent',
      amount: 16500,
      type: 'expense',
      category: 'Rent',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      startDate: shiftMonthDate(now, -3, 2),
      endDate: '',
      lastGeneratedDate: shiftMonthDate(now, 0, 2),
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: demoUuid(6, 3),
      userId: demoUserId,
      title: 'Fiber Broadband Plan',
      amount: 999,
      type: 'expense',
      category: 'Internet',
      paymentMethod: 'UPI',
      frequency: 'monthly',
      startDate: shiftMonthDate(now, -3, 5),
      endDate: '',
      lastGeneratedDate: shiftMonthDate(now, 0, 5),
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const notifications: NotificationRecord[] = [
    {
      id: demoUuid(7, 1),
      userId: demoUserId,
      kind: 'budget_warning',
      severity: 'warning',
      title: 'Shopping budget at 95%',
      message: 'You have spent ₹4,750 of your ₹5,000 Shopping budget for this month.',
      dedupeKey: `budget:${currentMonth}:Shopping:90`,
      isRead: false,
      createdAt: nowIso,
    },
    {
      id: demoUuid(7, 2),
      userId: demoUserId,
      kind: 'savings_milestone',
      severity: 'success',
      title: 'Goal milestone: 50% reached on Buy a Laptop',
      message: 'You have saved ₹42,500 toward your ₹85,000 target.',
      dedupeKey: `goal:${goal1Id}:50`,
      isRead: false,
      createdAt: nowIso,
    },
  ];

  return {
    users: [demoUser],
    categories,
    transactions,
    budgets,
    savingsGoals,
    savingsContributions,
    recurringTransactions,
    notifications,
    aiRecommendations: [],
    financialReports: [],
  };
}

class Store {
  private data: DatabaseSchema;
  private remote = new RemoteDatabaseAdapter();

  constructor() {
    this.data = this.load();
  }

  public async init(): Promise<void> {
    const remoteData = await this.remote.init(() => this.data);
    if (remoteData) {
      this.data = remoteData;
      this.writeFileAtomic(this.data);
    }
  }

  public getBackendMode(): string {
    return this.remote.getMode();
  }

  private load(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const seed = createInitialSeedData();
      this.writeFileAtomic(seed);
      return seed;
    }
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
      return {
        users: parsed.users ?? [],
        categories: parsed.categories ?? [],
        transactions: parsed.transactions ?? [],
        budgets: parsed.budgets ?? [],
        savingsGoals: parsed.savingsGoals ?? [],
        savingsContributions: parsed.savingsContributions ?? [],
        recurringTransactions: parsed.recurringTransactions ?? [],
        notifications: parsed.notifications ?? [],
        aiRecommendations: parsed.aiRecommendations ?? [],
        financialReports: parsed.financialReports ?? [],
      };
    } catch {
      const seed = createInitialSeedData();
      this.writeFileAtomic(seed);
      return seed;
    }
  }

  private writeFileAtomic(snapshot: DatabaseSchema): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public save(): void {
    this.writeFileAtomic(this.data);
    this.remote.enqueueSync(this.data);
  }

  public get db(): DatabaseSchema {
    return this.data;
  }
}

export const store = new Store();

export function toPublicUser(user: StoredUser): UserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    currency: user.currency,
    theme: user.theme,
    monthlyIncomeTarget: user.monthlyIncomeTarget,
    primaryGoal: user.primaryGoal,
    budgetAlertsEnabled: user.budgetAlertsEnabled,
    weeklyDigestEnabled: user.weeklyDigestEnabled,
    createdAt: user.createdAt,
  };
}
