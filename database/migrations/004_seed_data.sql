-- ============================================================
-- EstimateOS Migration 004: Seed Data
-- Default super-admin tenant + admin user
-- Login: admin@estimateos.com / Admin@123!
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_role_id   UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'estimateos-demo') THEN
    INSERT INTO tenants (id, name, slug, plan, status, schema_name, storage_bucket, max_users, max_storage_gb, ai_token_limit)
    VALUES (uuid_generate_v4(), 'EstimateOS Demo', 'estimateos-demo', 'enterprise', 'active', 'tenant_demo', 'tenant-demo-files', 9999, 9999, 999999999)
    RETURNING id INTO v_tenant_id;

    INSERT INTO roles (id, tenant_id, name, is_system, permissions)
    VALUES (uuid_generate_v4(), v_tenant_id, 'company_admin', true,
      '["*","users:read","users:write","users:delete","roles:read","roles:write","projects:read","projects:write","projects:delete","estimations:read","estimations:write","estimations:approve","quotations:read","quotations:write","quotations:send","analytics:read","pricing:read","pricing:write","settings:read","settings:write"]'::jsonb)
    RETURNING id INTO v_role_id;

    INSERT INTO roles (tenant_id, name, is_system, permissions)
    VALUES
      (v_tenant_id, 'estimator', true, '["projects:read","projects:write","estimations:read","estimations:write","quotations:read","quotations:write","analytics:read","pricing:read"]'::jsonb),
      (v_tenant_id, 'viewer',    true, '["projects:read","estimations:read","quotations:read","analytics:read"]'::jsonb);

    -- Password hash for "Admin@123!" — bcrypt rounds=12
    INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, status)
    VALUES (v_tenant_id, v_role_id, 'admin@estimateos.com',
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3jp7ojC2re',
      'Super', 'Admin', 'active');

    RAISE NOTICE 'Seed data created. Login: admin@estimateos.com / Admin@123!';
  ELSE
    RAISE NOTICE 'Seed data already exists, skipping.';
  END IF;
END $$;
