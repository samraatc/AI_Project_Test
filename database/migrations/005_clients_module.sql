-- ============================================================
-- EstimateOS — Migration 005: Clients — standalone migration
-- (Client table already in 002, this adds indexes if missing)
-- ============================================================

-- Ensure client indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_clients_tenant  ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_email   ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status  ON clients(status);

-- Add trigger if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_clients') THEN
    CREATE TRIGGER set_updated_at_clients
      BEFORE UPDATE ON clients
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END
$$;
