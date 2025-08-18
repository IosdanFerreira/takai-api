import * as crypto from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { OmniaPriceInterface } from '../omnia/interfaces/omnia-price.interface';
import { OmniaProduct } from '../omnia/interfaces/omnia-product';
import { OmniaService } from '../omnia/omnia.service';
import { Order } from 'src/shared/interfaces/woocommerce-order.interface';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { getIbgeCodeByCep } from 'src/shared/utils/getCityCodeIbge.utils';
import { processBatch } from 'src/shared/utils/proccessBatch.utils';
import { retry } from 'src/shared/utils/retry.utils';

@Injectable()
export class SyncService {
  constructor(
    private readonly omniaService: OmniaService,
    private readonly woocommerceService: WoocommerceService,
    private logger: Logger,
  ) {}

  async processNewOrder(rawBody: Buffer, signature: string) {
    if (!rawBody) {
      this.logger.error('❌ Body não encontrado na requisição');
      throw new BadRequestException('RawBody ausente');
    }

    if (!signature) {
      this.logger.error('❌ Assinatura não encontrada nos headers');
      throw new BadRequestException('Assinatura do webhook ausente');
    }

    const secret = process.env.WC_CREATED_ORDER_WEBHOOK_SECRET!;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    if (computedSignature !== signature) {
      this.logger.warn('❌ Assinatura inválida do webhook WooCommerce');
      throw new UnauthorizedException('Assinatura inválida');
    }

    const order: Order = JSON.parse(rawBody.toString('utf8'));

    const ibgeCode = await getIbgeCodeByCep(
      order.billing.postcode.replace('-', ''),
    );

    const clientFromNewOrder = this.formatClient(order);

    const newOrderFormatted = this.formatOrder(order, ibgeCode);

    const clientExist = await this.omniaService.getClientByCpfOrCnpj(
      order?.billing?.persontype === 'F'
        ? order?.billing?.cpf
        : order?.billing?.cnpj,
    );

    if (clientExist.length === 0) {
      this.logger.warn(
        'Cliente inexistente, criando novo cliente',
        clientFromNewOrder,
      );
    }

    console.log('Criando um novo pedido', newOrderFormatted);
  }

  async syncProducts() {
    const startTime = Date.now();

    const [woocommerceProducts, omniaProducts, omniaStock, omniaPrices] =
      await Promise.all([
        this.woocommerceService.getAllProductsConcurrent(),
        this.omniaService.getProducts(),
        this.omniaService.getStock(),
        this.omniaService.getPrices(),
      ]);

    this.logger.log(
      `WooCommerce: ${woocommerceProducts.length} produtos carregados`,
    );
    this.logger.log(`Omnia: ${omniaProducts.length} produtos`);
    this.logger.log(`Omnia Estoque: ${omniaStock.length}`);
    this.logger.log(`Omnia Preços: ${omniaPrices.length}`);

    // Mapas
    const wcProductMap = new Map<string, any>();
    const wcSkus = new Set<string>();

    woocommerceProducts.forEach((p) => {
      if (!p.sku) {
        this.logger.warn(`Produto Woo sem SKU: ID ${p.id}`);
        return;
      }
      const sku = String(p.sku).trim();
      wcProductMap.set(sku, p);
      wcSkus.add(sku);
    });

    const omniaProductMap = new Map<string, OmniaProduct>();
    const omniaPriceMap = new Map<string, OmniaPriceInterface>();
    const omniaStockMap = new Map<string, number>();

    omniaProducts.forEach((p) => omniaProductMap.set(String(p.codprod), p));
    omniaPrices.forEach((pr) => omniaPriceMap.set(String(pr.codprod), pr));
    omniaStock.forEach((s) => {
      const sku = String(s.codprod);
      const current = omniaStockMap.get(sku) ?? 0;
      omniaStockMap.set(sku, current + Number(s.estoque ?? 0));
    });

    // Categorizar
    const newProducts = omniaProducts.filter(
      (p) => !wcSkus.has(String(p.codprod).trim()),
    );
    const updateProducts = omniaProducts.filter((p) =>
      wcSkus.has(String(p.codprod).trim()),
    );
    const deleteProducts = woocommerceProducts.filter(
      (p) => p.sku && !omniaProductMap.has(String(p.sku).trim()),
    );

    this.logger.log(
      `Produtos novos: ${newProducts.length}, atualizar: ${updateProducts.length}, deletar: ${deleteProducts.length}`,
    );

    // 🔥 Orquestrar batches
    await this.createProductsBatch(
      newProducts,
      wcSkus,
      omniaStockMap,
      omniaPriceMap,
    );
    await this.updateProductsBatch(
      updateProducts,
      wcProductMap,
      omniaStockMap,
      omniaPriceMap,
    );
    await this.deleteProductsBatch(deleteProducts);

    const duration = Date.now() - startTime;
    this.logger.log(`✅ Sincronização concluída em ${duration}ms`);
  }

  private async createProductsBatch(
    newProducts: OmniaProduct[],
    wcSkus: Set<string>,
    omniaStockMap: Map<string, number>,
    omniaPriceMap: Map<string, OmniaPriceInterface>,
  ) {
    const seenSkus = new Set<string>();
    await processBatch(newProducts, async (product) => {
      const sku = String(product.codprod).trim();
      if (wcSkus.has(sku) || seenSkus.has(sku)) return;
      seenSkus.add(sku);

      const stockQty = omniaStockMap.get(sku) ?? 0;
      const price = omniaPriceMap.get(sku);

      this.logger.debug(
        `Criando SKU ${sku} | Estoque: ${stockQty} | Preço: ${price?.pvenda}`,
      );

      await retry(async () => {
        await this.woocommerceService.createProducts(
          product,
          { estoque: stockQty },
          price,
        );
        this.logger.log(`✅ Criado SKU ${sku}`);
      }).catch((err) => this.logger.error(`❌ Erro criar SKU ${sku}`, err));
    });
  }

  private async updateProductsBatch(
    updateProducts: OmniaProduct[],
    wcProductMap: Map<string, any>,
    omniaStockMap: Map<string, number>,
    omniaPriceMap: Map<string, OmniaPriceInterface>,
  ) {
    await processBatch(updateProducts, async (product) => {
      const sku = String(product.codprod).trim();
      const wcProduct = wcProductMap.get(sku);
      const stockQty = Math.floor(omniaStockMap.get(sku) ?? 0);
      const price = omniaPriceMap.get(sku);

      if (!wcProduct || !price) return;

      const changes: string[] = [];

      const wcStock = Number(wcProduct.stock_quantity);
      if (wcStock !== stockQty)
        changes.push(`estoque: ${wcStock} → ${stockQty}`);

      const wcPrice = parseFloat(Number(wcProduct.regular_price).toFixed(2));
      const omniaPriceRounded = parseFloat(Number(price.pvenda).toFixed(2));
      if (wcPrice !== omniaPriceRounded)
        changes.push(`preço: ${wcPrice} → ${omniaPriceRounded}`);

      if (changes.length > 0) {
        this.logger.debug(
          `Atualizando SKU ${sku} | Woo: ${wcStock} | Omnia: ${stockQty} | Preço: ${price.pvenda}`,
        );

        await retry(async () => {
          await this.woocommerceService.updateProduct(
            wcProduct.id,
            product,
            { estoque: stockQty },
            price,
          );
          this.logger.log(
            `🔄 Atualizado SKU ${sku} | Campos alterados: ${changes.join(', ')}`,
          );
        }).catch((err) =>
          this.logger.error(`❌ Erro atualizar SKU ${sku}`, err),
        );
      } else {
        this.logger.debug(`⏭️ Nenhuma mudança para SKU ${sku}, pulando update`);
      }
    });
  }

  private async deleteProductsBatch(deleteProducts: any[]) {
    await processBatch(deleteProducts, async (product) => {
      await retry(async () => {
        await this.woocommerceService.deleteProduct(product.id);
        this.logger.log(`🗑️ Atualizado draft SKU ${product.sku}`);
      }).catch((err) =>
        this.logger.error(`Erro draft SKU ${product.sku}`, err),
      );
    });
  }

  private formatClient(order: Order, ibgeCode?: string) {
    const clientFromNewOrder = {
      codfilial: '4',
      cgcent:
        order?.billing?.persontype === 'F'
          ? order?.billing?.cpf
          : order?.billing?.cnpj,
      ieent: 'ISENTO',
      cliente: `${order.billing.first_name} ${order.billing.last_name}`,
      fantasia: order.billing.company ?? '',
      emailnfe: order.billing.email,
      codcidadeibge: ibgeCode,
      enderent: order.billing.address_1,
      numeroent: order.billing.number,
      complementoent: order.billing.address_2,
      bairroent: order.billing.neighborhood,
      municent: order.billing.city,
      estent: order.billing.state,
      cepent: order.billing.postcode.replace('-', ''),
      telent: order.billing.phone.replace(/\D/g, ''),
      telcelent: order.billing.phone.replace(/\D/g, ''),
    };

    return clientFromNewOrder;
  }

  private formatOrder(order: Order, ibgeCode?: string) {
    const allProductsValue = order.line_items.reduce((acc, item) => {
      return Number(acc) + Number(item.total);
    }, 0);

    const newOrderFormatted = {
      codparceiro: 'MIT-TECH',
      numpedweb: `PED-${order.number}`,
      data: order.date_created,
      condvenda: 1,
      codfilial: '4',
      cliente: `${order.billing.first_name} ${order.billing.last_name}`,
      fantasia: order.billing.company ?? '',
      cnpj: order.billing.cnpj,
      ieent: 'ISENTO',
      rg: '',
      emailnfe: order.billing.email,
      enderent: order.billing.address_1,
      complementoent: order.billing.address_2,
      numeroent: order.billing.number,
      bairroent: order.billing.neighborhood,
      cepent: order.billing.postcode.replace('-', ''),
      estent: order.billing.state,
      municent: order.billing.city,
      codcidadeibge: ibgeCode,
      telent: order.billing.phone.replace(/\D/g, ''),
      telcelent: order.billing.cellphone.replace(/\D/g, ''),
      fretedespacho: 'C',
      idtransportadora: 'CORREIOS SEDEX',
      vlprodutos: allProductsValue,
      vlfrete: order.shipping_tax,
      vltotal: order.total,
      itens: order.line_items.map((item) => {
        return {
          codprod: Number(item.sku),
          nomeproduto: item.name,
          pvenda: item.total,
          pvendabase: item.total,
          qt: item.quantity,
          brinde: 'N',
        };
      }),
      pagamentos: [
        {
          adquirente: 'CIELO',
          formapagamento: order.payment_method,
          idpagamentopix: '',
          nomeformapagamento: order.payment_method_title,
          nsucartao: '102030',
          parcelas: 3,
          valorpago: 120.0,
        },
      ],
    };

    return newOrderFormatted;
  }
}
