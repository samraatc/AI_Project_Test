-- ============================================================
-- EstimateOS Migration 003: Estimations, Quotations, Approvals, Pricing
-- ============================================================

-- Estimations
CREATE TABLE IF NOT EXISTS estimations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by          UUID,
  locked_by           UUID,
  title               VARCHAR(500) NOT NULL DEFAULT 'Estimation v1',
  version_number      INTEGER NOT NULL DEFAULT 1,
  status              VARCHAR(50) NOT NULL DEFAULT 'draft',
  material_cost       DECIMAL(16,2) NOT NULL DEFAULT 0,
  steel_cost          DECIMAL(16,2) NOT NULL DEFAULT 0,
  labor_cost          DECIMAL(16,2) NOT NULL DEFAULT 0,
  equipment_cost      DECIMAL(16,2) NOT NULL DEFAULT 0,
  transport_cost      DECIMAL(16,2) NOT NULL DEFAULT 0,
  overhead_cost       DECIMAL(16,2) NOT NULL DEFAULT 0,
  overhead_pct        DECIMAL(6,2) NOT NULL DEFAULT 8,
  subtotal            DECIMAL(16,2) NOT NULL DEFAULT 0,
  tax_amount          DECIMAL(16,2) NOT NULL DEFAULT 0,
  tax_pct             DECIMAL(6,2) NOT NULL DEFAULT 5,
  profit_margin_pct   DECIMAL(6,2) NOT NULL DEFAULT 15,
  profit_amount       DECIMAL(16,2) NOT NULL DEFAULT 0,
  final_total         DECIMAL(16,2) NOT NULL DEFAULT 0,
  currency            VARCHAR(10) NOT NULL DEFAULT 'USD',
  ai_confidence       DECIMAL(5,2),
  ai_model_used       VARCHAR(100),
  ai_prompt_tokens    INTEGER DEFAULT 0,
  ai_output_tokens    INTEGER DEFAULT 0,
  ai_raw_response     JSONB,
  ai_risk_analysis    JSONB NOT NULL DEFAULT '[]',
  ai_missing_items    JSONB NOT NULL DEFAULT '[]',
  ai_recommendations  JSONB NOT NULL DEFAULT '[]',
  notes               TEXT,
  is_locked           BOOLEAN NOT NULL DEFAULT false,
  locked_at           TIMESTAMPTZ,
  parent_id           UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_est_project ON estimations(project_id);
CREATE INDEX IF NOT EXISTS idx_est_tenant  ON estimations(tenant_id);
CREATE TRIGGER set_updated_at_est BEFORE UPDATE ON estimations FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Estimation items
CREATE TABLE IF NOT EXISTS estimation_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimation_id   UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pricing_item_id UUID,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  category        VARCHAR(100) NOT NULL,
  code            VARCHAR(100),
  description     VARCHAR(1000) NOT NULL,
  specification   TEXT,
  quantity        DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit            VARCHAR(50) NOT NULL DEFAULT 'unit',
  unit_rate       DECIMAL(14,4) NOT NULL DEFAULT 0,
  discount_pct    DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(16,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  source          VARCHAR(50) NOT NULL DEFAULT 'ai',
  ai_confidence   DECIMAL(5,2),
  is_flagged      BOOLEAN NOT NULL DEFAULT false,
  flag_reason     TEXT,
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_items_estimation ON estimation_items(estimation_id);
CREATE TRIGGER set_updated_at_items BEFORE UPDATE ON estimation_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimation_id    UUID NOT NULL REFERENCES estimations(id),
  project_id       UUID NOT NULL REFERENCES projects(id),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by       UUID,
  quote_number     VARCHAR(50) NOT NULL UNIQUE,
  title            VARCHAR(500) NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'draft',
  scope_summary    TEXT,
  terms_conditions TEXT,
  validity_days    INTEGER NOT NULL DEFAULT 30,
  valid_until      DATE,
  subtotal         DECIMAL(16,2) NOT NULL DEFAULT 0,
  tax_amount       DECIMAL(16,2) NOT NULL DEFAULT 0,
  final_total      DECIMAL(16,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
  pdf_storage_key  VARCHAR(1000),
  sent_at          TIMESTAMPTZ,
  sent_to_email    VARCHAR(255),
  signed_at        TIMESTAMPTZ,
  ai_generated     BOOLEAN NOT NULL DEFAULT true,
  template_id      VARCHAR(100),
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant  ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotations(project_id);
CREATE TRIGGER set_updated_at_quotes BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Approval workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimation_id UUID NOT NULL REFERENCES estimations(id) ON DELETE CASCADE,
  submitted_by  UUID,
  current_step  INTEGER NOT NULL DEFAULT 1,
  total_steps   INTEGER NOT NULL DEFAULT 1,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_tenant ON approval_workflows(tenant_id);

-- Approval steps
CREATE TABLE IF NOT EXISTS approval_steps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  comments    TEXT,
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing items
CREATE TABLE IF NOT EXISTS pricing_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category    VARCHAR(100) NOT NULL,
  code        VARCHAR(100),
  name        VARCHAR(500) NOT NULL,
  unit        VARCHAR(50) NOT NULL,
  unit_rate   DECIMAL(14,4) NOT NULL,
  currency    VARCHAR(10) NOT NULL DEFAULT 'USD',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  valid_from  DATE,
  valid_until DATE,
  source      VARCHAR(100),
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricing_tenant   ON pricing_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_category ON pricing_items(category);
CREATE TRIGGER set_updated_at_pricing BEFORE UPDATE ON pricing_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
