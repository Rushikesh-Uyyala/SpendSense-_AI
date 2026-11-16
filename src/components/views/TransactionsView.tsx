import { useEffect, useState } from 'react';
import {
  Download,
  Edit2,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedCsv, formatCurrency, formatShortDate, getTodayStr } from '../../lib/format';
import {
  PAYMENT_METHODS,
  type CategoryRecord,
  type CurrencyCode,
  type TransactionRecord,
  type TransactionType,
} from '../../shared/types';

interface TransactionsViewProps {
  currency: CurrencyCode;
  fixedType?: TransactionType;
  refreshSignal?: number;
  initialModalType: TransactionType | null;
  onClearInitialModal: () => void;
  onDataChanged: () => void;
}

export function TransactionsView({
  currency,
  fixedType,
  refreshSignal = 0,
  initialModalType,
  onClearInitialModal,
  onDataChanged,
}: TransactionsViewProps) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>(fixedType ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRecord | null>(null);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDate, setFormDate] = useState(getTodayStr());
  const [formPayment, setFormPayment] = useState<string>('UPI');
  const [formDescription, setFormDescription] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Custom Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('sortBy', sortBy);

      const [txRes, catRes] = await Promise.all([
        apiFetch<{ transactions: TransactionRecord[] }>(`/api/transactions?${params.toString()}`),
        apiFetch<{ categories: CategoryRecord[] }>('/api/categories'),
      ]);
      setTransactions(txRes.transactions);
      setCategories(catRes.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTypeFilter(fixedType ?? 'all');
    setCategoryFilter('all');
  }, [fixedType]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, categoryFilter, paymentFilter, startDate, endDate, sortBy, refreshSignal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAll();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (initialModalType && categories.length > 0) {
      openAddModal(initialModalType);
      onClearInitialModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModalType, categories.length]);

  function openAddModal(type: TransactionType) {
    setEditingTx(null);
    setFormType(type);
    const matching = categories.filter((c) => c.type === type);
    setFormCategory(matching[0]?.name || (type === 'income' ? 'Salary' : 'Food'));
    setFormTitle('');
    setFormAmount('');
    setFormDate(getTodayStr());
    setFormPayment(type === 'income' ? 'Bank Transfer' : 'UPI');
    setFormDescription('');
    setFormNotes('');
    setModalOpen(true);
  }

  function openEditModal(tx: TransactionRecord) {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormTitle(tx.title);
    setFormAmount(String(tx.amount));
    setFormCategory(tx.category);
    setFormDate(tx.date);
    setFormPayment(tx.paymentMethod);
    setFormDescription(tx.description);
    setFormNotes(tx.notes);
    setModalOpen(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: formTitle,
        amount: Number(formAmount),
        type: formType,
        category: formCategory,
        date: formDate,
        paymentMethod: formPayment,
        description: formDescription,
        notes: formNotes,
      };
      if (editingTx) {
        await apiFetch(`/api/transactions/${editingTx.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadAll();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      await loadAll();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete transaction.');
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName, type: newCatType }),
      });
      setNewCatName('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category.');
    }
  }

  async function handleDeleteCategory(id: string) {
    setError('');
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete category.');
    }
  }

  async function handleExportCsv() {
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
    if (search.trim()) params.set('search', search.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('sortBy', sortBy);
    try {
      await downloadAuthenticatedCsv(
        `/api/transactions/export?${params.toString()}`,
        `spendsense-transactions-${getTodayStr()}.csv`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export CSV.');
    }
  }

  const totalFilteredIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const totalFilteredExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const availableCategoriesForForm = categories.filter((c) => c.type === formType);
  const filterCategoryOptions = Array.from(
    new Set(
      categories
        .filter((c) => typeFilter === 'all' || c.type === typeFilter)
        .map((c) => c.name)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {fixedType === 'expense'
              ? 'Expenses Ledger'
              : fixedType === 'income'
                ? 'Income Ledger'
                : 'Expenses & Income Ledger'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {fixedType === 'expense'
              ? 'Record daily outflows, manage custom expense categories, filter, and export CSV'
              : fixedType === 'income'
                ? 'Track salary, freelancing, business, investments, and recurring income streams'
                : 'Add, search, filter, sort, manage custom categories, and export CSV records'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setNewCatType(fixedType ?? 'expense');
              setCatModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Categories
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {(!fixedType || fixedType === 'income') && (
            <button
              type="button"
              onClick={() => openAddModal('income')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#059669] hover:bg-[#047857] text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Income
            </button>
          )}
          {(!fixedType || fixedType === 'expense') && (
            <button
              type="button"
              onClick={() => openAddModal('expense')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B1222] hover:bg-slate-800 dark:bg-[#059669] dark:hover:bg-[#047857] text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {fixedType !== 'expense' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Income</p>
            <p className="font-mono-num text-xl font-bold text-[#059669] dark:text-emerald-400 mt-1">
              {formatCurrency(totalFilteredIncome, currency)}
            </p>
          </div>
        )}
        {fixedType !== 'income' && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Expenses</p>
            <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(totalFilteredExpenses, currency)}
            </p>
          </div>
        )}
        {fixedType && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Average Entry</p>
            <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(
                transactions.length > 0
                  ? (fixedType === 'income' ? totalFilteredIncome : totalFilteredExpenses) / transactions.length
                  : 0,
                currency
              )}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Matching Records</p>
          <p className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-1">
            {transactions.length}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!fixedType ? (
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 'expense', 'income'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tab);
                    setCategoryFilter('all');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All Entries' : tab === 'expense' ? 'Expenses' : 'Income'}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Showing {fixedType === 'income' ? 'income inflows' : 'expense outflows'}
            </span>
          )}

          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, category, or notes..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="all">All Categories</option>
            {filterCategoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            aria-label="Filter by payment method"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="all">All Payment Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Filter start date"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Filter end date"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort transactions"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="date_desc">Sort: Newest First</option>
            <option value="date_asc">Sort: Oldest First</option>
            <option value="amount_desc">Sort: Highest Amount</option>
            <option value="amount_asc">Sort: Lowest Amount</option>
            <option value="title_asc">Sort: Title A-Z</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No transactions match your current filters.
            </p>
            <button
              type="button"
              onClick={() => openAddModal('expense')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Add Your First Transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Title &amp; Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatShortDate(tx.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{tx.title}</p>
                      {(tx.description || tx.notes) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {tx.description || tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {tx.category}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {tx.paymentMethod}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          aria-label={`Edit ${tx.title}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-md cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          aria-label={`Delete ${tx.title}`}
                          className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingTx ? 'Edit Transaction' : `Add ${formType === 'income' ? 'Income' : 'Expense'}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFormType(t);
                      const first = categories.find((c) => c.type === t);
                      if (first) setFormCategory(first.name);
                    }}
                    className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
                      formType === t
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t === 'expense' ? 'Expense' : 'Income'}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={formType === 'income' ? 'Monthly Salary' : 'FreshBasket Groceries'}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="1500"
                    className="w-full px-3 py-2 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {availableCategoriesForForm.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPayment}
                    onChange={(e) => setFormPayment(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional summary"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional context..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingTx ? 'Save Changes' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Categories Modal */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Manage Categories
              </h2>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2 mb-5">
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name"
                className="flex-1 min-w-[140px] px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{cat.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">
                      &middot; {cat.type} {cat.isCustom ? '(custom)' : ''}
                    </span>
                  </div>
                  {cat.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
