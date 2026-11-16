import crypto from 'node:crypto';
import { store } from './store.ts';
import {
  CURRENCY_META,
  type AnalyticsSummary,
  type BudgetUtilizationItem,
  type CurrencyCode,
  type DashboardSummary,
  type ForecastSummary,
  type NotificationRecord,
  type RecurringFrequency,
  type SavingsGoalEnriched,
  type SavingsGoalRecord,
  type TransactionRecord,
} from '../shared/types.ts';

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const date = new Date(y, m, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getRecentMonthKeys(count: number, endMonthKey: string): string[] {
  const [yStr, mStr] = endMonthKey.split('-');
  const base = new Date(Number(yStr), Number(mStr) - 1, 1);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function formatMoneyServer(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCY_META[currency] || CURRENCY_META.INR;
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function addNotificationIfNew(
  userId: string,
  payload: Omit<NotificationRecord, 'id' | 'userId' | 'isRead' | 'createdAt'>
): void {
  const exists = store.db.notifications.some(
    (n) => n.userId === userId && n.dedupeKey === payload.dedupeKey
  );
  if (exists) return;
  store.db.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...payload,
  });
}

export function computeBudgetUtilization(userId: string, month: string): BudgetUtilizationItem[] {
  const userBudgets = store.db.budgets.filter((b) => b.userId === userId && b.month === month);
  const monthExpenses = store.db.transactions.filter(
    (t) => t.userId === userId && t.type === 'expense' && t.date.startsWith(month)
  );
  const totalMonthExpenses = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  return userBudgets
    .map((b) => {
      const spent =
        b.category === 'Overall'
          ? totalMonthExpenses
          : monthExpenses
              .filter((t) => t.category.toLowerCase() === b.category.toLowerCase())
              .reduce((sum, t) => sum + t.amount, 0);
      const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 1000) / 10 : 0;
      let alertLevel: BudgetUtilizationItem['alertLevel'] = 'ok';
      if (pct >= 100) alertLevel = 'exceeded';
      else if (pct >= 90) alertLevel = '90';
      else if (pct >= 75) alertLevel = '75';
      else if (pct >= 50) alertLevel = '50';

      return {
        id: b.id,
        category: b.category,
        limitAmount: b.limitAmount,
        spentAmount: Math.round(spent * 100) / 100,
        remainingAmount: Math.round((b.limitAmount - spent) * 100) / 100,
        utilizationPct: pct,
        alertLevel,
      };
    })
    .sort((a, b) => {
      if (a.category === 'Overall') return -1;
      if (b.category === 'Overall') return 1;
      return b.utilizationPct - a.utilizationPct;
    });
}

export function evaluateBudgetNotifications(userId: string, month: string): void {
  const user = store.db.users.find((u) => u.id === userId);
  if (!user || !user.budgetAlertsEnabled) return;

  const items = computeBudgetUtilization(userId, month);
  for (const item of items) {
    if (item.limitAmount <= 0) continue;
    const pct = item.utilizationPct;
    const label = item.category === 'Overall' ? 'Overall monthly budget' : `${item.category} budget`;

    if (pct >= 100) {
      addNotificationIfNew(userId, {
        kind: 'budget_exceeded',
        severity: 'danger',
        title: `${label} exceeded (${pct.toFixed(0)}%)`,
        message: `You have spent ${formatMoneyServer(item.spentAmount, user.currency)} against a limit of ${formatMoneyServer(item.limitAmount, user.currency)} in ${month}.`,
        dedupeKey: `budget:${month}:${item.category}:100`,
      });
    } else if (pct >= 90) {
      addNotificationIfNew(userId, {
        kind: 'budget_warning',
        severity: 'danger',
        title: `${label} at ${pct.toFixed(0)}%`,
        message: `Only ${formatMoneyServer(item.remainingAmount, user.currency)} remaining in your ${label.toLowerCase()} for ${month}.`,
        dedupeKey: `budget:${month}:${item.category}:90`,
      });
    } else if (pct >= 75) {
      addNotificationIfNew(userId, {
        kind: 'budget_warning',
        severity: 'warning',
        title: `${label} reached 75%`,
        message: `You have consumed ${pct.toFixed(0)}% (${formatMoneyServer(item.spentAmount, user.currency)}) of your ${month} limit.`,
        dedupeKey: `budget:${month}:${item.category}:75`,
      });
    } else if (pct >= 50) {
      addNotificationIfNew(userId, {
        kind: 'budget_info',
        severity: 'info',
        title: `${label} reached 50%`,
        message: `Halfway through your ${label.toLowerCase()} (${formatMoneyServer(item.spentAmount, user.currency)} of ${formatMoneyServer(item.limitAmount, user.currency)}).`,
        dedupeKey: `budget:${month}:${item.category}:50`,
      });
    }
  }
  store.save();
}

export function evaluateSavingsMilestoneNotifications(userId: string, goal: SavingsGoalRecord): void {
  const user = store.db.users.find((u) => u.id === userId);
  if (!user) return;
  const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  if (pct >= 100) {
    addNotificationIfNew(userId, {
      kind: 'savings_milestone',
      severity: 'success',
      title: `Goal completed: ${goal.name}`,
      message: `You reached 100% of your ${formatMoneyServer(goal.targetAmount, user.currency)} target for ${goal.name}.`,
      dedupeKey: `goal:${goal.id}:100`,
    });
  } else if (pct >= 50) {
    addNotificationIfNew(userId, {
      kind: 'savings_milestone',
      severity: 'success',
      title: `Goal milestone: 50% reached on ${goal.name}`,
      message: `You have saved ${formatMoneyServer(goal.currentAmount, user.currency)} toward your ${formatMoneyServer(goal.targetAmount, user.currency)} goal.`,
      dedupeKey: `goal:${goal.id}:50`,
    });
  }
}

export function enrichSavingsGoal(goal: SavingsGoalRecord): SavingsGoalEnriched {
  const remainingAmount = Math.max(0, Math.round((goal.targetAmount - goal.currentAmount) * 100) / 100);
  const progressPct = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 1000) / 10)
    : 0;

  const today = new Date();
  const target = new Date(`${goal.targetDate}T00:00:00`);
  const diffDays = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30.4375));
  const suggestedMonthlySavings = remainingAmount > 0 ? Math.ceil(remainingAmount / monthsRemaining) : 0;
  const onTrack = remainingAmount === 0 || goal.monthlyContribution >= suggestedMonthlySavings;

  return {
    ...goal,
    remainingAmount,
    progressPct,
    monthsRemaining,
    suggestedMonthlySavings,
    onTrack,
  };
}

function advanceDateStr(dateStr: string, frequency: RecurringFrequency): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (frequency === 'daily') {
    dt.setDate(dt.getDate() + 1);
  } else if (frequency === 'weekly') {
    dt.setDate(dt.getDate() + 7);
  } else if (frequency === 'monthly') {
    const nextMonth = dt.getMonth() + 1;
    const targetYear = dt.getFullYear() + Math.floor(nextMonth / 12);
    const targetMonth = nextMonth % 12;
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(d, maxDay)).padStart(2, '0')}`;
  } else if (frequency === 'yearly') {
    dt.setFullYear(dt.getFullYear() + 1);
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function processDueRecurringForUser(userId: string): number {
  const today = getTodayDateStr();
  let createdCount = 0;

  const userRecurrings = store.db.recurringTransactions.filter(
    (r) => r.userId === userId && r.isActive
  );

  for (const rec of userRecurrings) {
    let nextDate = rec.lastGeneratedDate
      ? advanceDateStr(rec.lastGeneratedDate, rec.frequency)
      : rec.startDate;

    let guard = 0;
    while (nextDate <= today && (!rec.endDate || nextDate <= rec.endDate) && guard < 24) {
      guard += 1;
      const alreadyExists = store.db.transactions.some(
        (t) => t.userId === userId && t.recurringId === rec.id && t.date === nextDate
      );
      if (!alreadyExists) {
        const nowIso = new Date().toISOString();
        store.db.transactions.push({
          id: crypto.randomUUID(),
          userId,
          title: rec.title,
          amount: rec.amount,
          type: rec.type,
          category: rec.category,
          date: nextDate,
          paymentMethod: rec.paymentMethod,
          description: `Scheduled ${rec.frequency} recurring ${rec.type}`,
          notes: 'Auto-recorded by recurring schedule',
          recurringId: rec.id,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        createdCount += 1;
      }
      rec.lastGeneratedDate = nextDate;
      rec.updatedAt = new Date().toISOString();
      nextDate = advanceDateStr(nextDate, rec.frequency);
    }
  }

  if (createdCount > 0) {
    store.save();
    evaluateBudgetNotifications(userId, getCurrentMonthKey());
  }
  return createdCount;
}

export function processAllDueRecurring(): void {
  const userIds = Array.from(new Set(store.db.recurringTransactions.map((r) => r.userId)));
  for (const uid of userIds) {
    processDueRecurringForUser(uid);
  }
}

export function getDashboardSummary(userId: string, monthKey?: string): DashboardSummary {
  processDueRecurringForUser(userId);
  const month = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : getCurrentMonthKey();

  const allTx = store.db.transactions.filter((t) => t.userId === userId);
  const totalAllIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalAllExpenses = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = Math.round((totalAllIncome - totalAllExpenses) * 100) / 100;

  const monthTx = allTx.filter((t) => t.date.startsWith(month));
  const monthlyIncome = Math.round(monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const monthlyExpenses = Math.round(monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const monthlySavings = Math.round((monthlyIncome - monthlyExpenses) * 100) / 100;
  const savingsRatePct = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 1000) / 10 : 0;

  const budgetProgress = computeBudgetUtilization(userId, month);
  const overallBudget = budgetProgress.find((b) => b.category === 'Overall');
  const overallBudgetLimit = overallBudget?.limitAmount ?? 0;
  const budgetUsagePct = overallBudget && overallBudget.limitAmount > 0
    ? overallBudget.utilizationPct
    : 0;

  const expenseMap = new Map<string, number>();
  for (const t of monthTx) {
    if (t.type !== 'expense') continue;
    expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + t.amount);
  }
  const expenseByCategory = Array.from(expenseMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      sharePct: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCat = expenseByCategory[0];
  let healthStatus: DashboardSummary['financialHealth']['status'] = 'Insufficient Data';
  let healthSummary = 'Add income and expense records for this month to generate your financial health overview.';
  if (monthlyIncome > 0 || monthlyExpenses > 0) {
    if (savingsRatePct >= 25 && (overallBudgetLimit === 0 || budgetUsagePct <= 90)) {
      healthStatus = 'Strong';
      healthSummary = `You are retaining ${savingsRatePct}% of monthly income with controlled budget utilization.`;
    } else if (savingsRatePct >= 10 && (overallBudgetLimit === 0 || budgetUsagePct <= 100)) {
      healthStatus = 'Balanced';
      healthSummary = `Positive net savings (${savingsRatePct}% rate). Trimming your top category (${topCat?.category || 'expenses'}) can widen your buffer.`;
    } else {
      healthStatus = 'Needs Attention';
      healthSummary = monthlyExpenses > monthlyIncome
        ? 'Monthly expenses currently exceed recorded income. Review discretionary categories and active budgets.'
        : `Low savings margin (${savingsRatePct}%) or elevated budget consumption (${budgetUsagePct}%).`;
    }
  }

  const budgetAdherenceLabel = overallBudgetLimit === 0
    ? 'No overall limit set'
    : budgetUsagePct > 100
      ? `Exceeded (${budgetUsagePct}%)`
      : `${budgetUsagePct}% consumed`;

  const monthKeys = getRecentMonthKeys(6, month);
  const monthlySeries = monthKeys.map((mk) => {
    const mTx = allTx.filter((t) => t.date.startsWith(mk));
    const inc = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return {
      month: mk,
      label: getMonthLabel(mk),
      income: Math.round(inc * 100) / 100,
      expenses: Math.round(exp * 100) / 100,
      savings: Math.round((inc - exp) * 100) / 100,
    };
  });

  // Weekly spending buckets within selected month (Week 1..5)
  const weekBuckets = [0, 0, 0, 0, 0];
  for (const t of monthTx) {
    if (t.type !== 'expense') continue;
    const day = Number(t.date.slice(8, 10));
    const idx = Math.min(4, Math.floor((day - 1) / 7));
    weekBuckets[idx] += t.amount;
  }
  const weeklySpending = weekBuckets.map((amt, i) => ({
    label: `Week ${i + 1}`,
    amount: Math.round(amt * 100) / 100,
  }));

  const recentTransactions = [...allTx]
    .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)))
    .slice(0, 8);

  const unreadNotificationCount = store.db.notifications.filter(
    (n) => n.userId === userId && !n.isRead
  ).length;

  const userGoals = store.db.savingsGoals.filter((g) => g.userId === userId);
  const totalSavingsBalance = Math.round(
    userGoals.reduce((sum, g) => sum + g.currentAmount, 0) * 100
  ) / 100;
  const completedGoalsCount = userGoals.filter((g) => g.currentAmount >= g.targetAmount).length;
  const activeGoalsCount = userGoals.length - completedGoalsCount;

  return {
    month,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    savingsRatePct,
    totalSavingsBalance,
    activeGoalsCount,
    completedGoalsCount,
    overallBudgetLimit,
    budgetUsagePct,
    financialHealth: {
      status: healthStatus,
      summary: healthSummary,
      savingsRatePct,
      budgetAdherenceLabel,
      topExpenseCategory: topCat?.category ?? 'None',
      topExpenseSharePct: topCat?.sharePct ?? 0,
    },
    monthlySeries,
    expenseByCategory,
    weeklySpending,
    budgetProgress,
    recentTransactions,
    unreadNotificationCount,
  };
}

export function computeStatisticalForecast(userId: string): ForecastSummary {
  const allTx = store.db.transactions.filter((t) => t.userId === userId);
  const currentMonth = getCurrentMonthKey();
  const monthKeys = getRecentMonthKeys(6, currentMonth);

  const series = monthKeys.map((mk) => {
    const mTx = allTx.filter((t) => t.date.startsWith(mk));
    const income = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { month: mk, label: getMonthLabel(mk), income, expenses };
  });

  // Active months with any data
  const populated = series.filter((s) => s.income > 0 || s.expenses > 0);
  const monthsAnalyzed = populated.length;

  if (monthsAnalyzed < 2) {
    const singleExp = populated[0]?.expenses ?? 0;
    const singleInc = populated[0]?.income ?? 0;
    return {
      hasEnoughData: false,
      monthsAnalyzed,
      methodology: 'Weighted Moving Average + Linear Trend (requires at least 2 months of transaction history)',
      assumptions: [
        'At least 2 distinct months of expenses are needed to detect spending variance and trends.',
        'Current figures reflect your available baseline without statistical trend extrapolation.',
      ],
      limitations: [
        'Insufficient multi-month history: estimates will stabilize once 2–6 months of data are recorded.',
        'Forecasts are statistical estimates based on past behavior, not guaranteed future outcomes.',
      ],
      expectedNextMonthExpenses: Math.round(singleExp),
      expectedExpenseRange: { low: Math.round(singleExp * 0.85), high: Math.round(singleExp * 1.15) },
      expectedNextMonthIncome: Math.round(singleInc),
      expectedNextMonthSavings: Math.round(singleInc - singleExp),
      recommendedMonthlyBudget: Math.round(singleExp * 1.05),
      historicalMonthlySeries: series,
      categoryForecasts: [],
    };
  }

  // Weighted moving average giving higher weight to more recent months
  const expValues = populated.map((p) => p.expenses);
  const incValues = populated.map((p) => p.income);
  const weights = populated.map((_, idx) => idx + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const weightedExpAvg = expValues.reduce((sum, val, i) => sum + val * weights[i], 0) / weightSum;
  const weightedIncAvg = incValues.reduce((sum, val, i) => sum + val * weights[i], 0) / weightSum;

  // Linear regression slope on expense series
  const n = expValues.length;
  const xMean = (n - 1) / 2;
  const yMean = expValues.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (expValues[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den > 0 ? num / den : 0;
  // Blend weighted average + bounded trend adjustment (clamped to +/- 20% of avg)
  const boundedSlope = Math.max(-weightedExpAvg * 0.2, Math.min(weightedExpAvg * 0.2, slope));
  const projectedExp = Math.max(0, Math.round(weightedExpAvg + boundedSlope * 0.5));
  const projectedInc = Math.max(0, Math.round(weightedIncAvg));

  // Sample standard deviation for confidence band
  const variance = expValues.reduce((sum, v) => sum + Math.pow(v - yMean, 2), 0) / Math.max(1, n - 1);
  const stdDev = Math.sqrt(variance);
  const bandLow = Math.max(0, Math.round(projectedExp - stdDev));
  const bandHigh = Math.round(projectedExp + stdDev);

  // Category-level projections
  const expenseCats = Array.from(
    new Set(allTx.filter((t) => t.type === 'expense').map((t) => t.category))
  );
  const lastMonthKey = populated[populated.length - 1].month;

  const categoryForecasts = expenseCats
    .map((category) => {
      const catSeries = populated.map((m) =>
        allTx
          .filter((t) => t.type === 'expense' && t.category === category && t.date.startsWith(m.month))
          .reduce((s, t) => s + t.amount, 0)
      );
      const histAvg = catSeries.reduce((a, b) => a + b, 0) / catSeries.length;
      const wAvg = catSeries.reduce((sum, v, i) => sum + v * weights[i], 0) / weightSum;
      const lastVal = allTx
        .filter((t) => t.type === 'expense' && t.category === category && t.date.startsWith(lastMonthKey))
        .reduce((s, t) => s + t.amount, 0);

      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      if (wAvg > histAvg * 1.07) trendDirection = 'up';
      else if (wAvg < histAvg * 0.93) trendDirection = 'down';

      return {
        category,
        lastMonthAmount: Math.round(lastVal),
        historicalAvg: Math.round(histAvg),
        projectedNextMonth: Math.round(wAvg),
        trendDirection,
      };
    })
    .filter((c) => c.historicalAvg > 0 || c.lastMonthAmount > 0)
    .sort((a, b) => b.projectedNextMonth - a.projectedNextMonth);

  return {
    hasEnoughData: true,
    monthsAnalyzed,
    methodology: `Linear-weighted moving average across ${monthsAnalyzed} active months blended with damped OLS trend slope (±1σ confidence interval).`,
    assumptions: [
      'Recent months carry linearly higher weight (1..N) than older months to capture current lifestyle habits.',
      'Trend adjustment is damped (0.5× slope, capped at ±20%) to avoid over-reacting to single-month spikes.',
      'Income estimate uses weighted historical monthly income without speculative bonus growth.',
    ],
    limitations: [
      'Irregular annual expenses, medical emergencies, or one-time purchases may deviate outside the ±1σ band.',
      'Statistical projections are informational estimates, not guaranteed financial predictions.',
    ],
    expectedNextMonthExpenses: projectedExp,
    expectedExpenseRange: { low: bandLow, high: bandHigh },
    expectedNextMonthIncome: projectedInc,
    expectedNextMonthSavings: projectedInc - projectedExp,
    recommendedMonthlyBudget: Math.round(projectedExp * 1.05),
    historicalMonthlySeries: series,
    categoryForecasts,
  };
}

export function computeAnalyticsSummary(
  userId: string,
  startDate: string,
  endDate: string
): AnalyticsSummary {
  const userTx = store.db.transactions.filter(
    (t) => t.userId === userId && t.date >= startDate && t.date <= endDate
  );

  const totalIncome = Math.round(userTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const totalExpenses = Math.round(userTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const savingsRatePct = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0;

  // Previous period of equal day span
  const sDt = new Date(`${startDate}T00:00:00`);
  const eDt = new Date(`${endDate}T00:00:00`);
  const spanDays = Math.max(1, Math.round((eDt.getTime() - sDt.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const prevEnd = new Date(sDt.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 24 * 60 * 60 * 1000);
  const prevStartStr = prevStart.toISOString().slice(0, 10);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);

  const previousPeriodExpenses = Math.round(
    store.db.transactions
      .filter((t) => t.userId === userId && t.type === 'expense' && t.date >= prevStartStr && t.date <= prevEndStr)
      .reduce((s, t) => s + t.amount, 0) * 100
  ) / 100;

  const expenseChangePct = previousPeriodExpenses > 0
    ? Math.round(((totalExpenses - previousPeriodExpenses) / previousPeriodExpenses) * 1000) / 10
    : null;

  const expCatMap = new Map<string, { amount: number; count: number }>();
  const incCatMap = new Map<string, { amount: number; count: number }>();

  for (const t of userTx) {
    const targetMap = t.type === 'expense' ? expCatMap : incCatMap;
    const prev = targetMap.get(t.category) || { amount: 0, count: 0 };
    targetMap.set(t.category, { amount: prev.amount + t.amount, count: prev.count + 1 });
  }

  const categoryBreakdown = Array.from(expCatMap.entries())
    .map(([category, v]) => ({
      category,
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
      sharePct: totalExpenses > 0 ? Math.round((v.amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeSourceBreakdown = Array.from(incCatMap.entries())
    .map(([category, v]) => ({
      category,
      amount: Math.round(v.amount * 100) / 100,
      count: v.count,
      sharePct: totalIncome > 0 ? Math.round((v.amount / totalIncome) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group trend by date (if <= 31 days) or by YYYY-MM (if > 31 days)
  const useMonthly = spanDays > 35;
  const trendMap = new Map<string, { income: number; expenses: number }>();
  for (const t of userTx) {
    const bucket = useMonthly ? t.date.slice(0, 7) : t.date;
    const prev = trendMap.get(bucket) || { income: 0, expenses: 0 };
    if (t.type === 'income') prev.income += t.amount;
    else prev.expenses += t.amount;
    trendMap.set(bucket, prev);
  }
  const dailyOrWeeklyTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      label: useMonthly ? getMonthLabel(key) : key.slice(5),
      income: Math.round(v.income * 100) / 100,
      expenses: Math.round(v.expenses * 100) / 100,
    }));

  const budgetMonth = endDate.slice(0, 7);
  const budgetPerformance = computeBudgetUtilization(userId, budgetMonth);

  return {
    startDate,
    endDate,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRatePct,
    transactionCount: userTx.length,
    previousPeriodExpenses,
    expenseChangePct,
    categoryBreakdown,
    incomeSourceBreakdown,
    dailyOrWeeklyTrend,
    budgetPerformance,
  };
}

function escapeCsvCell(value: string | number): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildTransactionsCsv(rows: TransactionRecord[]): string {
  const headers = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Payment Method', 'Description', 'Notes'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.date),
        escapeCsvCell(r.title),
        escapeCsvCell(r.type),
        escapeCsvCell(r.category),
        escapeCsvCell(r.amount),
        escapeCsvCell(r.paymentMethod),
        escapeCsvCell(r.description),
        escapeCsvCell(r.notes),
      ].join(',')
    );
  }
  return lines.join('\n');
}
