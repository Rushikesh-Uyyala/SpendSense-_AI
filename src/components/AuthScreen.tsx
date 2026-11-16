import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/format';
import type { CurrencyCode, UserPublic } from '../shared/types';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthScreenProps {
  onSuccess: (user: UserPublic) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [resetCode, setResetCode] = useState('');
  const [resetPreview, setResetPreview] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next: AuthMode) {
    setError('');
    setNotice('');
    setMode(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await apiFetch<{ user: UserPublic; token?: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res.token) setAuthToken(res.token);
        onSuccess(res.user);
      } else if (mode === 'register') {
        const res = await apiFetch<{ user: UserPublic; token?: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password, currency }),
        });
        if (res.token) setAuthToken(res.token);
        onSuccess(res.user);
      } else if (mode === 'forgot') {
        const res = await apiFetch<{ message: string; resetCodePreview?: string }>(
          '/api/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          }
        );
        setNotice(res.message);
        if (res.resetCodePreview) {
          setResetPreview(res.resetCodePreview);
          setResetCode(res.resetCodePreview);
        }
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, resetCode, newPassword: password }),
        });
        setNotice(res.message);
        setPassword('');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: UserPublic; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'demo@spendsense.ai', password: 'Demo@1234' }),
      });
      if (res.token) setAuthToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in to demo account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[820px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
        {/* Left Navy Brand Panel */}
        <div className="md:col-span-5 bg-[#0B1222] text-white p-8 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[#059669] flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
                S
              </div>
              <span className="font-display text-base font-bold tracking-tight text-white">
                SpendSense AI
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-2xl font-bold leading-snug tracking-tight text-white">
                Disciplined cash flow, budgets, and savings in one ledger.
              </h1>
              <p className="text-xs leading-relaxed text-slate-300">
                Track every rupee with tabular precision, enforce monthly category caps, monitor high-yield vaults, and consult an AI advisor grounded in your actual numbers.
              </p>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
              <span>PostgreSQL-backed financial ledger schema</span>
            </div>
            <p className="font-mono text-[11px] text-slate-400">
              Demo: demo@spendsense.ai / Demo@1234
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-7 p-7 sm:p-9 bg-white dark:bg-slate-900 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {mode === 'login' && 'Sign in to your workspace'}
              {mode === 'register' && 'Create your workspace'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set a new password'}
            </h2>

            {(mode === 'login' || mode === 'register') && (
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-4 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-xs text-emerald-700 dark:text-emerald-300">
              {notice}
              {resetPreview && (
                <div className="mt-1 font-mono-num font-semibold">
                  Verification Code: {resetPreview}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aarav Mehta"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>

            {mode === 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Reset Code
                </label>
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="8-character code"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-num rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#059669]"
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#059669]"
                >
                  <option value="INR">Indian Rupee (INR ₹)</option>
                  <option value="USD">US Dollar (USD $)</option>
                  <option value="EUR">Euro (EUR €)</option>
                  <option value="GBP">British Pound (GBP £)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-[#0B1222] hover:bg-slate-800 dark:bg-[#059669] dark:hover:bg-[#047857] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              <span>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'register'
                      ? 'Create Account'
                      : mode === 'forgot'
                        ? 'Send Reset Code'
                        : 'Update Password'}
              </span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {(mode === 'login' || mode === 'register') && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-[#047857] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                Continue with Demo Account (Aarav Mehta)
              </button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-semibold text-[#059669] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
