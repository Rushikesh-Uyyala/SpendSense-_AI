import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import { apiFetch, formatCurrency } from '../../lib/format';
import type { CurrencyCode, ForecastSummary } from '../../shared/types';
import { ForecastChart } from '../Charts';

interface ForecastingViewProps {
  currency: CurrencyCode;
  dark: boolean;
}

export function ForecastingView({ currency, dark }: ForecastingViewProps) {
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch<ForecastSummary>('/api/forecasting');
        setForecast(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to compute statistical forecast.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Computing statistical forecast...</div>;
  }

  if (error || !forecast) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
        {error || 'Forecast unavailable.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Statistical Financial Forecasting
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Estimates next month&apos;s cashflow and category budgets from your historical transaction series
        </p>
      </div>

      {/* KPI Projections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Expected Next Month Expenses</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {formatCurrency(forecast.expectedNextMonthExpenses, currency)}
          </p>
          <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-1">
            Band: {formatCurrency(forecast.expectedExpenseRange.low, currency)} –{' '}
            {formatCurrency(forecast.expectedExpenseRange.high, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Projected Monthly Income</p>
          <p className="font-mono-num text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(forecast.expectedNextMonthIncome, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Based on {forecast.monthsAnalyzed} active months
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Expected Monthly Savings</p>
          <p
            className={`font-mono-num text-2xl font-bold mt-1.5 ${
              forecast.expectedNextMonthSavings >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(forecast.expectedNextMonthSavings, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Projected surplus</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Suggested Budget Requirement</p>
          <p className="font-mono-num text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">
            {formatCurrency(forecast.recommendedMonthlyBudget, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Includes 5% buffer</p>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Historical Cashflow &amp; Next Month Projection
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Dashed segment = statistical estimate</span>
        </div>
        <div className="h-72">
          <ForecastChart
            history={forecast.historicalMonthlySeries}
            projectedExpense={forecast.expectedNextMonthExpenses}
            projectedIncome={forecast.expectedNextMonthIncome}
            currency={currency}
            dark={dark}
          />
        </div>
      </div>

      {/* Category Projections Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
          Category-Wise Future Spending Estimate
        </h2>
        {forecast.categoryForecasts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Record at least 2 months of expenses across categories to generate category-level trend projections.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Last Month</th>
                  <th className="py-2.5 px-4 text-right">Historical Avg</th>
                  <th className="py-2.5 px-4 text-right">Projected Next Month</th>
                  <th className="py-2.5 pl-4 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {forecast.categoryForecasts.map((cat) => (
                  <tr key={cat.category}>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{cat.category}</td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {formatCurrency(cat.lastMonthAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {formatCurrency(cat.historicalAvg, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(cat.projectedNextMonth, currency)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          cat.trendDirection === 'up'
                            ? 'text-amber-600 dark:text-amber-400'
                            : cat.trendDirection === 'down'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {cat.trendDirection === 'up' && <ArrowUpRight className="w-3.5 h-3.5" />}
                        {cat.trendDirection === 'down' && <ArrowDownRight className="w-3.5 h-3.5" />}
                        {cat.trendDirection === 'stable' && <ArrowRight className="w-3.5 h-3.5" />}
                        {cat.trendDirection === 'up' ? 'Rising' : cat.trendDirection === 'down' ? 'Easing' : 'Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Methodology & Assumptions Transparency */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Methodology, Assumptions &amp; Limitations
          </h2>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">{forecast.methodology}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs text-slate-600 dark:text-slate-400">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Model Assumptions</p>
            <ul className="list-disc pl-4 space-y-1">
              {forecast.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Limitations</p>
            <ul className="list-disc pl-4 space-y-1">
              {forecast.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
