import { Module }         from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule }     from '@nestjs/bull';
import { CacheModule }    from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as redisStore    from 'cache-manager-redis-store';

import appConfig      from './config/app.config';
import databaseConfig from './config/database.config';
import aiConfig       from './config/ai.config';
import storageConfig  from './config/storage.config';

import { HealthModule }        from './health/health.module';
import { StorageModule }       from './modules/storage/storage.module';
import { AuthModule }          from './modules/auth/auth.module';
import { TenantsModule }       from './modules/tenants/tenants.module';
import { UsersModule }         from './modules/users/users.module';
import { ClientsModule }       from './modules/clients/clients.module';
import { ProjectsModule }      from './modules/projects/projects.module';
import { FilesModule }         from './modules/files/files.module';
import { EstimationsModule }   from './modules/estimations/estimations.module';
import { QuotationsModule }    from './modules/quotations/quotations.module';
import { AiModule }            from './modules/ai/ai.module';
import { ApprovalsModule }     from './modules/approvals/approvals.module';
import { AnalyticsModule }     from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule }       from './modules/pricing/pricing.module';
import { SearchModule }        from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig, aiConfig, storageConfig], envFilePath: ['.env.local','.env'] }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ type: 'postgres', host: c.get('database.host'), port: c.get('database.port'), username: c.get('database.username'), password: c.get('database.password'), database: c.get('database.name'), entities: [__dirname + '/**/*.entity{.ts,.js}'], synchronize: false, logging: c.get('app.nodeEnv') === 'development', ssl: c.get('database.ssl') ? { rejectUnauthorized: false } : false }) }),
    CacheModule.registerAsync({ isGlobal: true, inject: [ConfigService], useFactory: (c: ConfigService) => ({ store: redisStore as any, host: c.get('app.redisHost'), port: c.get('app.redisPort'), password: c.get('app.redisPassword') || undefined, ttl: 300 }) }),
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ redis: { host: c.get('app.redisHost'), port: c.get('app.redisPort'), password: c.get('app.redisPassword') || undefined } }) }),
    ThrottlerModule.forRoot([{ name:'short', ttl:1000, limit:20 }, { name:'medium', ttl:10000, limit:100 }, { name:'long', ttl:60000, limit:300 }]),
    EventEmitterModule.forRoot({ wildcard: true }),
    HealthModule, StorageModule, AuthModule, TenantsModule, UsersModule, ClientsModule,
    ProjectsModule, FilesModule, EstimationsModule, QuotationsModule, AiModule,
    ApprovalsModule, AnalyticsModule, NotificationsModule, PricingModule, SearchModule,
  ],
})
export class AppModule {}
