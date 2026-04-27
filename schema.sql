-- ═══════════════════════════════════════════════════════════
-- ORIA — Schéma Supabase · Mémoire persistante
-- Colle ce SQL dans : Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ── Table utilisatrices ───────────────────────────────────
CREATE TABLE IF NOT EXISTS oria_users (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  prenom              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  derniere_connexion  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Table sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oria_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES oria_users(id) ON DELETE CASCADE,
  module          TEXT DEFAULT 'confiance',
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  resume          TEXT,        -- Résumé généré par Claude en fin de session
  message_count   INT DEFAULT 0
);

-- ── Table messages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oria_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID REFERENCES oria_sessions(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES oria_users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  module      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Index pour les performances ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_session  ON oria_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user     ON oria_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON oria_sessions(user_id, started_at DESC);

-- ── Fin ───────────────────────────────────────────────────
-- Vérifie que les tables sont créées : Table Editor → oria_users / oria_sessions / oria_messages
