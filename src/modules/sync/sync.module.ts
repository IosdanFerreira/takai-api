import { Logger, Module } from '@nestjs/common';

import { OmniaService } from '../omnia/omnia.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, WoocommerceService, OmniaService, Logger],
})
export class SyncModule {}
