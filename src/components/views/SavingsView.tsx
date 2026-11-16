import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Target, Trash2, X } from 'lucide-react';
import { apiFetch, formatCurrency, formatShortDate } from '../../lib/format';
import type {
  CurrencyCode,
  SavingsContributionRecord,
  SavingsGoalEnriched,
} from '../../shared/types';

interface SavingsViewProps {
  currency: CurrencyCode;
  refreshSignal?: number;
  onDataChanged: () => void;
}

const GOAL_TYPES = [
  'Buy a laptop',
  'Buy a smartphone',
  'Emergency fund',
  'Education fees',
  'Travel',
  'Buy a vehicle',
  'Personal savings',
];

export function SavingsView({ currency, refreshSignal = 0, onDataChanged }: SavingsViewProps) {
  const [goals, setGoals] = useState<SavingsGoalEnriched[]>([]);
  const [contributions, setContributions] = useState<SavingsContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Goal Form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(GOAL_TYPES[0]);
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Contribute Modal
  const [contribGoal, setContribGoal] = useState<SavingsGoalEnriched | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');

  async function loadSavings() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        goals: SavingsGoalEnriched[];
        contributions: SavingsContributionRecord[];
      }>('/api/savings');
      setGoals(res.goals);
      setContributions(res.contributions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load savings goals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSavings();
  }, [refreshSignal]);

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/savings', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          targetAmount: Number(targetAmount),
          currentAmount: Number(currentAmount || 0),
          monthlyContribution: Number(monthlyContribution || 0),
          targetDate,
        }),
      });
      setShowCreate(false);
      setName('');
      setTargetAmount('');
      setCurrentAmount('0');
      setMonthlyContribution('');
      setTargetDate('');
      await loadSavings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create goal.');
    }
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!contribGoal) return;
    setError('');
    try {
      await apiFetch(`/api/savings/${contribGoal.id}/contribute`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(contribAmount),
          note: contribNote,
        }),
      });
      setContribGoal(null);
      setContribAmount('');
      setContribNote('');
      await loadSavings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log contribution.');
    }
  }

  async function handleDeleteGoal(id: string) {
    setError('');
    try {
      await apiFetch(`/api/savings/${id}`, { method: 'DELETE' });
      await loadSavings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete goal.');
    }
  }

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Smart Savings Goals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track progress, record contributions, and compute suggested monthly savings for target dates
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Savings Goal
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Active Goals</p>
          <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-1">{goals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Saved Across Goals</p>
          <p className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(totalSaved, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Combined Target</p>
          <p className="font-mono-num text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(totalTarget, currency)}
          </p>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateGoal}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Create New Savings Goal
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Goal Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Buy a Laptop"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
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
                {GOAL_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Amount ({currency})
              </label>
              <input
                type="number"
                min="1"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="50000"
                className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Current Saved ({currency})
              </label>
              <input
                type="number"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Planned Monthly Contribution ({currency})
              </label>
              <input
                type="number"
                min="0"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="5000"
                className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading savings goals...</div>
      ) : goals.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <Target className="w-8 h-8 text-blue-600 mx-auto" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No savings goals yet. Create your first financial milestone to calculate your monthly target pace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => (
            <div
              key={g.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {g.category} &middot; Target {formatShortDate(g.targetDate)}
                  </p>
                  <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                    {g.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(g.id)}
                  aria-label={`Delete ${g.name}`}
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(g.currentAmount, currency)} saved
                  </span>
                  <span className="font-mono-num text-slate-500 dark:text-slate-400">
                    {g.progressPct}% of {formatCurrency(g.targetAmount, currency)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${g.progressPct >= 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                    style={{ width: `${g.progressPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Remaining</p>
                  <p className="font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(g.remainingAmount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Suggested / Mo</p>
                  <p className="font-mono-num font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                    {formatCurrency(g.suggestedMonthlySavings, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Pace Status</p>
                  <p
                    className={`font-semibold mt-0.5 inline-flex items-center gap-1 ${
                      g.onTrack
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {g.onTrack && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {g.remainingAmount === 0 ? 'Completed' : g.onTrack ? 'On Track' : 'Increase Pace'}
                  </p>
                </div>
              </div>

              {g.remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setContribGoal(g);
                    setContribAmount(String(g.suggestedMonthlySavings || 1000));
                    setContribNote('');
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer"
                >
                  + Add Savings Contribution
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Contribution History */}
      {contributions.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
            Recent Contributions
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {contributions.slice(0, 8).map((c) => {
              const goal = goals.find((g) => g.id === c.goalId);
              return (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {goal?.name || 'Savings Goal'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatShortDate(c.contributedAt)} {c.note ? `· ${c.note}` : ''}
                    </p>
                  </div>
                  <p className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(c.amount, currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contribGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Contribute to {contribGoal.name}
              </h2>
              <button
                type="button"
                onClick={() => setContribGoal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contribution Amount ({currency})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="Monthly savings transfer"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setContribGoal(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Record Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
