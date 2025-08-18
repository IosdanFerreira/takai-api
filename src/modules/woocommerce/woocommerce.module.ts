import { Logger, Module } from '@nestjs/common';

import { WoocommerceController } from './woocommerce.controller';
import { WoocommerceService } from './woocommerce.service';

@Module({
  controllers: [WoocommerceController],
  providers: [WoocommerceService, Logger],
  exports: [WoocommerceService],
})
export class WoocommerceModule {}
