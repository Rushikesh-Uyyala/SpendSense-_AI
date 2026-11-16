import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Response } from 'express';
import {
  aiRateLimiter,
  clearSessionCookie,
  hashPassword,
  hashToken,
  isValidEmail,
  requireAuth,
  setSessionCookie,
  validatePasswordStrength,
  verifyPassword,
  type AuthedRequest,
} from './src/server/auth.ts';
import {
  buildDefaultCategories,
  store,
  toPublicUser,
  type StoredUser,
} from './src/server/store.ts';
import {
  buildTransactionsCsv,
  computeAnalyticsSummary,
  computeBudgetUtilization,
  computeStatisticalForecast,
  enrichSavingsGoal,
  evaluateBudgetNotifications,
  evaluateSavingsMilestoneNotifications,
  getCurrentMonthKey,
  getDashboardSummary,
  getTodayDateStr,
  processAllDueRecurring,
  processDueRecurringForUser,
} from './src/server/financeService.ts';
import {
  chatWithFinancialAssistant,
  generateFinancialInsights,
  generateMonthlyFinancialReport,
} from './src/server/aiService.ts';
import type {
  CurrencyCode,
  RecurringFrequency,
  ThemeMode,
  TransactionRecord,
  TransactionType,
} from './src/shared/types.ts';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Helper to sanitize text inputs
function cleanText(val: unknown, maxLen = 240): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function parsePositiveAmount(val: unknown): number | null {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0 || num > 1_000_000_000) return null;
  return Math.round(num * 100) / 100;
}

function isValidDateStr(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

// Health check (returns storage mode without exposing secrets)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, databaseMode: store.getBackendMode() });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/register', (req, res) => {
  const fullName = cleanText(req.body?.fullName, 120);
  const email = cleanText(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const currencyInput = cleanText(req.body?.currency, 10).toUpperCase() as CurrencyCode;
  const currency: CurrencyCode = ['INR', 'USD', 'EUR', 'GBP'].includes(currencyInput) ? currencyInput : 'INR';

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    res.status(400).json({ error: pwError });
    return;
  }

  const existing = store.db.users.find((u) => u.email.toLowerCase() === email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const userId = crypto.randomUUID();
  const newUser: StoredUser = {
    id: userId,
    email,
    passwordHash: hashPassword(password),
    fullName,
    currency,
    theme: 'light',
    monthlyIncomeTarget: 0,
    primaryGoal: '',
    budgetAlertsEnabled: true,
    weeklyDigestEnabled: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.db.users.push(newUser);
  store.db.categories.push(...buildDefaultCategories(userId));
  store.save();

  const token = setSessionCookie(req, res, userId);
  res.status(201).json({ user: toPublicUser(newUser), token });
});

app.post('/api/auth/login', (req, res) => {
  const email = cleanText(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!isValidEmail(email) || !password) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const user = store.db.users.find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  processDueRecurringForUser(user.id);
  const token = setSessionCookie(req, res, user.id);
  res.json({ user: toPublicUser(user), token });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = store.db.users.find((u) => u.id === req.userId);
  if (!user) {
    clearSessionCookie(req, res);
    res.status(401).json({ error: 'Session expired.' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = cleanText(req.body?.email, 200).toLowerCase();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  const user = store.db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    // Return uniform response while avoiding enumeration in production; include demoResetCode only when user exists in local workspace
    res.json({
      message: 'If an account matches that email, a time-limited reset code has been generated.',
    });
    return;
  }

  const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  user.resetTokenHash = hashToken(rawCode);
  user.resetTokenExpiresAt = Date.now() + 15 * 60 * 1000;
  user.updatedAt = new Date().toISOString();
  store.save();

  res.json({
    message: 'A 15-minute password reset code has been issued.',
    resetCodePreview: rawCode,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const email = cleanText(req.body?.email, 200).toLowerCase();
  const resetCode = cleanText(req.body?.resetCode, 40).toUpperCase();
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!isValidEmail(email) || !resetCode) {
    res.status(400).json({ error: 'Email and reset code are required.' });
    return;
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    res.status(400).json({ error: pwError });
    return;
  }

  const user = store.db.users.find((u) => u.email.toLowerCase() === email);
  if (
    !user ||
    !user.resetTokenHash ||
    !user.resetTokenExpiresAt ||
    Date.now() > user.resetTokenExpiresAt ||
    user.resetTokenHash !== hashToken(resetCode)
  ) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  user.passwordHash = hashPassword(newPassword);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  user.updatedAt = new Date().toISOString();
  store.save();

  res.json({ message: 'Password updated successfully. You can now sign in.' });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  const user = store.db.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    res.status(400).json({ error: pwError });
    return;
  }

  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  store.save();
  res.json({ message: 'Password updated successfully.' });
});

// ============================================================================
// PROFILE & SETTINGS
// ============================================================================

app.put('/api/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = store.db.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (req.body?.fullName !== undefined) {
    const name = cleanText(req.body.fullName, 120);
    if (name.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    user.fullName = name;
  }

  if (req.body?.email !== undefined) {
    const email = cleanText(req.body.email, 200).toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const conflict = store.db.users.find((u) => u.id !== user.id && u.email.toLowerCase() === email);
    if (conflict) {
      res.status(409).json({ error: 'That email address is already in use.' });
      return;
    }
    user.email = email;
  }

  if (req.body?.currency !== undefined) {
    const cur = cleanText(req.body.currency, 10).toUpperCase() as CurrencyCode;
    if (!['INR', 'USD', 'EUR', 'GBP'].includes(cur)) {
      res.status(400).json({ error: 'Unsupported currency selection.' });
      return;
    }
    user.currency = cur;
  }

  if (req.body?.theme !== undefined) {
    const theme = cleanText(req.body.theme, 16) as ThemeMode;
    if (theme === 'light' || theme === 'dark') {
      user.theme = theme;
    }
  }

  if (req.body?.monthlyIncomeTarget !== undefined) {
    const target = Number(req.body.monthlyIncomeTarget);
    if (Number.isFinite(target) && target >= 0) {
      user.monthlyIncomeTarget = Math.round(target * 100) / 100;
    }
  }

  if (req.body?.primaryGoal !== undefined) {
    user.primaryGoal = cleanText(req.body.primaryGoal, 220);
  }

  if (typeof req.body?.budgetAlertsEnabled === 'boolean') {
    user.budgetAlertsEnabled = req.body.budgetAlertsEnabled;
  }
  if (typeof req.body?.weeklyDigestEnabled === 'boolean') {
    user.weeklyDigestEnabled = req.body.weeklyDigestEnabled;
  }

  user.updatedAt = new Date().toISOString();
  store.save();
  res.json({ user: toPublicUser(user) });
});

// ============================================================================
// DASHBOARD
// ============================================================================

app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
  const month = typeof req.query.month === 'string' ? req.query.month : getCurrentMonthKey();
  const summary = getDashboardSummary(req.userId!, month);
  res.json(summary);
});

// ============================================================================
// CATEGORIES
// ============================================================================

app.get('/api/categories', requireAuth, (req: AuthedRequest, res: Response) => {
  const categories = store.db.categories.filter((c) => c.userId === req.userId);
  res.json({ categories });
});

app.post('/api/categories', requireAuth, (req: AuthedRequest, res: Response) => {
  const name = cleanText(req.body?.name, 60);
  const type = req.body?.type === 'income' ? 'income' : 'expense';
  if (name.length < 2) {
    res.status(400).json({ error: 'Category name must be at least 2 characters.' });
    return;
  }
  const exists = store.db.categories.some(
    (c) => c.userId === req.userId && c.type === type && c.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    res.status(409).json({ error: 'This category already exists.' });
    return;
  }
  const cat = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    name,
    type: type as TransactionType,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };
  store.db.categories.push(cat);
  store.save();
  res.status(201).json({ category: cat });
});

app.delete('/api/categories/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const idx = store.db.categories.findIndex(
    (c) => c.id === req.params.id && c.userId === req.userId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  if (!store.db.categories[idx].isCustom) {
    res.status(400).json({ error: 'Default categories cannot be deleted.' });
    return;
  }
  store.db.categories.splice(idx, 1);
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// TRANSACTIONS (EXPENSES & INCOME)
// ============================================================================

function filterUserTransactions(userId: string, query: Record<string, unknown>): TransactionRecord[] {
  let rows = store.db.transactions.filter((t) => t.userId === userId);
  const type = typeof query.type === 'string' ? query.type : '';
  const category = typeof query.category === 'string' ? query.category : '';
  const paymentMethod = typeof query.paymentMethod === 'string' ? query.paymentMethod : '';
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
  const startDate = typeof query.startDate === 'string' ? query.startDate : '';
  const endDate = typeof query.endDate === 'string' ? query.endDate : '';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'date_desc';

  if (type === 'expense' || type === 'income') {
    rows = rows.filter((t) => t.type === type);
  }
  if (category && category !== 'all') {
    rows = rows.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }
  if (paymentMethod && paymentMethod !== 'all') {
    rows = rows.filter((t) => t.paymentMethod.toLowerCase() === paymentMethod.toLowerCase());
  }
  if (startDate) {
    rows = rows.filter((t) => t.date >= startDate);
  }
  if (endDate) {
    rows = rows.filter((t) => t.date <= endDate);
  }
  if (search) {
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.notes.toLowerCase().includes(search)
    );
  }

  rows.sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return a.date.localeCompare(b.date);
      case 'amount_desc':
        return b.amount - a.amount;
      case 'amount_asc':
        return a.amount - b.amount;
      case 'title_asc':
        return a.title.localeCompare(b.title);
      case 'date_desc':
      default:
        return b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt);
    }
  });

  return rows;
}

app.get('/api/transactions', requireAuth, (req: AuthedRequest, res: Response) => {
  processDueRecurringForUser(req.userId!);
  const rows = filterUserTransactions(req.userId!, req.query as Record<string, unknown>);
  res.json({ transactions: rows });
});

app.get('/api/transactions/export', requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = filterUserTransactions(req.userId!, req.query as Record<string, unknown>);
  const csv = buildTransactionsCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="spendsense-transactions-${getTodayDateStr()}.csv"`);
  res.send(csv);
});

app.post('/api/transactions', requireAuth, (req: AuthedRequest, res: Response) => {
  const title = cleanText(req.body?.title, 180);
  const amount = parsePositiveAmount(req.body?.amount);
  const type: TransactionType = req.body?.type === 'income' ? 'income' : 'expense';
  const category = cleanText(req.body?.category, 80);
  const date = req.body?.date;
  const paymentMethod = cleanText(req.body?.paymentMethod, 60) || 'UPI';
  const description = cleanText(req.body?.description, 400);
  const notes = cleanText(req.body?.notes, 400);

  if (title.length < 2) {
    res.status(400).json({ error: 'Transaction title must be at least 2 characters.' });
    return;
  }
  if (amount === null) {
    res.status(400).json({ error: 'Please enter a valid positive amount.' });
    return;
  }
  if (!category) {
    res.status(400).json({ error: 'Please select a category.' });
    return;
  }
  if (!isValidDateStr(date)) {
    res.status(400).json({ error: 'Please select a valid date (YYYY-MM-DD).' });
    return;
  }

  const nowIso = new Date().toISOString();
  const tx: TransactionRecord = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    title,
    amount,
    type,
    category,
    date,
    paymentMethod,
    description,
    notes,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.db.transactions.push(tx);
  store.save();

  if (type === 'expense') {
    evaluateBudgetNotifications(req.userId!, date.slice(0, 7));
  }

  res.status(201).json({ transaction: tx });
});

app.put('/api/transactions/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const tx = store.db.transactions.find(
    (t) => t.id === req.params.id && t.userId === req.userId
  );
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }

  const title = cleanText(req.body?.title ?? tx.title, 180);
  const amount = req.body?.amount !== undefined ? parsePositiveAmount(req.body.amount) : tx.amount;
  const type: TransactionType = req.body?.type === 'income' || req.body?.type === 'expense' ? req.body.type : tx.type;
  const category = cleanText(req.body?.category ?? tx.category, 80);
  const date = req.body?.date ?? tx.date;
  const paymentMethod = cleanText(req.body?.paymentMethod ?? tx.paymentMethod, 60) || 'UPI';
  const description = req.body?.description !== undefined ? cleanText(req.body.description, 400) : tx.description;
  const notes = req.body?.notes !== undefined ? cleanText(req.body.notes, 400) : tx.notes;

  if (title.length < 2 || amount === null || !category || !isValidDateStr(date)) {
    res.status(400).json({ error: 'Invalid transaction update fields.' });
    return;
  }

  tx.title = title;
  tx.amount = amount;
  tx.type = type;
  tx.category = category;
  tx.date = date;
  tx.paymentMethod = paymentMethod;
  tx.description = description;
  tx.notes = notes;
  tx.updatedAt = new Date().toISOString();
  store.save();

  if (type === 'expense') {
    evaluateBudgetNotifications(req.userId!, date.slice(0, 7));
  }

  res.json({ transaction: tx });
});

app.delete('/api/transactions/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const idx = store.db.transactions.findIndex(
    (t) => t.id === req.params.id && t.userId === req.userId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  store.db.transactions.splice(idx, 1);
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// BUDGETS
// ============================================================================

app.get('/api/budgets', requireAuth, (req: AuthedRequest, res: Response) => {
  const month =
    typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : getCurrentMonthKey();
  const budgets = computeBudgetUtilization(req.userId!, month);
  res.json({ month, budgets });
});

app.put('/api/budgets', requireAuth, (req: AuthedRequest, res: Response) => {
  const month =
    typeof req.body?.month === 'string' && /^\d{4}-\d{2}$/.test(req.body.month)
      ? req.body.month
      : getCurrentMonthKey();
  const category = cleanText(req.body?.category, 80);
  const limitAmount = Number(req.body?.limitAmount);

  if (!category || !Number.isFinite(limitAmount) || limitAmount <= 0) {
    res.status(400).json({ error: 'Valid category and positive budget limit are required.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const existing = store.db.budgets.find(
    (b) =>
      b.userId === req.userId &&
      b.month === month &&
      b.category.toLowerCase() === category.toLowerCase()
  );

  if (existing) {
    existing.limitAmount = Math.round(limitAmount * 100) / 100;
    existing.updatedAt = nowIso;
  } else {
    store.db.budgets.push({
      id: crypto.randomUUID(),
      userId: req.userId!,
      month,
      category,
      limitAmount: Math.round(limitAmount * 100) / 100,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  store.save();
  evaluateBudgetNotifications(req.userId!, month);
  res.json({ month, budgets: computeBudgetUtilization(req.userId!, month) });
});

app.delete('/api/budgets/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const idx = store.db.budgets.findIndex(
    (b) => b.id === req.params.id && b.userId === req.userId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Budget not found.' });
    return;
  }
  store.db.budgets.splice(idx, 1);
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// SAVINGS GOALS
// ============================================================================

app.get('/api/savings', requireAuth, (req: AuthedRequest, res: Response) => {
  const goals = store.db.savingsGoals
    .filter((g) => g.userId === req.userId)
    .map(enrichSavingsGoal);
  const contributions = store.db.savingsContributions
    .filter((c) => c.userId === req.userId)
    .sort((a, b) => b.contributedAt.localeCompare(a.contributedAt))
    .slice(0, 30);
  res.json({ goals, contributions });
});

app.post('/api/savings', requireAuth, (req: AuthedRequest, res: Response) => {
  const name = cleanText(req.body?.name, 150);
  const targetAmount = parsePositiveAmount(req.body?.targetAmount);
  const currentAmountRaw = Number(req.body?.currentAmount ?? 0);
  const currentAmount = Number.isFinite(currentAmountRaw) && currentAmountRaw >= 0 ? Math.round(currentAmountRaw * 100) / 100 : 0;
  const targetDate = req.body?.targetDate;
  const monthlyContributionRaw = Number(req.body?.monthlyContribution ?? 0);
  const monthlyContribution = Number.isFinite(monthlyContributionRaw) && monthlyContributionRaw >= 0 ? Math.round(monthlyContributionRaw * 100) / 100 : 0;
  const category = cleanText(req.body?.category, 80) || 'Personal savings';

  if (name.length < 2 || targetAmount === null || !isValidDateStr(targetDate)) {
    res.status(400).json({ error: 'Goal name, positive target amount, and valid target date are required.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const goal = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    name,
    targetAmount,
    currentAmount,
    targetDate,
    monthlyContribution,
    category,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.db.savingsGoals.push(goal);
  evaluateSavingsMilestoneNotifications(req.userId!, goal);
  store.save();

  res.status(201).json({ goal: enrichSavingsGoal(goal) });
});

app.put('/api/savings/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const goal = store.db.savingsGoals.find(
    (g) => g.id === req.params.id && g.userId === req.userId
  );
  if (!goal) {
    res.status(404).json({ error: 'Savings goal not found.' });
    return;
  }

  if (req.body?.name !== undefined) {
    const name = cleanText(req.body.name, 150);
    if (name.length >= 2) goal.name = name;
  }
  if (req.body?.targetAmount !== undefined) {
    const val = parsePositiveAmount(req.body.targetAmount);
    if (val !== null) goal.targetAmount = val;
  }
  if (req.body?.currentAmount !== undefined) {
    const val = Number(req.body.currentAmount);
    if (Number.isFinite(val) && val >= 0) goal.currentAmount = Math.round(val * 100) / 100;
  }
  if (isValidDateStr(req.body?.targetDate)) {
    goal.targetDate = req.body.targetDate;
  }
  if (req.body?.monthlyContribution !== undefined) {
    const val = Number(req.body.monthlyContribution);
    if (Number.isFinite(val) && val >= 0) goal.monthlyContribution = Math.round(val * 100) / 100;
  }
  if (req.body?.category !== undefined) {
    goal.category = cleanText(req.body.category, 80) || goal.category;
  }

  goal.updatedAt = new Date().toISOString();
  evaluateSavingsMilestoneNotifications(req.userId!, goal);
  store.save();
  res.json({ goal: enrichSavingsGoal(goal) });
});

app.post('/api/savings/:id/contribute', requireAuth, (req: AuthedRequest, res: Response) => {
  const goal = store.db.savingsGoals.find(
    (g) => g.id === req.params.id && g.userId === req.userId
  );
  if (!goal) {
    res.status(404).json({ error: 'Savings goal not found.' });
    return;
  }

  const amount = parsePositiveAmount(req.body?.amount);
  const note = cleanText(req.body?.note, 200);
  if (amount === null) {
    res.status(400).json({ error: 'Please enter a valid positive contribution amount.' });
    return;
  }

  const nowIso = new Date().toISOString();
  goal.currentAmount = Math.round((goal.currentAmount + amount) * 100) / 100;
  goal.updatedAt = nowIso;

  store.db.savingsContributions.unshift({
    id: crypto.randomUUID(),
    goalId: goal.id,
    userId: req.userId!,
    amount,
    contributedAt: getTodayDateStr(),
    note,
    createdAt: nowIso,
  });

  evaluateSavingsMilestoneNotifications(req.userId!, goal);
  store.save();
  res.json({ goal: enrichSavingsGoal(goal) });
});

app.delete('/api/savings/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const idx = store.db.savingsGoals.findIndex(
    (g) => g.id === req.params.id && g.userId === req.userId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Savings goal not found.' });
    return;
  }
  store.db.savingsGoals.splice(idx, 1);
  store.db.savingsContributions = store.db.savingsContributions.filter(
    (c) => !(c.goalId === req.params.id && c.userId === req.userId)
  );
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// RECURRING TRANSACTIONS
// ============================================================================

app.get('/api/recurring', requireAuth, (req: AuthedRequest, res: Response) => {
  const processedCount = processDueRecurringForUser(req.userId!);
  const items = store.db.recurringTransactions
    .filter((r) => r.userId === req.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ recurring: items, processedCount });
});

app.post('/api/recurring', requireAuth, (req: AuthedRequest, res: Response) => {
  const title = cleanText(req.body?.title, 180);
  const amount = parsePositiveAmount(req.body?.amount);
  const type: TransactionType = req.body?.type === 'income' ? 'income' : 'expense';
  const category = cleanText(req.body?.category, 80);
  const paymentMethod = cleanText(req.body?.paymentMethod, 60) || 'Bank Transfer';
  const frequencyRaw = cleanText(req.body?.frequency, 20) as RecurringFrequency;
  const frequency: RecurringFrequency = ['daily', 'weekly', 'monthly', 'yearly'].includes(frequencyRaw)
    ? frequencyRaw
    : 'monthly';
  const startDate = req.body?.startDate;
  const endDate = isValidDateStr(req.body?.endDate) ? req.body.endDate : '';

  if (title.length < 2 || amount === null || !category || !isValidDateStr(startDate)) {
    res.status(400).json({ error: 'Title, positive amount, category, and valid start date are required.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const rec = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    title,
    amount,
    type,
    category,
    paymentMethod,
    frequency,
    startDate,
    endDate,
    lastGeneratedDate: '',
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.db.recurringTransactions.push(rec);
  store.save();
  const processedCount = processDueRecurringForUser(req.userId!);

  res.status(201).json({ recurring: rec, processedCount });
});

app.put('/api/recurring/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const rec = store.db.recurringTransactions.find(
    (r) => r.id === req.params.id && r.userId === req.userId
  );
  if (!rec) {
    res.status(404).json({ error: 'Recurring schedule not found.' });
    return;
  }

  if (typeof req.body?.isActive === 'boolean') {
    rec.isActive = req.body.isActive;
  }
  if (req.body?.amount !== undefined) {
    const val = parsePositiveAmount(req.body.amount);
    if (val !== null) rec.amount = val;
  }
  if (req.body?.title !== undefined) {
    const title = cleanText(req.body.title, 180);
    if (title.length >= 2) rec.title = title;
  }
  rec.updatedAt = new Date().toISOString();
  store.save();
  res.json({ recurring: rec });
});

app.delete('/api/recurring/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const idx = store.db.recurringTransactions.findIndex(
    (r) => r.id === req.params.id && r.userId === req.userId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Recurring schedule not found.' });
    return;
  }
  store.db.recurringTransactions.splice(idx, 1);
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// STATISTICAL FORECASTING & ANALYTICS
// ============================================================================

app.get('/api/forecasting', requireAuth, (req: AuthedRequest, res: Response) => {
  processDueRecurringForUser(req.userId!);
  const forecast = computeStatisticalForecast(req.userId!);
  res.json(forecast);
});

app.get('/api/analytics', requireAuth, (req: AuthedRequest, res: Response) => {
  const today = getTodayDateStr();
  const defaultStart = `${today.slice(0, 7)}-01`;
  const startDate = isValidDateStr(req.query.startDate) ? req.query.startDate : defaultStart;
  const endDate = isValidDateStr(req.query.endDate) ? req.query.endDate : today;
  const summary = computeAnalyticsSummary(req.userId!, startDate, endDate);
  res.json(summary);
});

app.get('/api/analytics/export', requireAuth, (req: AuthedRequest, res: Response) => {
  const today = getTodayDateStr();
  const startDate = isValidDateStr(req.query.startDate) ? req.query.startDate : `${today.slice(0, 7)}-01`;
  const endDate = isValidDateStr(req.query.endDate) ? req.query.endDate : today;
  const rows = store.db.transactions
    .filter((t) => t.userId === req.userId && t.date >= startDate && t.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const csv = buildTransactionsCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="spendsense-report-${startDate}-to-${endDate}.csv"`);
  res.send(csv);
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
  const notifications = store.db.notifications
    .filter((n) => n.userId === req.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
  res.json({ notifications });
});

app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res: Response) => {
  const notif = store.db.notifications.find(
    (n) => n.id === req.params.id && n.userId === req.userId
  );
  if (!notif) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  notif.isRead = true;
  store.save();
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
  for (const n of store.db.notifications) {
    if (n.userId === req.userId) {
      n.isRead = true;
    }
  }
  store.save();
  res.json({ ok: true });
});

// ============================================================================
// AI FINANCIAL ASSISTANT
// ============================================================================

app.get('/api/ai/insights', requireAuth, (req: AuthedRequest, res: Response) => {
  const latest = store.db.aiRecommendations.find((r) => r.userId === req.userId) || null;
  res.json({ insight: latest });
});

app.post('/api/ai/insights', requireAuth, aiRateLimiter, async (req: AuthedRequest, res: Response) => {
  try {
    const month = typeof req.body?.month === 'string' ? req.body.month : getCurrentMonthKey();
    const insight = await generateFinancialInsights(req.userId!, month);
    res.json({ insight });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to generate AI insights.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/chat', requireAuth, aiRateLimiter, async (req: AuthedRequest, res: Response) => {
  const message = cleanText(req.body?.message, 1000);
  const historyRaw = Array.isArray(req.body?.history) ? req.body.history : [];
  if (message.length < 2) {
    res.status(400).json({ error: 'Please enter a question for the AI financial assistant.' });
    return;
  }
  const history = historyRaw
    .filter(
      (h: unknown): h is { role: 'user' | 'model'; text: string } =>
        Boolean(h) &&
        typeof h === 'object' &&
        ((h as { role?: string }).role === 'user' || (h as { role?: string }).role === 'model') &&
        typeof (h as { text?: unknown }).text === 'string'
    )
    .slice(-10);

  try {
    const result = await chatWithFinancialAssistant(req.userId!, message, history);
    res.json(result);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'AI assistant request failed.';
    res.status(500).json({ error: errMsg });
  }
});

app.get('/api/ai/reports', requireAuth, (req: AuthedRequest, res: Response) => {
  const reports = store.db.financialReports
    .filter((r) => r.userId === req.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  res.json({ reports });
});

app.post('/api/ai/monthly-report', requireAuth, aiRateLimiter, async (req: AuthedRequest, res: Response) => {
  try {
    const month = typeof req.body?.month === 'string' ? req.body.month : getCurrentMonthKey();
    const report = await generateMonthlyFinancialReport(req.userId!, month);
    res.json({ report });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unable to generate monthly financial report.';
    res.status(500).json({ error: errMsg });
  }
});

// Safe error handler for API routes
app.use('/api', (err: unknown, _req: AuthedRequest, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// Safe source archive download route
app.get('/download/spendsense-ai-source.zip', (_req, res) => {
  const archivePath = path.resolve(process.cwd(), 'public', 'downloads', 'spendsense-ai-source.zip');
  if (!fs.existsSync(archivePath)) {
    res.status(404).json({ error: 'Source archive not found.' });
    return;
  }
  res.setHeader('Content-Type', 'application/zip');
  res.download(archivePath, 'spendsense-ai-source.zip');
});

// ============================================================================
// SERVER STARTUP & VITE / STATIC SERVING
// ============================================================================

async function startServer() {
  await store.init();
  // Run initial recurring check and schedule hourly checks
  processAllDueRecurring();
  const recurringTimer = setInterval(() => {
    try {
      processAllDueRecurring();
    } catch (err) {
      console.error('Recurring scheduler error:', err);
    }
  }, 60 * 60 * 1000);
  recurringTimer.unref();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SpendSense AI running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
