import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { OmniaModule } from './modules/omnia/omnia.module';
import { SyncModule } from './modules/sync/sync.module';
import { WoocommerceModule } from './modules/woocommerce/woocommerce.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WoocommerceModule,
    OmniaModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
