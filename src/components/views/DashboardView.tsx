import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch, formatCurrency } from '../../lib/format';
import type {
  CurrencyCode,
  DashboardSummary,
} from '../../shared/types';
import { IncomeVsExpenseChart } from '../Charts';

interface DashboardViewProps {
  month: string;
  currency: CurrencyCode;
  dark: boolean;
  onNavigate: (tab: string) => void;
  onOpenQuickAdd: (type: 'expense' | 'income') => void;
  refreshSignal: number;
}

export function DashboardView({
  month,
  currency,
  dark,
  onNavigate,
  onOpenQuickAdd,
  refreshSignal,
}: DashboardViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const dash = await apiFetch<DashboardSummary>(`/api/dashboard?month=${encodeURIComponent(month)}`);
      setSummary(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, refreshSignal]);

  if (loading && !summary) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          <div className="lg:col-span-4 h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          <div className="lg:col-span-5 h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
        {error || 'Dashboard data unavailable.'}
      </div>
    );
  }

  const latestPoint = summary.monthlySeries[summary.monthlySeries.length - 1];
  const categoryBudgets = summary.budgetProgress.filter((b) => b.category !== 'Overall');
  const watchlist = categoryBudgets.length > 0 ? categoryBudgets : summary.budgetProgress;
  const totalGoalCount = summary.activeGoalsCount + summary.completedGoalsCount;

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Row 1: 4 Equal KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Monthly Income</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summary.monthlyIncome, currency)}
          </p>
          <p className="text-xs font-medium text-[#059669] dark:text-emerald-400 mt-1.5">
            Inflows recorded this month
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Monthly Expenses</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summary.monthlyExpenses, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Across {summary.expenseByCategory.length} active {summary.expenseByCategory.length === 1 ? 'category' : 'categories'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Net Cash Flow</p>
          <p
            className={`font-mono-num text-2xl font-bold mt-2 ${
              summary.monthlySavings >= 0
                ? 'text-[#059669] dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.monthlySavings >= 0 ? '+' : ''}
            {formatCurrency(summary.monthlySavings, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Savings rate: <span className="font-mono-num">{summary.savingsRatePct}%</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Savings Balance</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summary.totalSavingsBalance, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {totalGoalCount} {totalGoalCount === 1 ? 'vault' : 'vaults'} &middot; {summary.activeGoalsCount} active {summary.activeGoalsCount === 1 ? 'goal' : 'goals'}
          </p>
        </div>
      </div>

      {/* Row 2: 6-Month Cash Flow (8 cols) + Top Spend Categories (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                6-Month Cash Flow
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Income inflows vs. expense outflows by month
              </p>
            </div>
            {latestPoint && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{latestPoint.label}</span>
                <span className="text-[#059669] dark:text-emerald-400 font-semibold">
                  In: {formatCurrency(latestPoint.income, currency)}
                </span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  Out: {formatCurrency(latestPoint.expenses, currency)}
                </span>
              </div>
            )}
          </div>

          <div className="h-64 pt-4">
            <IncomeVsExpenseChart series={summary.monthlySeries} currency={currency} dark={dark} />
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Top Spend Categories
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {summary.expenseByCategory.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No expenses recorded for {summary.month} yet.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('expense')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer"
                >
                  Log First Expense
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.expenseByCategory.slice(0, 5).map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {cat.category}
                      </span>
                      <span className="font-mono-num text-slate-900 dark:text-white font-semibold whitespace-nowrap shrink-0">
                        {formatCurrency(cat.amount, currency)}{' '}
                        <span className="text-slate-400 font-normal">({Math.round(cat.sharePct)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0F172A] dark:bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(4, cat.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('ai-advisor')}
            className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Ask AI Advisor about this month
          </button>
        </div>
      </div>

      {/* Row 3: Recent Ledger Activity (7 cols) + Monthly Budget Watchlist (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Recent Ledger Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-[#059669] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full Report
            </button>
          </div>

          {summary.recentTransactions.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No transactions recorded yet.
              </p>
              <button
                type="button"
                onClick={() => onOpenQuickAdd('expense')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                Add First Transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.recentTransactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {tx.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {tx.category} &middot; {tx.paymentMethod} &middot; {tx.date}
                    </p>
                  </div>
                  <span
                    className={`font-mono-num text-sm font-semibold whitespace-nowrap shrink-0 ${
                      tx.type === 'income'
                        ? 'text-[#059669] dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Monthly Budget Watchlist
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-semibold text-[#059669] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage
            </button>
          </div>

          {watchlist.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No category budgets configured for {summary.month}.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('budgets')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer"
              >
                Set Monthly Budgets
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {watchlist.slice(0, 4).map((b) => {
                const isOver = b.utilizationPct >= 100;
                const isWarn = !isOver && b.utilizationPct >= 75;
                const barWidth = Math.min(100, b.utilizationPct);
                const barColor = isOver
                  ? 'bg-red-600'
                  : isWarn
                    ? 'bg-amber-500'
                    : 'bg-[#059669]';
                const statusColor = isOver
                  ? 'text-red-600 dark:text-red-400'
                  : isWarn
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[#059669] dark:text-emerald-400';
                const statusLabel = isOver
                  ? 'Over budget'
                  : isWarn
                    ? 'Approaching limit'
                    : 'On track';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">{b.category}</span>
                      <span className="font-mono-num text-slate-900 dark:text-white font-semibold whitespace-nowrap shrink-0">
                        {formatCurrency(b.spentAmount, currency)}{' '}
                        <span className="text-slate-400 font-normal">/ {formatCurrency(b.limitAmount, currency)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`inline-flex items-center gap-1 font-medium ${statusColor}`}>
                        {isOver || isWarn ? (
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        )}
                        {statusLabel}
                      </span>
                      <span className="font-mono-num text-slate-500 dark:text-slate-400">
                        {Math.round(b.utilizationPct)}% used
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
