import { useEffect, useState } from 'react';
import { ArrowUpRight, PiggyBank, Plus, X } from 'lucide-react';
import { apiFetch, formatCurrency, formatShortDate } from '../../lib/format';
import type {
  CurrencyCode,
  DashboardSummary,
  SavingsContributionRecord,
  SavingsGoalEnriched,
} from '../../shared/types';

interface SavingsVaultsViewProps {
  currency: CurrencyCode;
  month: string;
  onNavigate: (tab: string) => void;
  onDataChanged: () => void;
  refreshSignal?: number;
}

export function SavingsVaultsView({
  currency,
  month,
  onNavigate,
  onDataChanged,
  refreshSignal = 0,
}: SavingsVaultsViewProps) {
  const [goals, setGoals] = useState<SavingsGoalEnriched[]>([]);
  const [contributions, setContributions] = useState<SavingsContributionRecord[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [depositOpen, setDepositOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [savRes, dashRes] = await Promise.all([
        apiFetch<{ goals: SavingsGoalEnriched[]; contributions: SavingsContributionRecord[] }>('/api/savings'),
        apiFetch<DashboardSummary>(`/api/dashboard?month=${encodeURIComponent(month)}`),
      ]);
      setGoals(savRes.goals);
      setContributions(savRes.contributions);
      setDashboard(dashRes);
      if (!selectedGoalId && savRes.goals[0]) {
        setSelectedGoalId(savRes.goals[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load savings vaults.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, refreshSignal]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoalId) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/savings/${selectedGoalId}/contribute`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(depositAmount),
          note: depositNote,
        }),
      });
      setDepositOpen(false);
      setDepositAmount('');
      setDepositNote('');
      await loadAll();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record deposit.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const plannedMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const goalNameMap = new Map(goals.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Savings &amp; Reserve Vaults
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor total accumulated reserves, monthly savings rate, and goal deposits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('goals')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Manage Financial Goals
          </button>
          {goals.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedGoalId(goals[0].id);
                setDepositOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#059669] hover:bg-[#047857] text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Deposit to Vault
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Savings Balance</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(totalSaved, currency)}
          </p>
          <p className="text-xs text-[#059669] dark:text-emerald-400 mt-1">
            {overallProgress}% of {formatCurrency(totalTarget, currency)} target
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">This Month Net Cash Flow</p>
          <p className="font-mono-num text-2xl font-bold text-[#059669] dark:text-emerald-400 mt-2">
            {formatCurrency(dashboard?.monthlySavings ?? 0, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Savings rate: <span className="font-mono-num">{dashboard?.savingsRatePct ?? 0}%</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Planned Monthly Allocation</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(plannedMonthly, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across {goals.length} {goals.length === 1 ? 'vault' : 'vaults'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cumulative Ledger Balance</p>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(dashboard?.totalBalance ?? 0, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            All-time net inflows
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading savings vaults...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Vault Allocation List */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-[#059669]" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Vault Balances by Goal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('goals')}
                className="text-xs font-semibold text-[#059669] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Edit Goals →
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Create a financial goal first to start allocating savings vaults.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('goals')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer"
                >
                  Create First Goal
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.map((g) => (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">{g.name}</span>
                      <span className="font-mono-num text-slate-900 dark:text-white font-semibold">
                        {formatCurrency(g.currentAmount, currency)}{' '}
                        <span className="text-slate-400 font-normal">/ {formatCurrency(g.targetAmount, currency)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#059669]"
                        style={{ width: `${Math.min(100, g.progressPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{g.category} &middot; Target {formatShortDate(g.targetDate)}</span>
                      <span className="font-mono-num">{g.progressPct}% funded</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deposit / Contribution History */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white mb-4">
              Recent Vault Deposits
            </h2>

            {contributions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No deposits recorded yet. Use &ldquo;Deposit to Vault&rdquo; to log your next transfer.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {contributions.slice(0, 10).map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {goalNameMap.get(c.goalId) || 'Savings Vault'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {c.note || 'Vault transfer'} &middot; {formatShortDate(c.contributedAt)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono-num text-sm font-semibold text-[#059669] dark:text-emerald-400 whitespace-nowrap shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{formatCurrency(c.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {depositOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Deposit to Savings Vault
              </h3>
              <button
                type="button"
                onClick={() => setDepositOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Goal Vault
                </label>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({formatCurrency(g.currentAmount, currency)} / {formatCurrency(g.targetAmount, currency)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder="Monthly savings transfer"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Recording...' : 'Record Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
