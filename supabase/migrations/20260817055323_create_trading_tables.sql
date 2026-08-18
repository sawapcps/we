/*
# Create trading bot tables (single-tenant, no auth)

1. New Tables
- `bot_config` — single row storing the bot's configuration (mode, networks, thresholds)
- `trades` — every executed trade (buy/sell) with P&L tracking
- `bot_logs` — log entries from the bot engine (info, success, warning, error)
- `ai_analyses` — AI analysis results for tokens
- `wallet` — single row storing wallet state (address, encrypted key, assets, transactions)
- `bot_settings` — app settings (data sources, notifications)

2. Security
- Single-tenant app with no sign-in screen. All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because the data is intentionally shared/public.
- RLS enabled on every table.

3. Notes
- All tables use `gen_random_uuid()` for IDs.
- Timestamps default to `now()`.
- JSON columns store complex objects (config, assets, transactions, signals).
*/

CREATE TABLE IF NOT EXISTS bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_config" ON bot_config;
CREATE POLICY "anon_select_bot_config" ON bot_config FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_config" ON bot_config;
CREATE POLICY "anon_insert_bot_config" ON bot_config FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_config" ON bot_config;
CREATE POLICY "anon_update_bot_config" ON bot_config FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_config" ON bot_config;
CREATE POLICY "anon_delete_bot_config" ON bot_config FOR DELETE
  TO anon, authenticated USING (true);

-- ----

CREATE TABLE IF NOT EXISTS trades (
  id text PRIMARY KEY,
  timestamp bigint NOT NULL,
  network text NOT NULL,
  token_symbol text NOT NULL,
  token_address text NOT NULL,
  pair_address text NOT NULL,
  side text NOT NULL,
  amount_usd numeric NOT NULL,
  price_usd numeric NOT NULL,
  quantity numeric NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  pnl numeric,
  tx_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trades" ON trades;
CREATE POLICY "anon_select_trades" ON trades FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trades" ON trades;
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trades" ON trades;
CREATE POLICY "anon_update_trades" ON trades FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trades" ON trades;
CREATE POLICY "anon_delete_trades" ON trades FOR DELETE
  TO anon, authenticated USING (true);

-- ----

CREATE TABLE IF NOT EXISTS bot_logs (
  id text PRIMARY KEY,
  timestamp bigint NOT NULL,
  level text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_logs" ON bot_logs;
CREATE POLICY "anon_select_bot_logs" ON bot_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_logs" ON bot_logs;
CREATE POLICY "anon_insert_bot_logs" ON bot_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_logs" ON bot_logs;
CREATE POLICY "anon_delete_bot_logs" ON bot_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ----

CREATE TABLE IF NOT EXISTS ai_analyses (
  id text PRIMARY KEY,
  timestamp bigint NOT NULL,
  token_symbol text NOT NULL,
  network text NOT NULL,
  recommendation text NOT NULL,
  confidence integer NOT NULL,
  summary text NOT NULL,
  signals jsonb NOT NULL DEFAULT '[]',
  price_target numeric NOT NULL,
  risk_level text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_analyses" ON ai_analyses;
CREATE POLICY "anon_select_ai_analyses" ON ai_analyses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ai_analyses" ON ai_analyses;
CREATE POLICY "anon_insert_ai_analyses" ON ai_analyses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ai_analyses" ON ai_analyses;
CREATE POLICY "anon_delete_ai_analyses" ON ai_analyses FOR DELETE
  TO anon, authenticated USING (true);

-- ----

CREATE TABLE IF NOT EXISTS wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  encrypted_key text NOT NULL,
  assets jsonb NOT NULL DEFAULT '[]',
  transactions jsonb NOT NULL DEFAULT '[]',
  total_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallet" ON wallet;
CREATE POLICY "anon_select_wallet" ON wallet FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet" ON wallet;
CREATE POLICY "anon_insert_wallet" ON wallet FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallet" ON wallet;
CREATE POLICY "anon_update_wallet" ON wallet FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallet" ON wallet;
CREATE POLICY "anon_delete_wallet" ON wallet FOR DELETE
  TO anon, authenticated USING (true);

-- ----

CREATE TABLE IF NOT EXISTS bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bot_settings" ON bot_settings;
CREATE POLICY "anon_select_bot_settings" ON bot_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bot_settings" ON bot_settings;
CREATE POLICY "anon_insert_bot_settings" ON bot_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bot_settings" ON bot_settings;
CREATE POLICY "anon_update_bot_settings" ON bot_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bot_settings" ON bot_settings;
CREATE POLICY "anon_delete_bot_settings" ON bot_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_network ON trades (network);
CREATE INDEX IF NOT EXISTS idx_bot_logs_timestamp ON bot_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_timestamp ON ai_analyses (timestamp DESC);
