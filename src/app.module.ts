import { Logger, Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { OmniaModule } from './modules/omnia/omnia.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncModule } from './modules/sync/sync.module';
import { SyncService } from './modules/sync/sync.service';
import { WoocommerceModule } from './modules/woocommerce/woocommerce.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    WoocommerceModule,
    OmniaModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService, SyncService, Logger],
})
export class AppModule {}
