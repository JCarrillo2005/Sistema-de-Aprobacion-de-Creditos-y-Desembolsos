/**
 * Esquema idempotente (se ejecuta en cada arranque y en las pruebas).
 *
 * - Dinero en NUMERIC(14,2).
 * - Las reglas críticas están también como CHECK en la base de datos.
 * - audit_log es de solo inserción mediante un trigger.
 */
export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT,
  role  TEXT NOT NULL CHECK (role IN ('SOLICITANTE', 'ANALISTA'))
);

-- Migración idempotente para volúmenes creados antes de existir la columna.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS budget (
  id        SMALLINT PRIMARY KEY CHECK (id = 1),
  available NUMERIC(14,2) NOT NULL CHECK (available >= 0)
);

CREATE TABLE IF NOT EXISTS credit_requests (
  id                SERIAL PRIMARY KEY,
  applicant_id      TEXT NOT NULL REFERENCES users(id),
  applicant_name    TEXT NOT NULL,
  document_id       TEXT NOT NULL,
  monthly_income    NUMERIC(14,2) NOT NULL CHECK (monthly_income > 0),
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  term_months       SMALLINT NOT NULL CHECK (term_months IN (6, 12, 24, 36)),
  status            TEXT NOT NULL CHECK (status IN ('CREADA', 'EN_REVISION', 'APROBADA', 'RECHAZADA')),
  rejection_reason  TEXT,
  bureau_score      INTEGER,
  bureau_risk       TEXT,
  bureau_checked_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_within_debt_limit CHECK (amount <= monthly_income * 0.40),
  CONSTRAINT rejection_reason_required CHECK (
    status <> 'RECHAZADA' OR char_length(btrim(coalesce(rejection_reason, ''))) >= 15
  )
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_document
  ON credit_requests (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_requests_applicant
  ON credit_requests (applicant_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES credit_requests(id),
  actor_id    TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  comment     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_request ON audit_log (request_id);

CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción: no se permite % ', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

INSERT INTO users (id, name, email, role) VALUES
  ('sol-1', 'Ana López', 'ana.lopez@cauce.internal', 'SOLICITANTE'),
  ('sol-2', 'Luis Ramírez', 'luis.ramirez@cauce.internal', 'SOLICITANTE'),
  ('ana-1', 'Carla Méndez', 'carla.mendez@cauce.internal', 'ANALISTA')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email;

INSERT INTO budget (id, available) VALUES (1, 50000.00)
ON CONFLICT (id) DO NOTHING;
`;
