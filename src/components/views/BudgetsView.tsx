import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { apiFetch, formatCurrency, getCurrentMonthStr } from '../../lib/format';
import type {
  BudgetUtilizationItem,
  CategoryRecord,
  CurrencyCode,
} from '../../shared/types';

interface BudgetsViewProps {
  currency: CurrencyCode;
  refreshSignal?: number;
  onDataChanged: () => void;
}

export function BudgetsView({ currency, refreshSignal = 0, onDataChanged }: BudgetsViewProps) {
  const [month, setMonth] = useState(getCurrentMonthStr());
  const [budgets, setBudgets] = useState<BudgetUtilizationItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('Overall');
  const [limitAmount, setLimitAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadBudgets() {
    setLoading(true);
    setError('');
    try {
      const [bRes, cRes] = await Promise.all([
        apiFetch<{ month: string; budgets: BudgetUtilizationItem[] }>(`/api/budgets?month=${encodeURIComponent(month)}`),
        apiFetch<{ categories: CategoryRecord[] }>('/api/categories'),
      ]);
      setBudgets(bRes.budgets);
      const expCats = cRes.categories.filter((c) => c.type === 'expense').map((c) => c.name);
      setExpenseCategories(expCats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load budgets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBudgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, refreshSignal]);

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch<{ budgets: BudgetUtilizationItem[] }>('/api/budgets', {
        method: 'PUT',
        body: JSON.stringify({
          month,
          category,
          limitAmount: Number(limitAmount),
        }),
      });
      setBudgets(res.budgets);
      setLimitAmount('');
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save budget.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBudget(id: string) {
    setError('');
    try {
      await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' });
      await loadBudgets();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete budget.');
    }
  }

  const alertStatusLabel = (level: BudgetUtilizationItem['alertLevel']) => {
    switch (level) {
      case 'exceeded':
        return { text: '100%+ Exceeded', color: 'text-red-600 dark:text-red-400', bar: 'bg-red-600' };
      case '90':
        return { text: '90% Critical Threshold', color: 'text-red-600 dark:text-red-400', bar: 'bg-red-600' };
      case '75':
        return { text: '75% Warning Threshold', color: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
      case '50':
        return { text: '50% Midpoint Reached', color: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-600' };
      default:
        return { text: 'Healthy Pace', color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-600' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Smart Monthly Budget Planner
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure monthly spending caps with automatic 50%, 75%, 90%, and 100% alerts
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Select budget month"
          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Create / Update Budget Form */}
      <form
        onSubmit={handleSaveBudget}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
      >
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
          Set or Update Monthly Limit ({month})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Budget Scope / Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="Overall">Overall Monthly Budget</option>
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Limit ({currency})
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-3 py-2.5 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Budget Limit'}
          </button>
        </div>
      </form>

      {/* Budget Cards */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No budgets configured for {month}. Set an Overall Monthly Budget or category limits above to activate threshold alerts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const meta = alertStatusLabel(b.alertLevel);
            const width = Math.min(100, b.utilizationPct);
            return (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      {b.category === 'Overall' ? 'Overall Monthly Budget' : b.category}
                    </h3>
                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium mt-1 ${meta.color}`}>
                      {b.alertLevel === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{meta.text}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(b.category);
                        setLimitAmount(String(b.limitAmount));
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id)}
                      aria-label={`Delete ${b.category} budget`}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${width}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Spent</p>
                    <p className="font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(b.spentAmount, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Limit</p>
                    <p className="font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(b.limitAmount, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">
                      {b.remainingAmount >= 0 ? 'Remaining' : 'Over by'}
                    </p>
                    <p
                      className={`font-mono-num font-semibold mt-0.5 ${
                        b.remainingAmount >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(Math.abs(b.remainingAmount), currency)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
