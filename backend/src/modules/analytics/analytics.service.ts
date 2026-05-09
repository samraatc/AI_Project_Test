import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Estimation } from '../estimations/entities/estimation.entity';
import { Project } from '../projects/entities/project.entity';
import { Quotation } from '../quotations/entities/quotation.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Estimation) private estRepo:   Repository<Estimation>,
    @InjectRepository(Project)    private projRepo:  Repository<Project>,
    @InjectRepository(Quotation)  private quoteRepo: Repository<Quotation>,
    private ds: DataSource,
  ) {}

  async getDashboard(tenantId: string) {
    const [totalProjects, activeProjects, totalEstimations, totalQuotations, acceptedQuotations] = await Promise.all([
      this.projRepo.count({ where: { tenantId } }), this.projRepo.count({ where: { tenantId, status: 'active' } }),
      this.estRepo.count({ where: { tenantId } }), this.quoteRepo.count({ where: { tenantId } }),
      this.quoteRepo.count({ where: { tenantId, status: 'accepted' } }),
    ]);
    const revResult  = await this.ds.query(`SELECT COALESCE(SUM(final_total),0) AS total FROM quotations WHERE tenant_id=$1 AND status='accepted'`, [tenantId]);
    const confResult = await this.ds.query(`SELECT AVG(ai_confidence) AS avg FROM estimations WHERE tenant_id=$1 AND ai_confidence IS NOT NULL`, [tenantId]);
    const aiEst      = await this.estRepo.count({ where: { tenantId, aiModelUsed: 'gpt-4o' } });
    const monthly    = await this.ds.query(`SELECT TO_CHAR(created_at,'Mon YYYY') AS month, DATE_TRUNC('month',created_at) AS month_date, COALESCE(SUM(final_total),0) AS revenue, COUNT(*) AS quote_count FROM quotations WHERE tenant_id=$1 AND status='accepted' AND created_at>=NOW()-INTERVAL '12 months' GROUP BY month,month_date ORDER BY month_date`, [tenantId]);
    const breakdown  = await this.ds.query(`SELECT AVG(material_cost+steel_cost) AS material, AVG(labor_cost) AS labor, AVG(equipment_cost) AS equipment, AVG(transport_cost) AS transport, AVG(overhead_cost) AS overhead FROM estimations WHERE tenant_id=$1 AND status IN ('approved','locked')`, [tenantId]);
    const recent     = await this.projRepo.find({ where: { tenantId }, order: { updatedAt: 'DESC' }, take: 5, select: ['id','name','status','aiStatus','industry','updatedAt'] });
    const row = breakdown[0] || {};
    const vals: number[] = Object.values(row).map((v: any) => Number(v)||0);
    const total = vals.reduce((s,v) => s+v, 0);
    const bd = Object.entries(row).map(([k,v]: [string,any]) => ({ category: k, amount: Number(v)||0, pct: total ? Math.round((Number(v)||0)/total*100) : 0 }));
    return {
      kpis: { totalProjects, activeProjects, totalEstimations, totalQuotations, acceptedQuotations, winRate: totalQuotations ? Math.round(acceptedQuotations/totalQuotations*100) : 0, totalRevenue: Number(revResult[0]?.total)||0, avgAiConfidence: Math.round(Number(confResult[0]?.avg)||0), aiAdoptionPct: totalEstimations ? Math.round(aiEst/totalEstimations*100) : 0 },
      monthlyRevenue: monthly, costBreakdown: bd, recentProjects: recent,
    };
  }

  async getAiAccuracy(tenantId: string) {
    const r = await this.ds.query(`SELECT COUNT(*) AS total_ai_estimates, AVG(ai_confidence) AS avg_confidence, COUNT(CASE WHEN ai_confidence>=80 THEN 1 END) AS high_confidence, COUNT(CASE WHEN ai_confidence>=60 AND ai_confidence<80 THEN 1 END) AS medium_confidence, COUNT(CASE WHEN ai_confidence<60 THEN 1 END) AS low_confidence, AVG(ai_prompt_tokens+ai_output_tokens) AS avg_tokens_per_estimate FROM estimations WHERE tenant_id=$1 AND ai_confidence IS NOT NULL`, [tenantId]);
    return r[0];
  }

  async getProjectAnalytics(projectId: string, tenantId: string) {
    const estimations = await this.estRepo.find({ where: { projectId, tenantId }, order: { versionNumber: 'ASC' } });
    return { estimations, versionTrend: estimations.map(e => ({ version: e.versionNumber, total: Number(e.finalTotal), date: e.createdAt, status: e.status })) };
  }
}
