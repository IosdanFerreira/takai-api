import {
  Controller,
  Post,
  Headers,
  Req,
  Res,
  Get,
  Logger,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { Request, Response } from 'express';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly logger: Logger,
  ) {}

  @Post('woocommerce/webhook/created-order')
  async handleOrderCreated(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-signature') signature: string,
  ) {
    try {
      await this.syncService.processNewOrder(req.body, signature);

      res.status(200).send({ received: true });
    } catch (error) {
      console.error('Erro ao processar webhook', error);
      res.status(500).send({ error: 'Erro interno' });
    }
  }

  @Get('all-products-from-apis')
  async getAllProductsFromApis() {
    this.logger.log('Iniciando busca de produtos, estoque e preços...');
    return await this.syncService.syncProducts();
  }
}
