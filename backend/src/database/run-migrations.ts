import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../.env') });

const ds = new DataSource({ type: 'postgres', host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT) || 5432, username: process.env.DB_USERNAME || 'estimateos', password: process.env.DB_PASSWORD || 'changeme', database: process.env.DB_NAME || 'estimateos' });

async function run() {
  await ds.initialize();
  await ds.query(`CREATE TABLE IF NOT EXISTS _migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, run_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files = ['001_tenants_and_users.sql','002_projects_and_files.sql','003_estimations_and_quotations.sql','004_seed_data.sql'];
  for (const f of files) {
    const rows = await ds.query('SELECT id FROM _migrations WHERE name=$1', [f]);
    if (rows.length) { console.log(`  skip: ${f}`); continue; }
    const sql = readFileSync(join(__dirname, '../../../database/migrations', f), 'utf8');
    await ds.query(sql);
    await ds.query('INSERT INTO _migrations(name) VALUES($1)', [f]);
    console.log(`  done: ${f}`);
  }
  await ds.destroy();
  console.log('Migrations complete.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
