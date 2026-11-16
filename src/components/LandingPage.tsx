import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Moon,
  ShieldCheck,
  Sun,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ThemeMode } from '../shared/types';

interface LandingPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onDemoSignIn: () => Promise<void>;
  demoLoading: boolean;
}

const FAQS = [
  {
    q: 'How does SpendSense AI keep my financial records private?',
    a: 'Every account uses scrypt password hashing, signed HTTP-only session cookies, and user-scoped database queries. Your income, expenses, budgets, and reports are isolated strictly to your authenticated account.',
  },
  {
    q: 'How are the AI financial recommendations calculated?',
    a: 'SpendSense AI reads your actual recorded income, expense categories, monthly budgets, and savings goals from the database before generating guidance. Every suggestion shows its arithmetic basis and never invents transactions.',
  },
  {
    q: 'Are financial forecasts guaranteed predictions?',
    a: 'No. The forecasting module uses weighted moving averages, damped linear trend regression, and a ±1σ historical variance band. It clearly states its assumptions and limitations whenever your data history is short.',
  },
  {
    q: 'Can I track INR as well as USD, EUR, or GBP?',
    a: 'Yes. INR (₹) is configured as the default currency, and you can switch between INR, USD, EUR, and GBP at any time from your Profile & Settings page.',
  },
  {
    q: 'How do budget threshold alerts work?',
    a: 'Whenever an expense is recorded, SpendSense AI recalculates your monthly overall and category utilization and issues in-app alerts at 50%, 75%, 90%, and 100%+ exceeded thresholds.',
  },
  {
    q: 'Can I export my transactions and financial reports?',
    a: 'Yes. Both the Transactions ledger and Analytics report views support one-click CSV exports filtered by your selected date range and criteria.',
  },
];

export function LandingPage({
  theme,
  onToggleTheme,
  onOpenAuth,
  onDemoSignIn,
  demoLoading,
}: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [aiImgFailed, setAiImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            SpendSense AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#ai-assistant" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              AI Assistant
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <p className="text-xs font-medium tracking-wide text-blue-600 dark:text-blue-400">
                  Personal Finance &middot; Monthly Budgeting &middot; Grounded AI Analysis
                </p>
                <h1
                  className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                >
                  Take Control of Your Money with SpendSense AI.
                </h1>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  Track every rupee of income and daily spending, enforce smart monthly budget thresholds, plan goal contributions, forecast next month&apos;s cashflow, and ask an AI financial assistant grounded strictly in your real records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onDemoSignIn}
                  disabled={demoLoading}
                  className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {demoLoading ? 'Loading Demo...' : 'Explore Live Demo'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_finance_workspace_1794751811831.jpg"
                    alt="Minimalist architectural workspace displaying SpendSense AI financial analytics"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 text-slate-600 dark:text-slate-300">
                    <Wallet className="w-10 h-10 text-blue-600 mb-3" />
                    <p className="font-display font-semibold text-slate-900 dark:text-white">SpendSense AI Workspace</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Preview Strip */}
          <div className="mt-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Interactive Workspace Preview &middot; Default Currency INR
                </p>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  Real-time cashflow, budget alerts, and savings pace in one workspace
                </h2>
              </div>
              <button
                type="button"
                onClick={onDemoSignIn}
                disabled={demoLoading}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {demoLoading ? 'Opening workspace...' : 'Open Interactive Dashboard →'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Income</p>
                <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1">₹78,500</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Salary + Freelancing</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Expenses</p>
                <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1">₹35,519</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">10 recorded entries</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Savings</p>
                <p className="font-mono-num text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">₹42,981</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">54.8% retention rate</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Budget Utilization</p>
                <p className="font-mono-num text-2xl font-semibold text-blue-600 dark:text-blue-400 mt-1">78.9%</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">75% threshold active</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Asymmetric Bento Grid */}
        <section id="features" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Core Platform Modules</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Built for daily discipline and long-term financial clarity.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-7 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">01. Expense &amp; Income Ledger</p>
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Full transaction history with custom categories and instant CSV export
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    Record income across Salary, Freelancing, Business, Scholarship, or Investments, and track expenses across 13 predefined categories plus custom categories you create. Filter by date range, payment method, or keyword and export clean CSV statements anytime.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div>UPI, Card &amp; Bank filters</div>
                  <div>Custom categories</div>
                  <div>Instant CSV download</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-7 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">02. Smart Monthly Budgets</p>
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Automated 50%, 75%, 90%, and 100% spending alerts
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Set an overall monthly ceiling alongside category-level limits. Visual progress bars and real-time threshold notifications warn you before overspending happens.
                  </p>
                </div>
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Dynamic utilization tracking
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-7 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">03. Statistical Forecasting</p>
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Weighted trend projection with explicit assumptions
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Estimates next month&apos;s expected expenses, category trajectories, and savings capacity using weighted historical averages and ±1σ variance bands.
                  </p>
                </div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Transparent statistical bands
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-7 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">04. Savings Goals &amp; Recurring Automation</p>
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Target-date savings pacing alongside duplicate-safe recurring bills
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    Plan milestones for a laptop, emergency reserve, education, or travel with automatic monthly contribution recommendations. Schedule recurring rent, salary, internet, and subscriptions without duplicate entries.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div>Goal milestone alerts</div>
                  <div>Monthly pace math</div>
                  <div>Idempotent bill scheduler</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Financial Assistant Section */}
        <section id="ai-assistant" className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-5">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {!aiImgFailed ? (
                  <img
                    src="/src/assets/images/ai_clarity_prism_1794751812828.jpg"
                    alt="Architectural frosted glass and slate composition representing financial clarity"
                    referrerPolicy="no-referrer"
                    onError={() => setAiImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-900">
                    <TrendingUp className="w-10 h-10 text-blue-600 mb-3" />
                    <p className="font-display font-semibold">Grounded AI Engine</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                  AI Financial Assistant &middot; Grounded in Your Database
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Ask real questions about your spending, budgets, and savings targets.
                </h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Instead of generic money tips, SpendSense AI inspects your actual monthly income, category totals, month-over-month changes, repeated expenses, and goal deadlines before answering.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Example Grounded Recommendation</span>
                  <span>Calculation Basis Visible</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  &ldquo;Your Shopping expenses reached ₹4,750 this month (95% of your ₹5,000 limit). Trimming Shopping by ₹1,250 next month increases your monthly surplus from ₹42,981 to ₹44,231, accelerating your Laptop goal by 3 weeks.&rdquo;
                </p>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Never fabricates figures</span>
                  <span>&middot;</span>
                  <span>Generates structured monthly reports</span>
                  <span>&middot;</span>
                  <span>Explains data limitations</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works & Benefits */}
        <section id="how-it-works" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">How It Works</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                From daily transactions to actionable monthly plans in three steps.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <p className="font-mono-num text-sm font-semibold text-blue-600 dark:text-blue-400">01</p>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Log income, expenses &amp; recurring bills
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Add daily entries in seconds or configure monthly rent, salary, and subscriptions once so they post automatically without duplicates.
                </p>
              </div>
              <div className="space-y-3">
                <p className="font-mono-num text-sm font-semibold text-blue-600 dark:text-blue-400">02</p>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Set category budgets &amp; savings targets
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Define monthly limits per category and target dates for laptops, emergency reserves, or travel with automatic monthly pace calculations.
                </p>
              </div>
              <div className="space-y-3">
                <p className="font-mono-num text-sm font-semibold text-blue-600 dark:text-blue-400">03</p>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Review forecasts &amp; AI monthly reports
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Inspect statistical expense forecasts, chat with the AI assistant on affordability questions, and generate monthly review reports.
                </p>
              </div>
            </div>

            <div className="mt-12 pt-10 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Strict Per-User Isolation</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Authenticated sessions protect all financial tables and AI queries.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Zero Hardcoded Dashboards</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Every chart, alert, and metric recalculates dynamically from persisted records.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">INR Default &amp; Multi-Currency</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Built for Indian Rupee (₹) workflows with USD, EUR, and GBP support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-4xl mx-auto px-6 py-16 lg:py-20">
          <div className="mb-10">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Frequently Asked Questions</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Clear answers on privacy, forecasting, and AI guidance.
            </h2>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left py-2 cursor-pointer"
                  >
                    <span className="font-display text-base font-medium text-slate-900 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="pt-2 pb-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-base font-bold text-slate-900 dark:text-white">SpendSense AI</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Personal finance analytics, budgeting, and AI guidance for informational use.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
