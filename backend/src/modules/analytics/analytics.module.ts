import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Estimation } from '../estimations/entities/estimation.entity';
import { Project } from '../projects/entities/project.entity';
import { Quotation } from '../quotations/entities/quotation.entity';

@Module({ imports: [TypeOrmModule.forFeature([Estimation, Project, Quotation])], controllers: [AnalyticsController], providers: [AnalyticsService], exports: [AnalyticsService] })
export class AnalyticsModule {}
