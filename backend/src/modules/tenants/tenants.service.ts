import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './entities/tenant.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Role)   private roleRepo:   Repository<Role>,
    @InjectRepository(User)   private userRepo:   Repository<User>,
    private dataSource: DataSource,
  ) {}

  async provision(dto: CreateTenantDto): Promise<Tenant> {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await this.tenantRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Organisation name already taken');

    return this.dataSource.transaction(async (mgr) => {
      const tenant = await mgr.save(Tenant, mgr.create(Tenant, {
        name: dto.name, slug, plan: dto.plan || 'starter', status: 'active',
        schemaName: `tenant_${Date.now()}`, storageBucket: `tenant-${slug}-${Date.now()}`,
        maxUsers: this.planLimits(dto.plan).maxUsers, maxStorageGb: this.planLimits(dto.plan).maxStorageGb, aiTokenLimit: this.planLimits(dto.plan).aiTokenLimit,
      }));

      const adminRole = await mgr.save(Role, mgr.create(Role, { tenantId: tenant.id, name: 'company_admin', isSystem: true, permissions: ['users:read','users:write','users:delete','roles:read','roles:write','projects:read','projects:write','projects:delete','estimations:read','estimations:write','estimations:approve','quotations:read','quotations:write','quotations:send','analytics:read','pricing:read','pricing:write','settings:read','settings:write'] }));
      await mgr.save(Role, mgr.create(Role, { tenantId: tenant.id, name: 'estimator', isSystem: true, permissions: ['projects:read','projects:write','estimations:read','estimations:write','quotations:read','quotations:write','analytics:read','pricing:read'] }));
      await mgr.save(Role, mgr.create(Role, { tenantId: tenant.id, name: 'viewer', isSystem: true, permissions: ['projects:read','estimations:read','quotations:read','analytics:read'] }));

      await mgr.save(User, mgr.create(User, { tenantId: tenant.id, roleId: adminRole.id, email: dto.adminEmail.toLowerCase(), passwordHash: await bcrypt.hash(dto.adminPassword, 12), firstName: dto.adminFirstName || 'Admin', lastName: dto.adminLastName || '', status: 'active' }));
      this.logger.log(`Provisioned tenant: ${tenant.name}`);
      return tenant;
    });
  }

  findAll()           { return this.tenantRepo.find({ order: { createdAt: 'DESC' } }); }
  findOne(id: string) { return this.tenantRepo.findOneOrFail({ where: { id } }); }
  async update(id: string, data: any) { await this.tenantRepo.update(id, data); return this.findOne(id); }
  async suspend(id: string)    { return this.update(id, { status: 'suspended' }); }
  async reactivate(id: string) { return this.update(id, { status: 'active' }); }
  async getUsage(id: string) {
    const [userCount, tenant] = await Promise.all([this.userRepo.count({ where: { tenantId: id } }), this.findOne(id)]);
    return { users: userCount, maxUsers: tenant.maxUsers, aiTokensUsed: tenant.aiTokensUsed, aiTokenLimit: tenant.aiTokenLimit, aiUsagePct: Math.round((Number(tenant.aiTokensUsed) / tenant.aiTokenLimit) * 100) };
  }
  private planLimits(plan?: string) {
    const p: Record<string,any> = { starter: { maxUsers:5, maxStorageGb:20, aiTokenLimit:1_000_000 }, professional: { maxUsers:25, maxStorageGb:100, aiTokenLimit:5_000_000 }, enterprise: { maxUsers:9999, maxStorageGb:9999, aiTokenLimit:50_000_000 } };
    return p[plan || 'starter'] || p.starter;
  }
}
