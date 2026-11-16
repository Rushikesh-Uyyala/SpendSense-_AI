import { useEffect, useState } from 'react';
import { Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { apiFetch, formatCurrency, formatShortDate, getTodayStr } from '../../lib/format';
import {
  PAYMENT_METHODS,
  type CategoryRecord,
  type CurrencyCode,
  type RecurringFrequency,
  type RecurringTransactionRecord,
  type TransactionType,
} from '../../shared/types';

interface RecurringViewProps {
  currency: CurrencyCode;
  onDataChanged: () => void;
}

export function RecurringView({ currency, onDataChanged }: RecurringViewProps) {
  const [items, setItems] = useState<RecurringTransactionRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Rent');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState('');

  async function loadRecurring() {
    setLoading(true);
    setError('');
    try {
      const [recRes, catRes] = await Promise.all([
        apiFetch<{ recurring: RecurringTransactionRecord[]; processedCount: number }>('/api/recurring'),
        apiFetch<{ categories: CategoryRecord[] }>('/api/categories'),
      ]);
      setItems(recRes.recurring);
      setCategories(catRes.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recurring schedules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecurring();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/recurring', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type,
          amount: Number(amount),
          category,
          paymentMethod,
          frequency,
          startDate,
          endDate: endDate || undefined,
        }),
      });
      setShowForm(false);
      setTitle('');
      setAmount('');
      setEndDate('');
      await loadRecurring();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create recurring schedule.');
    }
  }

  async function handleToggle(item: RecurringTransactionRecord) {
    setError('');
    try {
      await apiFetch(`/api/recurring/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update schedule.');
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await apiFetch(`/api/recurring/${id}`, { method: 'DELETE' });
      await loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete schedule.');
    }
  }

  const availableCats = categories.filter((c) => c.type === type);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Recurring Income &amp; Bills
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Automated, duplicate-safe recording for monthly salary, rent, utilities, and subscriptions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Recurring Schedule
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Configure Recurring Transaction
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Apartment Rent"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as TransactionType;
                  setType(next);
                  const first = categories.find((c) => c.type === next);
                  if (first) setCategory(first.name);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount ({currency})
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {availableCats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Save Schedule
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading recurring transactions...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <Repeat className="w-8 h-8 text-blue-600 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No recurring income or expense schedules configured yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((item) => (
            <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <span
                    className={`text-xs font-medium ${
                      item.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    &middot; {item.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {item.category} &middot; {item.frequency} &middot; {item.paymentMethod} &middot; Starts{' '}
                  {formatShortDate(item.startDate)}
                  {item.lastGeneratedDate ? ` · Last recorded ${formatShortDate(item.lastGeneratedDate)}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className={`font-mono-num text-base font-bold ${
                    item.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount, currency)}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  aria-label={item.isActive ? 'Pause schedule' : 'Resume schedule'}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {item.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
