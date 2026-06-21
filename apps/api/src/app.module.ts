import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { CidadaosModule } from './cidadaos/cidadaos.module';
import { ReportsModule } from './reports/reports.module';
import { HomeModule } from './home/home.module';
import { EcopontosModule } from './ecopontos/ecopontos.module';
import { GamificationModule } from './gamification/gamification.module';
import { PartilhasModule } from './partilhas/partilhas.module';
import { NoticiasModule } from './noticias/noticias.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FilaModule } from './fila/fila.module';
import { RecolhasModule } from './recolhas/recolhas.module';
import { CampanhasModule } from './campanhas/campanhas.module';
import { AuditModule } from './audit/audit.module';
import { RotasModule } from './rotas/rotas.module';
import { EquipasModule } from './equipas/equipas.module';
import { CookiesModule } from './cookies/cookies.module';
import { AdminModule } from './admin/admin.module';
import { GeocodingModule } from './geocoding/geocoding.module';

@Module({
  imports: [
    // Rate limiting: Global default (100 reqs / min)
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60 * 1000, // 1 min em ms
          limit: 100,
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    CidadaosModule,
    ReportsModule,
    HomeModule,
    EcopontosModule,
    GamificationModule,
    PartilhasModule,
    NoticiasModule,
    UsersModule,
    AnalyticsModule,
    FilaModule,
    RecolhasModule,
    CampanhasModule,
    AuditModule,
    RotasModule,
    EquipasModule,
    CookiesModule,
    AdminModule,
    GeocodingModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

