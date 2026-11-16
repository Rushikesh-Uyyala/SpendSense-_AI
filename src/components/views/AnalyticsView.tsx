import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, downloadAuthenticatedCsv, formatCurrency, getTodayStr } from '../../lib/format';
import type { AnalyticsSummary, CurrencyCode } from '../../shared/types';
import { CategoryDoughnutChart, IncomeVsExpenseChart } from '../Charts';

interface AnalyticsViewProps {
  currency: CurrencyCode;
  dark: boolean;
}

type DatePreset = '7d' | '30d' | 'this_month' | 'last_month' | '3m' | 'custom';

function computePresetDates(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmt(now);

  if (preset === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: fmt(start), end: today };
  }
  if (preset === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: fmt(start), end: today };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === '3m') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start: fmt(start), end: today };
  }
  // this_month default
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: fmt(start), end: today };
}

export function AnalyticsView({ currency, dark }: AnalyticsViewProps) {
  const [preset, setPreset] = useState<DatePreset>('3m');
  const initialRange = computePresetDates('3m');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAnalytics(s: string, e: string) {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<AnalyticsSummary>(
        `/api/analytics?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(startDate, endDate);
  }, [startDate, endDate]);

  function selectPreset(next: DatePreset) {
    setPreset(next);
    if (next !== 'custom') {
      const range = computePresetDates(next);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Financial Reports &amp; Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Period comparisons, income source breakdown, category rankings, and CSV reports
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              await downloadAuthenticatedCsv(
                `/api/analytics/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
                `spendsense-report-${startDate}-to-${endDate}.csv`
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to export report.');
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Report CSV
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: '3m', label: 'Last 3 Months' },
            { id: 'custom', label: 'Custom' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id as DatePreset)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                preset === p.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => {
              setPreset('custom');
              setStartDate(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={getTodayStr()}
            onChange={(e) => {
              setPreset('custom');
              setEndDate(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading financial analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Period Income</p>
              <p className="font-mono-num text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                {formatCurrency(data.totalIncome, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Period Expenses</p>
              <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                {formatCurrency(data.totalExpenses, currency)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {data.expenseChangePct !== null
                  ? `${data.expenseChangePct > 0 ? '+' : ''}${data.expenseChangePct}% vs prior period`
                  : `${data.transactionCount} entries`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Savings</p>
              <p
                className={`font-mono-num text-2xl font-bold mt-1.5 ${
                  data.netSavings >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(data.netSavings, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Savings Rate</p>
              <p className="font-mono-num text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">
                {data.savingsRatePct}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Income vs Expense Comparison
              </h2>
              <div className="h-64">
                <IncomeVsExpenseChart series={data.dailyOrWeeklyTrend} currency={currency} dark={dark} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Expense Share by Category
              </h2>
              <div className="h-64">
                {data.categoryBreakdown.length > 0 ? (
                  <CategoryDoughnutChart items={data.categoryBreakdown} currency={currency} dark={dark} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No expenses recorded in this date range.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
                Highest Spending Categories
              </h2>
              {data.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500">No expense records in range.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {data.categoryBreakdown.map((c) => (
                    <div key={c.category} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{c.category}</p>
                        <p className="text-xs text-slate-500">{c.count} transactions &middot; {c.sharePct}%</p>
                      </div>
                      <p className="font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(c.amount, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
                Income Source Analytics
              </h2>
              {data.incomeSourceBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500">No income records in range.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {data.incomeSourceBreakdown.map((c) => (
                    <div key={c.category} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{c.category}</p>
                        <p className="text-xs text-slate-500">{c.count} entries &middot; {c.sharePct}%</p>
                      </div>
                      <p className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.amount, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
