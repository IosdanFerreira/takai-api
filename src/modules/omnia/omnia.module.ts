import { Logger, Module } from '@nestjs/common';

import { OmniaController } from './omnia.controller';
import { OmniaService } from './omnia.service';

@Module({
  controllers: [OmniaController],
  providers: [OmniaService, Logger],
  exports: [OmniaService],
})
export class OmniaModule {}
