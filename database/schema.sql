-- SpendSense AI — Recommended Production PostgreSQL / Supabase Setup Script
-- Compatible with Supabase and PostgreSQL 15+ (100% idempotent — safe to re-run)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Users (authentication credentials & reset tokens)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (display name & financial targets)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  monthly_income_target NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_income_target >= 0),
  primary_goal VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Settings (currency, theme, alert preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
  theme VARCHAR(16) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  budget_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories (default + user-defined income/expense categories)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('expense', 'income')),
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  color VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, type)
);

-- Transactions (expenses & income)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  type VARCHAR(16) NOT NULL CHECK (type IN ('expense', 'income')),
  category VARCHAR(80) NOT NULL,
  date DATE NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'UPI',
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  recurring_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budgets (overall & category-wise monthly limits)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  category VARCHAR(80) NOT NULL,
  limit_amount NUMERIC(14, 2) NOT NULL CHECK (limit_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month, category)
);

-- Savings Goals
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  target_date DATE NOT NULL,
  monthly_contribution NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_contribution >= 0),
  category VARCHAR(80) DEFAULT 'Personal savings',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Savings Contributions
CREATE TABLE IF NOT EXISTS savings_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  contributed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring Transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  type VARCHAR(16) NOT NULL CHECK (type IN ('expense', 'income')),
  category VARCHAR(80) NOT NULL,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'Bank Transfer',
  frequency VARCHAR(16) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  last_generated_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications (budget thresholds & goal milestones)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('info', 'warning', 'danger', 'success')),
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  dedupe_key VARCHAR(160),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key)
);

-- AI Recommendations (cached monthly financial insights)
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  summary TEXT NOT NULL,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  behavior_analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial Reports (saved AI monthly reports)
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  report_title VARCHAR(200) NOT NULL,
  report_markdown TEXT NOT NULL,
  metrics_snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR ANALYTICS & DASHBOARD QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_cat ON transactions(user_id, type, category);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_contrib_goal ON savings_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_contrib_user ON savings_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_transactions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rec_user_month ON ai_recommendations(user_id, month);
CREATE INDEX IF NOT EXISTS idx_reports_user_month ON financial_reports(user_id, month DESC);

-- ============================================================================
-- 3. AUTOMATIC updated_at TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON savings_goals;
CREATE TRIGGER trg_savings_goals_updated_at BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_updated_at ON recurring_transactions;
CREATE TRIGGER trg_recurring_updated_at BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (APPLIES AUTOMATICALLY ON SUPABASE)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS user_isolation_users ON users';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_profiles ON profiles';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_settings ON user_settings';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_categories ON categories';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_transactions ON transactions';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_budgets ON budgets';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_savings_goals ON savings_goals';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_savings_contrib ON savings_contributions';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_recurring ON recurring_transactions';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_notifications ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_ai_rec ON ai_recommendations';
    EXECUTE 'DROP POLICY IF EXISTS user_isolation_reports ON financial_reports';

    EXECUTE 'CREATE POLICY user_isolation_users ON users FOR ALL USING (auth.uid() = id)';
    EXECUTE 'CREATE POLICY user_isolation_profiles ON profiles FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_settings ON user_settings FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_categories ON categories FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_transactions ON transactions FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_budgets ON budgets FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_savings_goals ON savings_goals FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_savings_contrib ON savings_contributions FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_recurring ON recurring_transactions FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_notifications ON notifications FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_ai_rec ON ai_recommendations FOR ALL USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY user_isolation_reports ON financial_reports FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;
