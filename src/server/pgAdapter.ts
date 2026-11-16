import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema, StoredUser } from './store.ts';
import type {
  AIRecommendationPayload,
  BudgetRecord,
  CategoryRecord,
  CurrencyCode,
  FinancialReportRecord,
  NotificationRecord,
  NotificationSeverity,
  RecurringFrequency,
  RecurringTransactionRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
  ThemeMode,
  TransactionRecord,
  TransactionType,
} from '../shared/types.ts';

type RemoteMode = 'postgres' | 'supabase' | 'local';

function resolveSupabaseUrl(): string {
  const explicit = process.env.SUPABASE_URL?.trim();
  if (explicit) return explicit;
  const projectId = process.env.SUPABASE_PROJECT_ID?.trim();
  if (projectId) return `https://${projectId}.supabase.co`;
  return '';
}

function resolveSupabaseSecretKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ''
  );
}

export class RemoteDatabaseAdapter {
  private mode: RemoteMode = 'local';
  private pool: Pool | null = null;
  private supabase: SupabaseClient | null = null;
  private syncQueue: Promise<void> = Promise.resolve();

  public getMode(): RemoteMode {
    return this.mode;
  }

  public async init(seedFactory: () => DatabaseSchema): Promise<DatabaseSchema | null> {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const supabaseUrl = resolveSupabaseUrl();
    const supabaseSecret = resolveSupabaseSecretKey();

    if (databaseUrl) {
      try {
        this.pool = new Pool({
          connectionString: databaseUrl,
          ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        });
        this.pool.on('error', (err) => {
          console.error('PostgreSQL pool idle error:', err);
        });

        await this.ensurePostgresSchema();
        const loaded = await this.loadFromPostgres();
        this.mode = 'postgres';

        if (loaded.users.length === 0) {
          const seeded = seedFactory();
          await this.syncToPostgres(seeded);
          console.log('Connected to Supabase PostgreSQL (seeded initial demo workspace).');
          return seeded;
        }
        console.log(`Connected to Supabase PostgreSQL (${loaded.users.length} users loaded).`);
        return loaded;
      } catch (err) {
        console.error('Failed to initialize PostgreSQL via DATABASE_URL, falling back to local store:', err);
        this.pool = null;
        this.mode = 'local';
        return null;
      }
    }

    if (supabaseUrl && supabaseSecret) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseSecret, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const loaded = await this.loadFromSupabase();
        this.mode = 'supabase';

        if (loaded.users.length === 0) {
          const seeded = seedFactory();
          await this.syncToSupabase(seeded);
          console.log('Connected to Supabase REST Admin API (seeded initial demo workspace).');
          return seeded;
        }
        console.log(`Connected to Supabase REST Admin API (${loaded.users.length} users loaded).`);
        return loaded;
      } catch (err) {
        console.error('Failed to initialize Supabase Admin client, falling back to local store:', err);
        this.supabase = null;
        this.mode = 'local';
        return null;
      }
    }

    if (supabaseUrl && !supabaseSecret) {
      console.warn(
        'SUPABASE_URL is set without SUPABASE_SECRET_KEY; running in local persistence mode because RLS blocks writes from publishable keys.'
      );
    }

    this.mode = 'local';
    return null;
  }

  public enqueueSync(snapshot: DatabaseSchema): void {
    if (this.mode === 'local') return;
    const cloned = JSON.parse(JSON.stringify(snapshot)) as DatabaseSchema;
    this.syncQueue = this.syncQueue
      .then(async () => {
        if (this.mode === 'postgres') {
          await this.syncToPostgres(cloned);
        } else if (this.mode === 'supabase') {
          await this.syncToSupabase(cloned);
        }
      })
      .catch((err) => {
        console.error('Remote database sync error:', err);
      });
  }

  private async ensurePostgresSchema(): Promise<void> {
    if (!this.pool) return;
    const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await this.pool.query(sql);
    }
  }

  private async loadFromPostgres(): Promise<DatabaseSchema> {
    if (!this.pool) throw new Error('Pool not initialized');

    const [
      usersRes,
      profilesRes,
      settingsRes,
      categoriesRes,
      txRes,
      budgetsRes,
      goalsRes,
      contribRes,
      recRes,
      notifRes,
      aiRecRes,
      reportsRes,
    ] = await Promise.all([
      this.pool.query('SELECT * FROM users'),
      this.pool.query('SELECT * FROM profiles'),
      this.pool.query('SELECT * FROM user_settings'),
      this.pool.query('SELECT * FROM categories'),
      this.pool.query('SELECT * FROM transactions'),
      this.pool.query('SELECT * FROM budgets'),
      this.pool.query('SELECT * FROM savings_goals'),
      this.pool.query('SELECT * FROM savings_contributions'),
      this.pool.query('SELECT * FROM recurring_transactions'),
      this.pool.query('SELECT * FROM notifications'),
      this.pool.query('SELECT * FROM ai_recommendations'),
      this.pool.query('SELECT * FROM financial_reports'),
    ]);

    return this.assembleSchema({
      users: usersRes.rows,
      profiles: profilesRes.rows,
      settings: settingsRes.rows,
      categories: categoriesRes.rows,
      transactions: txRes.rows,
      budgets: budgetsRes.rows,
      goals: goalsRes.rows,
      contributions: contribRes.rows,
      recurring: recRes.rows,
      notifications: notifRes.rows,
      aiRecommendations: aiRecRes.rows,
      reports: reportsRes.rows,
    });
  }

  private async loadFromSupabase(): Promise<DatabaseSchema> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    const [
      usersRes,
      profilesRes,
      settingsRes,
      categoriesRes,
      txRes,
      budgetsRes,
      goalsRes,
      contribRes,
      recRes,
      notifRes,
      aiRecRes,
      reportsRes,
    ] = await Promise.all([
      this.supabase.from('users').select('*'),
      this.supabase.from('profiles').select('*'),
      this.supabase.from('user_settings').select('*'),
      this.supabase.from('categories').select('*'),
      this.supabase.from('transactions').select('*'),
      this.supabase.from('budgets').select('*'),
      this.supabase.from('savings_goals').select('*'),
      this.supabase.from('savings_contributions').select('*'),
      this.supabase.from('recurring_transactions').select('*'),
      this.supabase.from('notifications').select('*'),
      this.supabase.from('ai_recommendations').select('*'),
      this.supabase.from('financial_reports').select('*'),
    ]);

    for (const r of [
      usersRes,
      profilesRes,
      settingsRes,
      categoriesRes,
      txRes,
      budgetsRes,
      goalsRes,
      contribRes,
      recRes,
      notifRes,
      aiRecRes,
      reportsRes,
    ]) {
      if (r.error) throw new Error(r.error.message);
    }

    return this.assembleSchema({
      users: usersRes.data ?? [],
      profiles: profilesRes.data ?? [],
      settings: settingsRes.data ?? [],
      categories: categoriesRes.data ?? [],
      transactions: txRes.data ?? [],
      budgets: budgetsRes.data ?? [],
      goals: goalsRes.data ?? [],
      contributions: contribRes.data ?? [],
      recurring: recRes.data ?? [],
      notifications: notifRes.data ?? [],
      aiRecommendations: aiRecRes.data ?? [],
      reports: reportsRes.data ?? [],
    });
  }

  private assembleSchema(raw: {
    users: Array<Record<string, unknown>>;
    profiles: Array<Record<string, unknown>>;
    settings: Array<Record<string, unknown>>;
    categories: Array<Record<string, unknown>>;
    transactions: Array<Record<string, unknown>>;
    budgets: Array<Record<string, unknown>>;
    goals: Array<Record<string, unknown>>;
    contributions: Array<Record<string, unknown>>;
    recurring: Array<Record<string, unknown>>;
    notifications: Array<Record<string, unknown>>;
    aiRecommendations: Array<Record<string, unknown>>;
    reports: Array<Record<string, unknown>>;
  }): DatabaseSchema {
    const profileMap = new Map(raw.profiles.map((p) => [String(p.user_id), p]));
    const settingsMap = new Map(raw.settings.map((s) => [String(s.user_id), s]));

    const users: StoredUser[] = raw.users.map((u) => {
      const uid = String(u.id);
      const prof = profileMap.get(uid);
      const set = settingsMap.get(uid);
      return {
        id: uid,
        email: String(u.email),
        passwordHash: String(u.password_hash),
        fullName: String(prof?.full_name ?? 'User'),
        currency: (String(set?.currency ?? 'INR') as CurrencyCode),
        theme: (String(set?.theme ?? 'light') as ThemeMode),
        monthlyIncomeTarget: Number(prof?.monthly_income_target ?? 0),
        primaryGoal: String(prof?.primary_goal ?? ''),
        budgetAlertsEnabled: Boolean(set?.budget_alerts_enabled ?? true),
        weeklyDigestEnabled: Boolean(set?.weekly_digest_enabled ?? true),
        resetTokenHash: u.reset_token_hash ? String(u.reset_token_hash) : undefined,
        resetTokenExpiresAt: u.reset_token_expires_at ? new Date(String(u.reset_token_expires_at)).getTime() : undefined,
        createdAt: new Date(String(u.created_at)).toISOString(),
        updatedAt: new Date(String(u.updated_at)).toISOString(),
      };
    });

    const categories: CategoryRecord[] = raw.categories.map((c) => ({
      id: String(c.id),
      userId: String(c.user_id),
      name: String(c.name),
      type: String(c.type) as TransactionType,
      isCustom: Boolean(c.is_custom),
      createdAt: new Date(String(c.created_at)).toISOString(),
    }));

    const transactions: TransactionRecord[] = raw.transactions.map((t) => ({
      id: String(t.id),
      userId: String(t.user_id),
      title: String(t.title),
      amount: Number(t.amount),
      type: String(t.type) as TransactionType,
      category: String(t.category),
      date: String(t.date).slice(0, 10),
      paymentMethod: String(t.payment_method),
      description: String(t.description ?? ''),
      notes: String(t.notes ?? ''),
      recurringId: t.recurring_id ? String(t.recurring_id) : undefined,
      createdAt: new Date(String(t.created_at)).toISOString(),
      updatedAt: new Date(String(t.updated_at)).toISOString(),
    }));

    const budgets: BudgetRecord[] = raw.budgets.map((b) => ({
      id: String(b.id),
      userId: String(b.user_id),
      month: String(b.month),
      category: String(b.category),
      limitAmount: Number(b.limit_amount),
      createdAt: new Date(String(b.created_at)).toISOString(),
      updatedAt: new Date(String(b.updated_at)).toISOString(),
    }));

    const savingsGoals: SavingsGoalRecord[] = raw.goals.map((g) => ({
      id: String(g.id),
      userId: String(g.user_id),
      name: String(g.name),
      targetAmount: Number(g.target_amount),
      currentAmount: Number(g.current_amount),
      targetDate: String(g.target_date).slice(0, 10),
      monthlyContribution: Number(g.monthly_contribution),
      category: String(g.category ?? 'Personal savings'),
      createdAt: new Date(String(g.created_at)).toISOString(),
      updatedAt: new Date(String(g.updated_at)).toISOString(),
    }));

    const savingsContributions: SavingsContributionRecord[] = raw.contributions.map((c) => ({
      id: String(c.id),
      goalId: String(c.goal_id),
      userId: String(c.user_id),
      amount: Number(c.amount),
      contributedAt: String(c.contributed_at).slice(0, 10),
      note: String(c.note ?? ''),
      createdAt: new Date(String(c.created_at)).toISOString(),
    }));

    const recurringTransactions: RecurringTransactionRecord[] = raw.recurring.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      title: String(r.title),
      amount: Number(r.amount),
      type: String(r.type) as TransactionType,
      category: String(r.category),
      paymentMethod: String(r.payment_method),
      frequency: String(r.frequency) as RecurringFrequency,
      startDate: String(r.start_date).slice(0, 10),
      endDate: r.end_date ? String(r.end_date).slice(0, 10) : '',
      lastGeneratedDate: r.last_generated_date ? String(r.last_generated_date).slice(0, 10) : '',
      isActive: Boolean(r.is_active),
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    }));

    const notifications: NotificationRecord[] = raw.notifications.map((n) => ({
      id: String(n.id),
      userId: String(n.user_id),
      kind: String(n.kind),
      severity: String(n.severity) as NotificationSeverity,
      title: String(n.title),
      message: String(n.message),
      dedupeKey: String(n.dedupe_key ?? ''),
      isRead: Boolean(n.is_read),
      createdAt: new Date(String(n.created_at)).toISOString(),
    }));

    const aiRecommendations = raw.aiRecommendations.map((a) => ({
      id: String(a.id),
      userId: String(a.user_id),
      month: String(a.month),
      generatedAt: new Date(String(a.created_at)).toISOString(),
      headline: String(a.summary),
      recommendations: (a.recommendations_json as AIRecommendationPayload['recommendations']) ?? [],
      behaviorAnalysis: (a.behavior_analysis_json as AIRecommendationPayload['behaviorAnalysis']),
      disclaimer:
        'Informational guidance generated from your recorded SpendSense AI transactions. This is not certified financial, tax, or investment advice.',
    }));

    const financialReports: FinancialReportRecord[] = raw.reports.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      month: String(r.month),
      title: String(r.report_title),
      sections: (r.metrics_snapshot_json as FinancialReportRecord['sections']),
      disclaimer: String(r.report_markdown),
      createdAt: new Date(String(r.created_at)).toISOString(),
    }));

    return {
      users,
      categories,
      transactions,
      budgets,
      savingsGoals,
      savingsContributions,
      recurringTransactions,
      notifications,
      aiRecommendations,
      financialReports,
    };
  }

  private async syncToPostgres(db: DatabaseSchema): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const u of db.users) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, reset_token_hash, reset_token_expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             reset_token_hash = EXCLUDED.reset_token_hash,
             reset_token_expires_at = EXCLUDED.reset_token_expires_at,
             updated_at = EXCLUDED.updated_at`,
          [
            u.id,
            u.email,
            u.passwordHash,
            u.resetTokenHash ?? null,
            u.resetTokenExpiresAt ? new Date(u.resetTokenExpiresAt).toISOString() : null,
            u.createdAt,
            u.updatedAt,
          ]
        );
        await client.query(
          `INSERT INTO profiles (user_id, full_name, monthly_income_target, primary_goal, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             monthly_income_target = EXCLUDED.monthly_income_target,
             primary_goal = EXCLUDED.primary_goal,
             updated_at = EXCLUDED.updated_at`,
          [u.id, u.fullName, u.monthlyIncomeTarget, u.primaryGoal, u.createdAt, u.updatedAt]
        );
        await client.query(
          `INSERT INTO user_settings (user_id, currency, theme, budget_alerts_enabled, weekly_digest_enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             currency = EXCLUDED.currency,
             theme = EXCLUDED.theme,
             budget_alerts_enabled = EXCLUDED.budget_alerts_enabled,
             weekly_digest_enabled = EXCLUDED.weekly_digest_enabled,
             updated_at = EXCLUDED.updated_at`,
          [u.id, u.currency, u.theme, u.budgetAlertsEnabled, u.weeklyDigestEnabled, u.updatedAt]
        );
      }

      // Sync child tables with delete-missing + upsert
      const syncIds = async (table: string, ids: string[]) => {
        if (ids.length === 0) {
          await client.query(`DELETE FROM ${table}`);
        } else {
          await client.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::uuid[]))`, [ids]);
        }
      };

      await syncIds('categories', db.categories.map((c) => c.id));
      for (const c of db.categories) {
        await client.query(
          `INSERT INTO categories (id, user_id, name, type, is_custom, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.userId, c.name, c.type, c.isCustom, c.createdAt]
        );
      }

      await syncIds('transactions', db.transactions.map((t) => t.id));
      for (const t of db.transactions) {
        await client.query(
          `INSERT INTO transactions (id, user_id, title, amount, type, category, date, payment_method, description, notes, recurring_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             amount = EXCLUDED.amount,
             type = EXCLUDED.type,
             category = EXCLUDED.category,
             date = EXCLUDED.date,
             payment_method = EXCLUDED.payment_method,
             description = EXCLUDED.description,
             notes = EXCLUDED.notes,
             updated_at = EXCLUDED.updated_at`,
          [
            t.id,
            t.userId,
            t.title,
            t.amount,
            t.type,
            t.category,
            t.date,
            t.paymentMethod,
            t.description,
            t.notes,
            t.recurringId ?? null,
            t.createdAt,
            t.updatedAt,
          ]
        );
      }

      await syncIds('budgets', db.budgets.map((b) => b.id));
      for (const b of db.budgets) {
        await client.query(
          `INSERT INTO budgets (id, user_id, month, category, limit_amount, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             limit_amount = EXCLUDED.limit_amount,
             updated_at = EXCLUDED.updated_at`,
          [b.id, b.userId, b.month, b.category, b.limitAmount, b.createdAt, b.updatedAt]
        );
      }

      await syncIds('savings_goals', db.savingsGoals.map((g) => g.id));
      for (const g of db.savingsGoals) {
        await client.query(
          `INSERT INTO savings_goals (id, user_id, name, target_amount, current_amount, target_date, monthly_contribution, category, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             target_amount = EXCLUDED.target_amount,
             current_amount = EXCLUDED.current_amount,
             target_date = EXCLUDED.target_date,
             monthly_contribution = EXCLUDED.monthly_contribution,
             category = EXCLUDED.category,
             updated_at = EXCLUDED.updated_at`,
          [
            g.id,
            g.userId,
            g.name,
            g.targetAmount,
            g.currentAmount,
            g.targetDate,
            g.monthlyContribution,
            g.category,
            g.createdAt,
            g.updatedAt,
          ]
        );
      }

      await syncIds('savings_contributions', db.savingsContributions.map((c) => c.id));
      for (const c of db.savingsContributions) {
        await client.query(
          `INSERT INTO savings_contributions (id, goal_id, user_id, amount, contributed_at, note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.goalId, c.userId, c.amount, c.contributedAt, c.note, c.createdAt]
        );
      }

      await syncIds('recurring_transactions', db.recurringTransactions.map((r) => r.id));
      for (const r of db.recurringTransactions) {
        await client.query(
          `INSERT INTO recurring_transactions (id, user_id, title, amount, type, category, payment_method, frequency, start_date, end_date, last_generated_date, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             amount = EXCLUDED.amount,
             is_active = EXCLUDED.is_active,
             last_generated_date = EXCLUDED.last_generated_date,
             updated_at = EXCLUDED.updated_at`,
          [
            r.id,
            r.userId,
            r.title,
            r.amount,
            r.type,
            r.category,
            r.paymentMethod,
            r.frequency,
            r.startDate,
            r.endDate || null,
            r.lastGeneratedDate || null,
            r.isActive,
            r.createdAt,
            r.updatedAt,
          ]
        );
      }

      await syncIds('notifications', db.notifications.map((n) => n.id));
      for (const n of db.notifications) {
        await client.query(
          `INSERT INTO notifications (id, user_id, kind, severity, title, message, dedupe_key, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET is_read = EXCLUDED.is_read`,
          [n.id, n.userId, n.kind, n.severity, n.title, n.message, n.dedupeKey || null, n.isRead, n.createdAt]
        );
      }

      await syncIds('ai_recommendations', db.aiRecommendations.map((a) => a.id));
      for (const a of db.aiRecommendations) {
        await client.query(
          `INSERT INTO ai_recommendations (id, user_id, month, summary, recommendations_json, behavior_analysis_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            a.id,
            a.userId,
            a.month,
            a.headline,
            JSON.stringify(a.recommendations),
            JSON.stringify(a.behaviorAnalysis),
            a.generatedAt,
          ]
        );
      }

      await syncIds('financial_reports', db.financialReports.map((r) => r.id));
      for (const r of db.financialReports) {
        await client.query(
          `INSERT INTO financial_reports (id, user_id, month, report_title, report_markdown, metrics_snapshot_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.userId, r.month, r.title, r.disclaimer, JSON.stringify(r.sections), r.createdAt]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async syncToSupabase(db: DatabaseSchema): Promise<void> {
    if (!this.supabase) return;

    if (db.users.length > 0) {
      const uRes = await this.supabase.from('users').upsert(
        db.users.map((u) => ({
          id: u.id,
          email: u.email,
          password_hash: u.passwordHash,
          reset_token_hash: u.resetTokenHash ?? null,
          reset_token_expires_at: u.resetTokenExpiresAt ? new Date(u.resetTokenExpiresAt).toISOString() : null,
          created_at: u.createdAt,
          updated_at: u.updatedAt,
        }))
      );
      if (uRes.error) throw new Error(`users upsert failed: ${uRes.error.message}`);

      const pRes = await this.supabase.from('profiles').upsert(
        db.users.map((u) => ({
          user_id: u.id,
          full_name: u.fullName,
          monthly_income_target: u.monthlyIncomeTarget,
          primary_goal: u.primaryGoal,
          created_at: u.createdAt,
          updated_at: u.updatedAt,
        })),
        { onConflict: 'user_id' }
      );
      if (pRes.error) throw new Error(`profiles upsert failed: ${pRes.error.message}`);

      const sRes = await this.supabase.from('user_settings').upsert(
        db.users.map((u) => ({
          user_id: u.id,
          currency: u.currency,
          theme: u.theme,
          budget_alerts_enabled: u.budgetAlertsEnabled,
          weekly_digest_enabled: u.weeklyDigestEnabled,
          updated_at: u.updatedAt,
        })),
        { onConflict: 'user_id' }
      );
      if (sRes.error) throw new Error(`user_settings upsert failed: ${sRes.error.message}`);
    }

    const syncTable = async (table: string, rows: Array<Record<string, unknown>>) => {
      const { data: existing, error: selErr } = await this.supabase!.from(table).select('id');
      if (selErr) throw new Error(`${table} select failed: ${selErr.message}`);
      const keepIds = new Set(rows.map((r) => String(r.id)));
      const deleteIds = (existing ?? []).map((e) => String(e.id)).filter((id) => !keepIds.has(id));
      if (deleteIds.length > 0) {
        const { error: delErr } = await this.supabase!.from(table).delete().in('id', deleteIds);
        if (delErr) throw new Error(`${table} delete failed: ${delErr.message}`);
      }
      if (rows.length > 0) {
        const { error: upErr } = await this.supabase!.from(table).upsert(rows);
        if (upErr) throw new Error(`${table} upsert failed: ${upErr.message}`);
      }
    };

    await syncTable(
      'categories',
      db.categories.map((c) => ({
        id: c.id,
        user_id: c.userId,
        name: c.name,
        type: c.type,
        is_custom: c.isCustom,
        created_at: c.createdAt,
      }))
    );

    await syncTable(
      'transactions',
      db.transactions.map((t) => ({
        id: t.id,
        user_id: t.userId,
        title: t.title,
        amount: t.amount,
        type: t.type,
        category: t.category,
        date: t.date,
        payment_method: t.paymentMethod,
        description: t.description,
        notes: t.notes,
        recurring_id: t.recurringId ?? null,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      }))
    );

    await syncTable(
      'budgets',
      db.budgets.map((b) => ({
        id: b.id,
        user_id: b.userId,
        month: b.month,
        category: b.category,
        limit_amount: b.limitAmount,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
      }))
    );

    await syncTable(
      'savings_goals',
      db.savingsGoals.map((g) => ({
        id: g.id,
        user_id: g.userId,
        name: g.name,
        target_amount: g.targetAmount,
        current_amount: g.currentAmount,
        target_date: g.targetDate,
        monthly_contribution: g.monthlyContribution,
        category: g.category,
        created_at: g.createdAt,
        updated_at: g.updatedAt,
      }))
    );

    await syncTable(
      'savings_contributions',
      db.savingsContributions.map((c) => ({
        id: c.id,
        goal_id: c.goalId,
        user_id: c.userId,
        amount: c.amount,
        contributed_at: c.contributedAt,
        note: c.note,
        created_at: c.createdAt,
      }))
    );

    await syncTable(
      'recurring_transactions',
      db.recurringTransactions.map((r) => ({
        id: r.id,
        user_id: r.userId,
        title: r.title,
        amount: r.amount,
        type: r.type,
        category: r.category,
        payment_method: r.paymentMethod,
        frequency: r.frequency,
        start_date: r.startDate,
        end_date: r.endDate || null,
        last_generated_date: r.lastGeneratedDate || null,
        is_active: r.isActive,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }))
    );

    await syncTable(
      'notifications',
      db.notifications.map((n) => ({
        id: n.id,
        user_id: n.userId,
        kind: n.kind,
        severity: n.severity,
        title: n.title,
        message: n.message,
        dedupe_key: n.dedupeKey || null,
        is_read: n.isRead,
        created_at: n.createdAt,
      }))
    );

    await syncTable(
      'ai_recommendations',
      db.aiRecommendations.map((a) => ({
        id: a.id,
        user_id: a.userId,
        month: a.month,
        summary: a.headline,
        recommendations_json: a.recommendations,
        behavior_analysis_json: a.behaviorAnalysis,
        created_at: a.generatedAt,
      }))
    );

    await syncTable(
      'financial_reports',
      db.financialReports.map((r) => ({
        id: r.id,
        user_id: r.userId,
        month: r.month,
        report_title: r.title,
        report_markdown: r.disclaimer,
        metrics_snapshot_json: r.sections,
        created_at: r.createdAt,
      }))
    );
  }
}
