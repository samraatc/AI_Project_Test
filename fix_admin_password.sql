
-- ============================================================
-- RUN THIS to fix login on existing database:
--
-- docker exec -i estimateos-postgres psql -U estimateos -d estimateos < fix_admin_password.sql
-- ============================================================

-- Step 1: Make sure tenant is active
UPDATE tenants SET status = 'active' WHERE slug = 'estimateos-demo';

-- Step 2: Fix the admin user password hash
-- Password: Admin@123!  (bcrypt verified hash)
UPDATE users
SET
  password_hash = '$2a$12$oPzlLcjBoLl01CxTxpXpMeTB.s0t3bCVlVJi/qL9XOseTb6S5LFDa',
  status        = 'active'
WHERE email = 'admin@estimateos.com';

-- Step 3: If user doesn't exist, check what users we have
SELECT
  u.email,
  u.status,
  u.password_hash,
  t.name  AS tenant,
  t.status AS tenant_status,
  r.name  AS role
FROM users u
JOIN tenants t ON t.id = u.tenant_id
JOIN roles   r ON r.id = u.role_id
ORDER BY u.created_at;

SELECT 'Done. Login with: admin@estimateos.com / Admin@123!' AS result;
