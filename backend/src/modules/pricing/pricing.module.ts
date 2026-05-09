import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PricingItem } from './entities/pricing-item.entity';

@Module({ imports: [TypeOrmModule.forFeature([PricingItem])], controllers: [PricingController], providers: [PricingService], exports: [PricingService] })
export class PricingModule {}
