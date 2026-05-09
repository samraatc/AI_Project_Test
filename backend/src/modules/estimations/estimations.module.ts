import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstimationsService } from './estimations.service';
import { EstimationsController } from './estimations.controller';
import { Estimation } from './entities/estimation.entity';
import { EstimationItem } from './entities/estimation-item.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Estimation, EstimationItem, AuditLog]), AiModule],
  controllers: [EstimationsController],
  providers: [EstimationsService],
  exports: [EstimationsService],
})
export class EstimationsModule {}
