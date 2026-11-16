import { CURRENCY_META, type CurrencyCode } from '../shared/types';

const TOKEN_KEY = 'spendsense_auth_token';
let memoryAuthToken: string | null = null;

export function setAuthToken(token: string | undefined | null): void {
  memoryAuthToken = token || null;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }
}

export function getAuthToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) memoryAuthToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  const meta = CURRENCY_META[currency] || CURRENCY_META.INR;
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—';
  const dt = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMonthTitle(monthStr: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getCurrentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const errMessage = (data && typeof data.error === 'string' && data.error) || `Request failed (${res.status})`;
    throw new Error(errMessage);
  }
  return data as T;
}

export async function downloadAuthenticatedCsv(url: string, fallbackFilename: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
