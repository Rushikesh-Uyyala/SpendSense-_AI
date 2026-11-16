export type TransactionType = 'expense' | 'income';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';
export type ThemeMode = 'light' | 'dark';
export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Transportation',
  'Shopping',
  'Education',
  'Entertainment',
  'Healthcare',
  'Rent',
  'Electricity',
  'Internet',
  'Travel',
  'Personal Care',
  'Other',
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Freelancing',
  'Business',
  'Part-time work',
  'Scholarship',
  'Investments',
  'Other income',
] as const;

export const PAYMENT_METHODS = [
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Cash',
  'Net Banking',
  'Wallet',
] as const;

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string; locale: string }> = {
  INR: { symbol: '₹', label: 'Indian Rupee (INR)', locale: 'en-IN' },
  USD: { symbol: '$', label: 'US Dollar (USD)', locale: 'en-US' },
  EUR: { symbol: '€', label: 'Euro (EUR)', locale: 'de-DE' },
  GBP: { symbol: '£', label: 'British Pound (GBP)', locale: 'en-GB' },
};

export interface UserPublic {
  id: string;
  email: string;
  fullName: string;
  currency: CurrencyCode;
  theme: ThemeMode;
  monthlyIncomeTarget: number;
  primaryGoal: string;
  budgetAlertsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  isCustom: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  description: string;
  notes: string;
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRecord {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  category: string; // 'Overall' or category name
  limitAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetUtilizationItem {
  id: string;
  category: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPct: number;
  alertLevel: 'ok' | '50' | '75' | '90' | 'exceeded';
}

export interface SavingsGoalRecord {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  monthlyContribution: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoalEnriched extends SavingsGoalRecord {
  remainingAmount: number;
  progressPct: number;
  monthsRemaining: number;
  suggestedMonthlySavings: number;
  onTrack: boolean;
}

export interface SavingsContributionRecord {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  contributedAt: string;
  note: string;
  createdAt: string;
}

export interface RecurringTransactionRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string;
  lastGeneratedDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  dedupeKey: string;
  isRead: boolean;
  createdAt: string;
}

export interface AIRecommendationPayload {
  id: string;
  month: string;
  generatedAt: string;
  headline: string;
  recommendations: Array<{
    title: string;
    category: string;
    potentialMonthlySavings: number;
    explanation: string;
    calculationBasis: string;
  }>;
  behaviorAnalysis: {
    highestSpendingCategory: string;
    highestCategoryAmount: number;
    monthOverMonthChangePct: number | null;
    repeatedMerchantsOrTitles: string[];
    unusualSpikes: string[];
    summary: string;
  };
  disclaimer: string;
}

export interface FinancialReportRecord {
  id: string;
  userId: string;
  month: string;
  title: string;
  sections: {
    incomeSummary: string;
    expenseSummary: string;
    savingsSummary: string;
    spendingAnalysis: string;
    budgetPerformance: string;
    financialMistakes: string[];
    recommendations: string[];
    nextMonthSuggestedBudget: Array<{ category: string; suggestedLimit: number; reason: string }>;
  };
  disclaimer: string;
  createdAt: string;
}

export interface DashboardSummary {
  month: string;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRatePct: number;
  totalSavingsBalance: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  overallBudgetLimit: number;
  budgetUsagePct: number;
  financialHealth: {
    status: 'Strong' | 'Balanced' | 'Needs Attention' | 'Insufficient Data';
    summary: string;
    savingsRatePct: number;
    budgetAdherenceLabel: string;
    topExpenseCategory: string;
    topExpenseSharePct: number;
  };
  monthlySeries: Array<{
    month: string;
    label: string;
    income: number;
    expenses: number;
    savings: number;
  }>;
  expenseByCategory: Array<{
    category: string;
    amount: number;
    sharePct: number;
  }>;
  weeklySpending: Array<{
    label: string;
    amount: number;
  }>;
  budgetProgress: BudgetUtilizationItem[];
  recentTransactions: TransactionRecord[];
  unreadNotificationCount: number;
}

export interface ForecastSummary {
  hasEnoughData: boolean;
  monthsAnalyzed: number;
  methodology: string;
  assumptions: string[];
  limitations: string[];
  expectedNextMonthExpenses: number;
  expectedExpenseRange: { low: number; high: number };
  expectedNextMonthIncome: number;
  expectedNextMonthSavings: number;
  recommendedMonthlyBudget: number;
  historicalMonthlySeries: Array<{
    month: string;
    label: string;
    income: number;
    expenses: number;
  }>;
  categoryForecasts: Array<{
    category: string;
    lastMonthAmount: number;
    historicalAvg: number;
    projectedNextMonth: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
}

export interface AnalyticsSummary {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePct: number;
  transactionCount: number;
  previousPeriodExpenses: number;
  expenseChangePct: number | null;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
    sharePct: number;
  }>;
  incomeSourceBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
    sharePct: number;
  }>;
  dailyOrWeeklyTrend: Array<{
    label: string;
    income: number;
    expenses: number;
  }>;
  budgetPerformance: BudgetUtilizationItem[];
}
