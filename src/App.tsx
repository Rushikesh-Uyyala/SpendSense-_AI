import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Check,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  SlidersHorizontal,
  Sun,
  Target,
  X,
} from 'lucide-react';
import {
  apiFetch,
  clearAuthToken,
  formatMonthTitle,
  formatShortDate,
  getCurrentMonthStr,
} from './lib/format';
import type {
  NotificationRecord,
  ThemeMode,
  TransactionType,
  UserPublic,
} from './shared/types';
import { AuthScreen } from './components/AuthScreen';
import { AddTransactionModal } from './components/AddTransactionModal';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { BudgetsView } from './components/views/BudgetsView';
import { SavingsView } from './components/views/SavingsView';
import { SavingsVaultsView } from './components/views/SavingsVaultsView';
import { ReportsView } from './components/views/ReportsView';
import { AIAssistantView } from './components/views/AIAssistantView';
import { ProfileView } from './components/views/ProfileView';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'expenses', label: 'Expenses', icon: ArrowDownRight },
  { id: 'income', label: 'Income', icon: ArrowUpRight },
  { id: 'budgets', label: 'Budgets', icon: SlidersHorizontal },
  { id: 'goals', label: 'Financial Goals', icon: Target },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'ai-advisor', label: 'AI Advisor', icon: Bot },
] as const;

export default function App() {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [booting, setBooting] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [globalAddOpen, setGlobalAddOpen] = useState(false);
  const [globalAddType, setGlobalAddType] = useState<TransactionType>('expense');
  const [quickAddType, setQuickAddType] = useState<TransactionType | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await apiFetch<{ user: UserPublic }>('/api/auth/me');
        setUser(res.user);
        setTheme(res.user.theme);
      } catch {
        clearAuthToken();
        setUser(null);
      } finally {
        setBooting(false);
      }
    }
    checkSession();
  }, []);

  async function loadNotifications() {
    if (!user) return;
    try {
      const res = await apiFetch<{ notifications: NotificationRecord[] }>('/api/notifications');
      setNotifications(res.notifications);
    } catch {
      // Ignore transient notification fetch error
    }
  }

  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setNotifications([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshSignal]);

  async function handleToggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      try {
        const res = await apiFetch<{ user: UserPublic }>('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ theme: next }),
        });
        setUser(res.user);
      } catch {
        // Keep local toggle even if network temporarily fails
      }
    }
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
      setUser(null);
      setActiveTab('overview');
      setNotifOpen(false);
    }
  }

  async function handleMarkRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function handleMarkAllRead() {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function triggerDataRefresh() {
    setRefreshSignal((s) => s + 1);
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm">
        Loading SpendSense AI...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSuccess={(authedUser) => {
          setUser(authedUser);
          setTheme(authedUser.theme);
          setActiveTab('overview');
        }}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeNavMeta =
    activeTab === 'profile'
      ? { id: 'profile', label: 'Profile & Settings' }
      : NAV_ITEMS.find((i) => i.id === activeTab) || NAV_ITEMS[0];

  const SidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div>
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-7 h-7 rounded-md bg-[#059669] flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            S
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
            SpendSense AI
          </span>
        </div>

        <nav className="p-3 space-y-1" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0B1222] text-white dark:bg-[#059669]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab('profile');
            setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-slate-100 dark:bg-slate-800'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
          title="Open Profile & Settings"
        >
          {!avatarFailed ? (
            <img
              src="/src/assets/images/avatar_executive_user_1794751814297.jpg"
              alt={user.fullName}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#059669] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.fullName}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-60 h-full">{SidebarContent}</div>
          <div
            className="flex-1 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">SpendSense AI</span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span className="font-display font-bold text-slate-900 dark:text-white truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <label htmlFor="workspace-month" className="sr-only">
                Select month
              </label>
              <input
                id="workspace-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                title={formatMonthTitle(selectedMonth)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Toggle Light or Dark mode"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Notifications ({unreadCount} unread)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs font-medium text-[#059669] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        aria-label="Close notifications"
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        No notifications yet. Budget threshold warnings and goal milestones appear here automatically.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 flex items-start justify-between gap-3 ${
                            n.isRead ? 'opacity-65' : 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {formatShortDate(n.createdAt)}
                            </p>
                          </div>
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(n.id)}
                              aria-label="Mark notification as read"
                              className="p-1 text-[#059669] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded cursor-pointer shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setGlobalAddType(activeTab === 'income' ? 'income' : 'expense');
                setGlobalAddOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#059669] hover:bg-[#047857] text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Transaction
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <DashboardView
              month={selectedMonth}
              currency={user.currency}
              dark={theme === 'dark'}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenQuickAdd={(type) => {
                setGlobalAddType(type);
                setGlobalAddOpen(true);
              }}
              refreshSignal={refreshSignal}
            />
          )}

          {activeTab === 'expenses' && (
            <TransactionsView
              currency={user.currency}
              fixedType="expense"
              refreshSignal={refreshSignal}
              initialModalType={quickAddType}
              onClearInitialModal={() => setQuickAddType(null)}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'income' && (
            <TransactionsView
              currency={user.currency}
              fixedType="income"
              refreshSignal={refreshSignal}
              initialModalType={quickAddType}
              onClearInitialModal={() => setQuickAddType(null)}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsView
              currency={user.currency}
              refreshSignal={refreshSignal}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'goals' && (
            <SavingsView
              currency={user.currency}
              refreshSignal={refreshSignal}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'savings' && (
            <SavingsVaultsView
              currency={user.currency}
              month={selectedMonth}
              onNavigate={(tab) => setActiveTab(tab)}
              onDataChanged={triggerDataRefresh}
              refreshSignal={refreshSignal}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              currency={user.currency}
              dark={theme === 'dark'}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'ai-advisor' && <AIAssistantView currency={user.currency} />}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                setTheme(updated.theme);
              }}
            />
          )}
        </main>
      </div>

      {globalAddOpen && (
        <AddTransactionModal
          currency={user.currency}
          initialType={globalAddType}
          onClose={() => setGlobalAddOpen(false)}
          onSaved={triggerDataRefresh}
        />
      )}
    </div>
  );
}
