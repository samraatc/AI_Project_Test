/**
 * EstimateOS — TypeORM Seed Script
 *
 * USAGE:
 *   npx ts-node -r tsconfig-paths/register src/database/seed.ts
 *   npx ts-node -r tsconfig-paths/register src/database/seed.ts --fresh   (clears all seed data first)
 *   npx ts-node -r tsconfig-paths/register src/database/seed.ts --clear   (clear only, no re-seed)
 *   npx ts-node -r tsconfig-paths/register src/database/seed.ts --users   (add/update users only)
 *
 * Or via npm script:
 *   npm run seed
 *   npm run seed:fresh
 *   npm run seed:clear
 */

import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (local dev overrides), then fallback to .env
// This lets you run npm run seed locally without changing your docker .env
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Allow --local flag to force localhost regardless of .env
if (process.argv.includes('--local')) {
  process.env.DB_HOST    = 'localhost';
  process.env.REDIS_HOST = 'localhost';
}

// ── Entities (inline interfaces to avoid circular imports) ──
import { Tenant }      from '../modules/tenants/entities/tenant.entity';
import { Role }        from '../modules/users/entities/role.entity';
import { User }        from '../modules/users/entities/user.entity';
import { Client }      from '../modules/clients/entities/client.entity';
import { PricingItem } from '../modules/pricing/entities/pricing-item.entity';

// ── Colours for console output ──────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bright: '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

const log = {
  info:    (msg: string) => console.log(`${C.blue}ℹ${C.reset}  ${msg}`),
  success: (msg: string) => console.log(`${C.green}✓${C.reset}  ${msg}`),
  warn:    (msg: string) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`),
  error:   (msg: string) => console.log(`${C.red}✗${C.reset}  ${msg}`),
  section: (msg: string) => console.log(`\n${C.bright}${C.cyan}── ${msg} ──${C.reset}`),
  row:     (msg: string) => console.log(`   ${C.gray}${msg}${C.reset}`),
};

// ── Database connection ──────────────────────────────────────
const AppDataSource = new DataSource({
  type:     'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'estimateos',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME     || 'estimateos',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Tenant, Role, User, Client, PricingItem],
  logging:  false,
});

// ════════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ════════════════════════════════════════════════════════════

const TENANT_SLUG = 'estimateos-demo';

// ── Roles ────────────────────────────────────────────────────
const ROLES_DATA = [
  {
    name: 'company_admin',
    isSystem: true,
    permissions: [
      '*',
      'users:read', 'users:write', 'users:delete',
      'roles:read', 'roles:write',
      'projects:read', 'projects:write', 'projects:delete',
      'estimations:read', 'estimations:write', 'estimations:approve',
      'quotations:read', 'quotations:write', 'quotations:send',
      'analytics:read',
      'pricing:read', 'pricing:write',
      'settings:read', 'settings:write',
      'clients:read', 'clients:write',
    ],
  },
  {
    name: 'estimator',
    isSystem: true,
    permissions: [
      'projects:read', 'projects:write',
      'estimations:read', 'estimations:write',
      'quotations:read', 'quotations:write',
      'analytics:read',
      'pricing:read',
      'clients:read', 'clients:write',
    ],
  },
  {
    name: 'approver',
    isSystem: true,
    permissions: [
      'projects:read',
      'estimations:read', 'estimations:approve',
      'quotations:read',
      'analytics:read',
    ],
  },
  {
    name: 'viewer',
    isSystem: true,
    permissions: [
      'projects:read',
      'estimations:read',
      'quotations:read',
      'analytics:read',
      'clients:read',
    ],
  },
];

// ── Users ─────────────────────────────────────────────────────
// password is plain text here — it will be hashed before saving
const USERS_DATA = [
  {
    email:     'admin@estimateos.com',
    password:  'Admin@123!',
    firstName: 'Super',
    lastName:  'Admin',
    role:      'company_admin',
    department:'Management',
  },
  {
    email:     'estimator@estimateos.com',
    password:  'Estimator@123!',
    firstName: 'John',
    lastName:  'Ahmed',
    role:      'estimator',
    department:'Estimation',
  },
  {
    email:     'approver@estimateos.com',
    password:  'Approver@123!',
    firstName: 'Sarah',
    lastName:  'Chen',
    role:      'approver',
    department:'Engineering',
  },
  {
    email:     'viewer@estimateos.com',
    password:  'Viewer@123!',
    firstName: 'James',
    lastName:  'Wilson',
    role:      'viewer',
    department:'Finance',
  },
];

// ── Clients ───────────────────────────────────────────────────
const CLIENTS_DATA = [
  {
    name: 'ACME Engineering',
    company: 'ACME Engineering Ltd',
    email: 'procurement@acme-engineering.com',
    phone: '+1-555-0100',
    country: 'United States',
    currency: 'USD',
    taxNumber: 'US-123456789',
    address: '123 Industrial Ave, Houston, TX 77001',
    notes: 'Key client - oil & gas sector. Net 30 payment terms.',
  },
  {
    name: 'PetroGulf Ltd',
    company: 'PetroGulf Ltd',
    email: 'projects@petrogulf.ae',
    phone: '+971-4-555-0200',
    country: 'UAE',
    currency: 'AED',
    taxNumber: 'AE-100234567',
    address: 'PO Box 1234, Dubai, UAE',
    notes: 'Major EPC client in the Middle East. Works in AED.',
  },
  {
    name: 'MegaFab Corp',
    company: 'MegaFab Corporation',
    email: 'tenders@megafab.com',
    phone: '+44-20-5555-0300',
    country: 'United Kingdom',
    currency: 'GBP',
    taxNumber: 'GB-987654321',
    address: '45 Fabrication Rd, Birmingham, B1 1AA',
    notes: 'Steel fabrication and manufacturing.',
  },
  {
    name: 'Saudi Petro Industries',
    company: 'Saudi Petro Industries Co.',
    email: 'contracts@saudipi.sa',
    phone: '+966-11-555-0400',
    country: 'Saudi Arabia',
    currency: 'SAR',
    taxNumber: 'SA-300012345600003',
    address: 'Riyadh 12345, Kingdom of Saudi Arabia',
    notes: 'Large-scale refinery and petrochemical projects.',
  },
  {
    name: 'InfraBuild India',
    company: 'InfraBuild India Pvt Ltd',
    email: 'bids@infrabuild.in',
    phone: '+91-22-5555-0500',
    country: 'India',
    currency: 'INR',
    taxNumber: 'GSTIN-27ABCDE1234F1Z5',
    address: 'Unit 5, MIDC, Mumbai, Maharashtra 400093',
    notes: 'Civil infrastructure and construction.',
  },
];

// ── Pricing items ─────────────────────────────────────────────
const PRICING_DATA = [
  // Materials
  { category: 'material', code: 'STL-A50',   name: 'Structural Steel Grade A50',     unit: 'MT',    unitRate: 890.00,   currency: 'USD', description: 'High-strength structural steel ASTM A50' },
  { category: 'material', code: 'STL-A36',   name: 'Structural Steel Grade A36',     unit: 'MT',    unitRate: 780.00,   currency: 'USD', description: 'Standard structural steel ASTM A36' },
  { category: 'material', code: 'STL-S355',  name: 'Structural Steel S355',          unit: 'MT',    unitRate: 920.00,   currency: 'USD', description: 'European standard high-strength steel' },
  { category: 'material', code: 'CONC-C35',  name: 'Reinforced Concrete C35/45',     unit: 'm3',    unitRate: 320.00,   currency: 'USD', description: 'Ready-mix concrete C35/45 grade' },
  { category: 'material', code: 'CONC-C25',  name: 'Reinforced Concrete C25/30',     unit: 'm3',    unitRate: 280.00,   currency: 'USD', description: 'Ready-mix concrete C25/30 grade' },
  { category: 'material', code: 'CONC-C20',  name: 'Blinding Concrete C20',          unit: 'm3',    unitRate: 220.00,   currency: 'USD', description: 'Lean mix concrete for blinding' },
  { category: 'material', code: 'PLY-18',    name: 'Marine Plywood 18mm',            unit: 'sheet', unitRate:  45.00,   currency: 'USD', description: '2440x1220mm marine grade' },
  { category: 'material', code: 'BOLT-M20',  name: 'Anchor Bolts M20 x 200',        unit: 'pcs',   unitRate:  12.50,   currency: 'USD', description: 'Hot-dip galvanised anchor bolts' },
  { category: 'material', code: 'BOLT-M24',  name: 'Anchor Bolts M24 x 250',        unit: 'pcs',   unitRate:  18.75,   currency: 'USD', description: 'Hot-dip galvanised anchor bolts' },
  { category: 'material', code: 'PIPE-6',    name: 'Carbon Steel Pipe 6 inch SCH40', unit: 'm',     unitRate: 145.00,   currency: 'USD', description: 'ASTM A53 Gr B seamless pipe' },
  { category: 'material', code: 'PIPE-8',    name: 'Carbon Steel Pipe 8 inch SCH40', unit: 'm',     unitRate: 210.00,   currency: 'USD', description: 'ASTM A53 Gr B seamless pipe' },
  { category: 'material', code: 'INSUL-50',  name: 'Mineral Wool Insulation 50mm',  unit: 'm2',    unitRate:  28.00,   currency: 'USD', description: 'Rock wool pipe insulation' },
  // Steel
  { category: 'steel',    code: 'REB-10',    name: 'Rebar High Tensile 10mm',        unit: 'MT',    unitRate: 680.00,   currency: 'USD', description: 'BS4449 Grade B500B deformed bar' },
  { category: 'steel',    code: 'REB-12',    name: 'Rebar High Tensile 12mm',        unit: 'MT',    unitRate: 710.00,   currency: 'USD', description: 'BS4449 Grade B500B deformed bar' },
  { category: 'steel',    code: 'REB-16',    name: 'Rebar High Tensile 16mm',        unit: 'MT',    unitRate: 720.00,   currency: 'USD', description: 'BS4449 Grade B500B deformed bar' },
  { category: 'steel',    code: 'REB-20',    name: 'Rebar High Tensile 20mm',        unit: 'MT',    unitRate: 730.00,   currency: 'USD', description: 'BS4449 Grade B500B deformed bar' },
  { category: 'steel',    code: 'REB-25',    name: 'Rebar High Tensile 25mm',        unit: 'MT',    unitRate: 740.00,   currency: 'USD', description: 'BS4449 Grade B500B deformed bar' },
  { category: 'steel',    code: 'MESH-A393', name: 'Steel Mesh A393',               unit: 'm2',    unitRate:  22.00,   currency: 'USD', description: 'Welded steel fabric reinforcement' },
  // Labour
  { category: 'labor',    code: 'LAB-WLD-C', name: 'Certified Structural Welder',   unit: 'day',   unitRate: 480.00,   currency: 'USD', description: '8hr shift, AWS/CSWIP certified' },
  { category: 'labor',    code: 'LAB-WLD-P', name: 'Pipe Welder (6G certified)',    unit: 'day',   unitRate: 520.00,   currency: 'USD', description: '6G all-position certified welder' },
  { category: 'labor',    code: 'LAB-CIV',   name: 'Civil Engineer (Supervision)',   unit: 'day',   unitRate: 650.00,   currency: 'USD', description: 'Chartered site supervision engineer' },
  { category: 'labor',    code: 'LAB-STR',   name: 'Structural Engineer',            unit: 'day',   unitRate: 700.00,   currency: 'USD', description: 'Structural design/review engineer' },
  { category: 'labor',    code: 'LAB-QC',    name: 'QC Inspector',                  unit: 'day',   unitRate: 400.00,   currency: 'USD', description: 'Quality control inspection' },
  { category: 'labor',    code: 'LAB-FOR',   name: 'Site Foreman',                  unit: 'day',   unitRate: 350.00,   currency: 'USD', description: 'Experienced construction foreman' },
  { category: 'labor',    code: 'LAB-SKL',   name: 'Skilled General Labour',        unit: 'day',   unitRate: 180.00,   currency: 'USD', description: 'Skilled construction operative' },
  { category: 'labor',    code: 'LAB-UNS',   name: 'Unskilled Labour',              unit: 'day',   unitRate:  95.00,   currency: 'USD', description: 'General unskilled site labour' },
  { category: 'labor',    code: 'LAB-ELE',   name: 'Electrician (Licensed)',        unit: 'day',   unitRate: 420.00,   currency: 'USD', description: 'Licensed industrial electrician' },
  // Equipment
  { category: 'equipment',code: 'EQ-CRN50',  name: '50T Tower Crane (daily)',       unit: 'day',   unitRate: 1200.00,  currency: 'USD', description: 'Self-erecting tower crane 50T capacity' },
  { category: 'equipment',code: 'EQ-CRN25',  name: '25T Mobile Crane (daily)',      unit: 'day',   unitRate:  750.00,  currency: 'USD', description: 'All-terrain hydraulic crane 25T' },
  { category: 'equipment',code: 'EQ-CRN100', name: '100T Crawler Crane (daily)',    unit: 'day',   unitRate: 2800.00,  currency: 'USD', description: 'Heavy lift crawler crane' },
  { category: 'equipment',code: 'EQ-EXC20',  name: '20T Excavator (daily)',         unit: 'day',   unitRate:  420.00,  currency: 'USD', description: 'Hydraulic tracked excavator' },
  { category: 'equipment',code: 'EQ-BULL',   name: 'D6 Bulldozer (daily)',          unit: 'day',   unitRate:  380.00,  currency: 'USD', description: 'Caterpillar D6 or equivalent' },
  { category: 'equipment',code: 'EQ-GEN100', name: 'Diesel Generator 100KVA',      unit: 'day',   unitRate:   95.00,  currency: 'USD', description: 'Temporary power generation' },
  { category: 'equipment',code: 'EQ-SCF',    name: 'Scaffolding (per m2/month)',    unit: 'm2',    unitRate:   18.00,  currency: 'USD', description: 'Steel tube erect, maintain, dismantle' },
  { category: 'equipment',code: 'EQ-PUMP',   name: 'Concrete Pump (daily)',         unit: 'day',   unitRate:  650.00,  currency: 'USD', description: 'Boom pump up to 52m reach' },
  { category: 'equipment',code: 'EQ-WELD',   name: 'Welding Machine Set',           unit: 'day',   unitRate:   45.00,  currency: 'USD', description: 'MIG/TIG welding equipment set' },
  // Transport
  { category: 'transport',code: 'TRN-TRK',   name: 'Concrete Mixer Truck',          unit: 'load',  unitRate:  220.00,  currency: 'USD', description: '6m3 ready-mix delivery within 20km' },
  { category: 'transport',code: 'TRN-FLT',   name: 'Flatbed Truck (steel)',         unit: 'trip',  unitRate:  350.00,  currency: 'USD', description: '20T flatbed delivery within 50km' },
  { category: 'transport',code: 'TRN-SPC',   name: 'Special Transport (heavy lift)',unit: 'trip',  unitRate: 1500.00,  currency: 'USD', description: 'Oversize + permits + escort' },
  { category: 'transport',code: 'TRN-SKP',   name: 'Skip Hire (10m3)',              unit: 'week',  unitRate:  180.00,  currency: 'USD', description: 'Waste removal skip hire' },
];

// ════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ════════════════════════════════════════════════════════════

async function clearSeedData(
  tenantRepo: Repository<Tenant>,
  roleRepo: Repository<Role>,
  userRepo: Repository<User>,
  clientRepo: Repository<Client>,
  pricingRepo: Repository<PricingItem>,
): Promise<void> {
  log.section('Clearing Previous Seed Data');

  const tenant = await tenantRepo.findOne({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    log.warn('No seed tenant found — nothing to clear');
    return;
  }

  const tenantId = tenant.id;

  // Delete in dependency order
  const pricingCount = await pricingRepo.count({ where: { tenantId } });
  if (pricingCount > 0) {
    await pricingRepo.delete({ tenantId });
    log.success(`Cleared ${pricingCount} pricing items`);
  }

  const clientCount = await clientRepo.count({ where: { tenantId } });
  if (clientCount > 0) {
    await clientRepo.delete({ tenantId });
    log.success(`Cleared ${clientCount} clients`);
  }

  const userCount = await userRepo.count({ where: { tenantId } });
  if (userCount > 0) {
    await userRepo.delete({ tenantId });
    log.success(`Cleared ${userCount} users`);
  }

  const roleCount = await roleRepo.count({ where: { tenantId } });
  if (roleCount > 0) {
    await roleRepo.delete({ tenantId });
    log.success(`Cleared ${roleCount} roles`);
  }

  await tenantRepo.delete({ slug: TENANT_SLUG });
  log.success('Cleared seed tenant');
}

async function seedTenant(tenantRepo: Repository<Tenant>): Promise<Tenant> {
  log.section('Tenant');

  let tenant = await tenantRepo.findOne({ where: { slug: TENANT_SLUG } });
  if (tenant) {
    // Ensure active
    await tenantRepo.update(tenant.id, { status: 'active' });
    tenant.status = 'active';
    log.warn(`Tenant already exists — using: ${tenant.name}`);
    return tenant;
  }

  tenant = tenantRepo.create({
    name:          'BENSON Demo',
    slug:          TENANT_SLUG,
    plan:          'enterprise',
    status:        'active',
    schemaName:    'tenant_demo',
    storageBucket: 'tenant-demo-files',
    maxUsers:      9999,
    maxStorageGb:  9999,
    aiModel:       'gpt-4o',
    aiTokenLimit:  999999999,
    settings: {
      currency:        'USD',
      industry:        'construction',
      language:        'en',
      dateFormat:      'DD/MM/YYYY',
      aiAutoAnalyze:   true,
    },
  });

  await tenantRepo.save(tenant);
  log.success(`Created tenant: ${tenant.name} (${tenant.plan})`);
  return tenant;
}

async function seedRoles(
  roleRepo: Repository<Role>,
  tenantId: string,
): Promise<Map<string, Role>> {
  log.section('Roles');

  const roleMap = new Map<string, Role>();

  for (const roleData of ROLES_DATA) {
    let role = await roleRepo.findOne({ where: { tenantId, name: roleData.name } });

    if (role) {
      // Update permissions in case they changed
      await roleRepo.update(role.id, { permissions: roleData.permissions });
      role.permissions = roleData.permissions;
      log.warn(`Role exists, updated permissions: ${role.name}`);
    } else {
      role = await roleRepo.save(
        roleRepo.create({
          tenantId,
          name:        roleData.name,
          isSystem:    roleData.isSystem,
          permissions: roleData.permissions,
        }),
      ) as unknown as Role;
      log.success(`Created role: ${role.name} (${roleData.permissions.length} permissions)`);
    }

    roleMap.set(role.name, role);
  }

  return roleMap;
}

async function seedUsers(
  userRepo: Repository<User>,
  tenantId: string,
  roleMap: Map<string, Role>,
  extraUsers?: Array<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    department?: string;
  }>,
): Promise<User[]> {
  log.section('Users');

  const allUsers = [...USERS_DATA, ...(extraUsers || [])];
  const created: User[] = [];

  for (const userData of allUsers) {
    const role = roleMap.get(userData.role);
    if (!role) {
      log.error(`Role not found: ${userData.role} — skipping ${userData.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(userData.password, 12);
    let user = await userRepo.findOne({ where: { email: userData.email.toLowerCase() } });

    if (user) {
      // Update password and ensure active
      await userRepo.update(user.id, {
        passwordHash,
        status:    'active',
        roleId:    role.id,
        firstName: userData.firstName,
        lastName:  userData.lastName,
        department: userData.department || null,
      });
      log.warn(`User updated: ${userData.email} (password reset to: ${userData.password})`);
    } else {
      user = await userRepo.save(
        userRepo.create({
          tenantId,
          roleId:       role.id,
          email:        userData.email.toLowerCase(),
          passwordHash,
          firstName:    userData.firstName,
          lastName:     userData.lastName,
          department:   userData.department || null,
          status:       'active',
        }),
      ) as unknown as User;
      log.success(`Created user: ${userData.email} / ${userData.password} [${userData.role}]`);
    }

    created.push(user);
  }

  return created;
}

async function seedClients(
  clientRepo: Repository<Client>,
  tenantId: string,
  adminUserId: string,
): Promise<Client[]> {
  log.section('Clients');

  const created: Client[] = [];

  for (const data of CLIENTS_DATA) {
    const existing = await clientRepo.findOne({ where: { tenantId, email: data.email } });
    if (existing) {
      log.warn(`Client exists: ${data.name}`);
      created.push(existing);
      continue;
    }

    const client = await clientRepo.save(
      clientRepo.create({
        tenantId,
        name:      data.name,
        company:   data.company,
        email:     data.email,
        phone:     data.phone,
        country:   data.country,
        currency:  data.currency,
        taxNumber: data.taxNumber,
        address:   data.address,
        notes:     data.notes,
        status:    'active',
        createdBy: adminUserId,
        metadata:  {},
      }),
    ) as unknown as Client;

    log.success(`Created client: ${client.name} (${client.country})`);
    created.push(client);
  }

  return created;
}

async function seedPricing(
  pricingRepo: Repository<PricingItem>,
  tenantId: string,
  adminUserId: string,
): Promise<void> {
  log.section('Pricing Library');

  let created = 0;
  let skipped = 0;

  for (const item of PRICING_DATA) {
    const existing = await pricingRepo.findOne({ where: { tenantId, code: item.code } });
    if (existing) {
      // Update the rate in case prices changed
      await pricingRepo.update(existing.id, { unitRate: item.unitRate });
      skipped++;
      continue;
    }

    await pricingRepo.save(
      pricingRepo.create({
        tenantId,
        category:    item.category,
        code:        item.code,
        name:        item.name,
        unit:        item.unit,
        unitRate:    item.unitRate,
        currency:    item.currency,
        description: item.description,
        isActive:    true,
        source:      'system',
        createdBy:   adminUserId,
        metadata:    {},
      }),
    );
    created++;
  }

  log.success(`Pricing items: ${created} created, ${skipped} updated`);
}

function printSummary(roleMap: Map<string, Role>, users: User[]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${C.bright}${C.green}  EstimateOS Seed Complete!${C.reset}`);
  console.log(`${'═'.repeat(60)}\n`);

  console.log(`${C.bright}  LOGIN CREDENTIALS${C.reset}`);
  console.log(`  ${'─'.repeat(50)}`);

  const userDataMap = new Map(USERS_DATA.map(u => [u.email.toLowerCase(), u]));
  for (const user of users) {
    const data = userDataMap.get(user.email);
    const pwd  = data?.password || '(custom)';
    const role = data?.role     || 'unknown';
    console.log(`  ${C.cyan}${user.email.padEnd(36)}${C.reset} ${C.green}${pwd.padEnd(18)}${C.reset} [${role}]`);
  }

  console.log(`\n  ${C.bright}Roles created:${C.reset} ${[...roleMap.keys()].join(', ')}`);
  console.log(`  ${C.bright}Pricing items:${C.reset} ${PRICING_DATA.length} items`);
  console.log(`  ${C.bright}Clients:${C.reset}       ${CLIENTS_DATA.length} clients`);
  console.log(`\n  ${C.gray}Open: http://localhost:3001${C.reset}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

async function main() {
  const args    = process.argv.slice(2);
  const isFresh = args.includes('--fresh');
  const isClear = args.includes('--clear');
  const isUsers = args.includes('--users');

  console.log(`\n${C.bright}${C.cyan}EstimateOS — TypeORM Seed Script${C.reset}`);
  console.log(`${C.gray}Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'estimateos'}${C.reset}\n`);

  log.info('Connecting to database…');
  await AppDataSource.initialize();
  log.success('Connected');

  const tenantRepo  = AppDataSource.getRepository(Tenant);
  const roleRepo    = AppDataSource.getRepository(Role);
  const userRepo    = AppDataSource.getRepository(User);
  const clientRepo  = AppDataSource.getRepository(Client);
  const pricingRepo = AppDataSource.getRepository(PricingItem);

  try {
    // ── Clear mode ─────────────────────────────────────────
    if (isClear || isFresh) {
      await clearSeedData(tenantRepo, roleRepo, userRepo, clientRepo, pricingRepo);
      if (isClear) {
        log.success('Clear complete. Database is clean.');
        return;
      }
    }

    // ── Seed tenant ────────────────────────────────────────
    const tenant = await seedTenant(tenantRepo);

    // ── Seed roles ─────────────────────────────────────────
    const roleMap = await seedRoles(roleRepo, tenant.id);

    // ── Seed users ─────────────────────────────────────────
    // To add custom users, pass them as extraUsers:
    const extraUsers = isUsers ? [
      // Example: uncomment and edit to add more users
      // { email: 'newuser@company.com', password: 'NewUser@123!', firstName: 'New', lastName: 'User', role: 'estimator', department: 'Projects' },
    ] : [];

    const users = await seedUsers(userRepo, tenant.id, roleMap, extraUsers);

    // ── Seed clients ───────────────────────────────────────
    const adminUser = users.find(u => u.email === 'admin@estimateos.com');
    if (adminUser) {
      await seedClients(clientRepo, tenant.id, adminUser.id);
    }

    // ── Seed pricing ───────────────────────────────────────
    if (adminUser) {
      await seedPricing(pricingRepo, tenant.id, adminUser.id);
    }

    // ── Print summary ──────────────────────────────────────
    printSummary(roleMap, users);

  } finally {
    await AppDataSource.destroy();
    log.info('Database connection closed');
  }
}

main().catch(err => {
  console.error(`\n${C.red}Seed failed:${C.reset}`, err.message);
  process.exit(1);
});
