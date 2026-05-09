import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)   private userRepo:   Repository<User>,
    @InjectRepository(Role)   private roleRepo:   Repository<Role>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
  ) {}

  async findAll(tenantId: string) {
    const users = await this.userRepo.find({ where: { tenantId }, relations: ['role'], order: { createdAt: 'DESC' } });
    return users.map(u => this.sanitize(u));
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId }, relations: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async create(dto: any, tenantId: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase(), tenantId } });
    if (existing) throw new ConflictException('Email already exists');
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (await this.userRepo.count({ where: { tenantId } }) >= tenant.maxUsers) throw new BadRequestException(`User limit (${tenant.maxUsers}) reached`);
    const role = await this.roleRepo.findOne({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    const passwordHash = await bcrypt.hash(dto.password || randomBytes(12).toString('hex'), 12);
    const saved = await this.userRepo.save(this.userRepo.create({ ...dto, email: dto.email.toLowerCase(), tenantId, passwordHash, status: 'active' })) as User;
    return this.sanitize(saved);
  }

  async update(id: string, dto: any, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.password) { dto.passwordHash = await bcrypt.hash(dto.password, 12); delete dto.password; }
    await this.userRepo.update(id, dto);
    return this.findOne(id, tenantId);
  }

  async deactivate(id: string, tenantId: string)  { await this.userRepo.update({ id, tenantId }, { status: 'inactive' }); }
  async reactivate(id: string, tenantId: string)   { await this.userRepo.update({ id, tenantId }, { status: 'active' }); }

  async invite(email: string, roleId: string, tenantId: string) {
    if (await this.userRepo.findOne({ where: { email: email.toLowerCase(), tenantId } })) throw new ConflictException('Email already exists');
    const role = await this.roleRepo.findOne({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const user = await this.userRepo.save(this.userRepo.create({ email: email.toLowerCase(), tenantId, roleId, passwordHash: '', status: 'invited', inviteToken: token, inviteExpires: expires })) as User;
    return { userId: user.id, inviteToken: token, message: 'Invite created' };
  }

  async acceptInvite(token: string, password: string, firstName: string, lastName: string) {
    const user = await this.userRepo.findOne({ where: { inviteToken: token, status: 'invited' } });
    if (!user) throw new NotFoundException('Invalid invite token');
    if (user.inviteExpires < new Date()) throw new BadRequestException('Invite token expired');
    await this.userRepo.update(user.id, { passwordHash: await bcrypt.hash(password, 12), firstName, lastName, status: 'active', inviteToken: null, inviteExpires: null });
    return { message: 'Account activated' };
  }

  async getRoles(tenantId: string) { return this.roleRepo.find({ where: { tenantId }, order: { name: 'ASC' } }); }
  async getStats(tenantId: string) {
    const [total, active, inactive, invited] = await Promise.all([this.userRepo.count({ where: { tenantId } }), this.userRepo.count({ where: { tenantId, status: 'active' } }), this.userRepo.count({ where: { tenantId, status: 'inactive' } }), this.userRepo.count({ where: { tenantId, status: 'invited' } })]);
    return { total, active, inactive, invited };
  }

  private sanitize(user: User): any {
    const { passwordHash, mfaSecret, inviteToken, ...safe } = user as any;
    return safe;
  }
}
