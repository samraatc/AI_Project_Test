-- ============================================================
-- EstimateOS Migration 004: Seed Data
-- Login: admin@estimateos.com / Admin@123!
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_role_id   UUID;
BEGIN

  -- ── Create tenant if not exists ───────────────────────────
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'estimateos-demo') THEN
    INSERT INTO tenants (
      id, name, slug, plan, status,
      schema_name, storage_bucket,
      max_users, max_storage_gb, ai_token_limit
    ) VALUES (
      uuid_generate_v4(),
      'EstimateOS Demo', 'estimateos-demo', 'enterprise', 'active',
      'tenant_demo', 'tenant-demo-files',
      9999, 9999, 999999999
    ) RETURNING id INTO v_tenant_id;
  ELSE
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'estimateos-demo';
  END IF;

  -- ── Create company_admin role if not exists ───────────────
  IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = v_tenant_id AND name = 'company_admin') THEN
    INSERT INTO roles (id, tenant_id, name, is_system, permissions)
    VALUES (
      uuid_generate_v4(), v_tenant_id, 'company_admin', true,
      '["*","users:read","users:write","users:delete","roles:read","roles:write","projects:read","projects:write","projects:delete","estimations:read","estimations:write","estimations:approve","quotations:read","quotations:write","quotations:send","analytics:read","pricing:read","pricing:write","settings:read","settings:write"]'::jsonb
    ) RETURNING id INTO v_role_id;
  ELSE
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = 'company_admin';
  END IF;

  -- ── Create other roles if not exists ─────────────────────
  IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = v_tenant_id AND name = 'estimator') THEN
    INSERT INTO roles (tenant_id, name, is_system, permissions)
    VALUES (v_tenant_id, 'estimator', true,
      '["projects:read","projects:write","estimations:read","estimations:write","quotations:read","quotations:write","analytics:read","pricing:read"]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = v_tenant_id AND name = 'viewer') THEN
    INSERT INTO roles (tenant_id, name, is_system, permissions)
    VALUES (v_tenant_id, 'viewer', true,
      '["projects:read","estimations:read","quotations:read","analytics:read"]'::jsonb);
  END IF;

  -- ── Create or UPDATE admin user ───────────────────────────
  -- Password: Admin@123!  (bcrypt hash verified with bcryptjs)
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@estimateos.com') THEN
    INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, status)
    VALUES (
      v_tenant_id, v_role_id,
      'admin@estimateos.com',
      'a$12$oPzlLcjBoLl01CxTxpXpMeTB.s0t3bCVlVJi/qL9XOseTb6S5LFDa',
      'Super', 'Admin', 'active'
    );
    RAISE NOTICE 'Created: admin@estimateos.com / Admin@123!';
  ELSE
    UPDATE users SET
      password_hash = 'a$12$oPzlLcjBoLl01CxTxpXpMeTB.s0t3bCVlVJi/qL9XOseTb6S5LFDa',
      status        = 'active',
      role_id       = v_role_id
    WHERE email = 'admin@estimateos.com';
    RAISE NOTICE 'Updated: admin@estimateos.com / Admin@123!';
  END IF;

END $$;
