import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SearchService {
  constructor(private ds: DataSource) {}
  async globalSearch(query: string, tenantId: string, limit = 20) {
    if (!query?.trim()) return { query, results: [], total: 0 };
    const q = `%${query.replace(/[%_]/g,'')}%`;
    const [projects, estimations, clients] = await Promise.all([
      this.ds.query(`SELECT id,'project' AS type, name AS title, status AS subtitle FROM projects WHERE tenant_id=$1 AND name ILIKE $2 AND deleted_at IS NULL LIMIT $3`, [tenantId, q, limit]),
      this.ds.query(`SELECT id,'estimation' AS type, title, status AS subtitle FROM estimations WHERE tenant_id=$1 AND title ILIKE $2 LIMIT $3`, [tenantId, q, limit]),
      this.ds.query(`SELECT id,'client' AS type, name AS title, email AS subtitle FROM clients WHERE tenant_id=$1 AND (name ILIKE $2 OR email ILIKE $2) LIMIT $3`, [tenantId, q, limit]),
    ]);
    const results = [...projects, ...estimations, ...clients].slice(0, limit);
    return { query, results, total: results.length };
  }
}
