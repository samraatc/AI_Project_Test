-- ============================================================
-- EstimateOS Migration 002: Clients, Projects, Files
-- ============================================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  company     VARCHAR(255),
  email       VARCHAR(255),
  phone       VARCHAR(50),
  address     TEXT,
  country     VARCHAR(100),
  currency    VARCHAR(10) NOT NULL DEFAULT 'USD',
  tax_number  VARCHAR(100),
  notes       TEXT,
  status      VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_email  ON clients(email);
CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id),
  created_by       UUID,
  assigned_to      UUID,
  name             VARCHAR(500) NOT NULL,
  reference_number VARCHAR(100),
  description      TEXT,
  industry         VARCHAR(100),
  project_type     VARCHAR(100),
  location         VARCHAR(255),
  currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
  status           VARCHAR(50) NOT NULL DEFAULT 'draft',
  start_date       DATE,
  end_date         DATE,
  deadline         DATE,
  ai_status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  ai_processed_at  TIMESTAMPTZ,
  ai_confidence    DECIMAL(5,2),
  ai_summary       TEXT,
  storage_path     VARCHAR(500),
  tags             TEXT[] NOT NULL DEFAULT '{}',
  metadata         JSONB NOT NULL DEFAULT '{}',
  cloned_from      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_tenant  ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_ai      ON projects(ai_status);
CREATE INDEX IF NOT EXISTS idx_projects_name    ON projects USING gin(name gin_trgm_ops);
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Project files
CREATE TABLE IF NOT EXISTS project_files (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by    UUID,
  original_name  VARCHAR(500) NOT NULL,
  storage_key    VARCHAR(1000) NOT NULL UNIQUE,
  mime_type      VARCHAR(255),
  size_bytes     BIGINT,
  file_type      VARCHAR(50),
  ocr_status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  ocr_text       TEXT,
  parse_status   VARCHAR(50) NOT NULL DEFAULT 'pending',
  parsed_data    JSONB,
  embedded       BOOLEAN NOT NULL DEFAULT false,
  embedded_at    TIMESTAMPTZ,
  chunk_count    INTEGER NOT NULL DEFAULT 0,
  version        INTEGER NOT NULL DEFAULT 1,
  parent_file_id UUID,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_tenant  ON project_files(tenant_id);
