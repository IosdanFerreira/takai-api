import * as crypto from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CreateOmniClientDto } from '../omnia/interfaces/omnia-create-client.interface';
import { OmniaPriceInterface } from '../omnia/interfaces/omnia-price.interface';
import { OmniaProduct } from '../omnia/interfaces/omnia-product';
import { OmniaService } from '../omnia/omnia.service';
import { OmniaStockInterface } from '../omnia/interfaces/omnia-stock.interface';
import { Order } from 'src/shared/interfaces/woocommerce-order.interface';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { getIbgeCodeByCep } from 'src/shared/utils/getCityCodeIbge.utils';
import { proccessPaymentMethod } from 'src/shared/utils/proccessPaymentMethod.utils';
import { processBatch } from 'src/shared/utils/proccessBatch.utils';
import { retry } from 'src/shared/utils/retry.utils';

@Injectable()
export class SyncService {
  private wooProductsMap: Map<string, any> = new Map();
  private omniaProductsMap: Map<string, any> = new Map();

  constructor(
    private readonly omniaService: OmniaService,
    private readonly woocommerceService: WoocommerceService,
    private readonly logger: Logger,
  ) {}

  async processNewOrder(rawBody: Buffer, signature: string) {
    if (!rawBody) {
      this.logger.error('Body não encontrado na requisição');
      throw new BadRequestException('RawBody ausente');
    }

    if (!signature) {
      this.logger.error('Assinatura não encontrada nos headers');
      throw new BadRequestException('Assinatura do webhook ausente');
    }

    const secret = process.env.WC_CREATED_ORDER_WEBHOOK_SECRET!;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    if (computedSignature !== signature) {
      this.logger.warn('Assinatura inválida do webhook WooCommerce');
      throw new UnauthorizedException('Assinatura inválida');
    }

    const order: Order = JSON.parse(rawBody.toString('utf8'));

    const ibgeCode = await getIbgeCodeByCep(
      order.billing.postcode.replace('-', ''),
    );

    const clientFromNewOrder = this.formatClient(order, ibgeCode);

    const newOrderFormatted = this.formatOrder(order, ibgeCode);

    const clientExist = await this.omniaService.getClientByCpfOrCnpj(
      order?.billing?.persontype === 'F'
        ? order?.billing?.cpf
        : order?.billing?.cnpj,
    );

    if (clientExist.length === 0) {
      this.logger.warn(
        clientFromNewOrder,
        'Cliente inexistente, criando novo cliente',
      );

      await this.omniaService.createClient(clientFromNewOrder);
    }

    if (!order.date_paid) {
      this.logger.error('Pedido sem data de pagamento', order);
      return;
    }

    const newOrder = await this.omniaService.createOrder(newOrderFormatted);

    this.logger.log('Pedido criado com sucesso', newOrder);
  }

  async syncProducts() {
    const startTime = Date.now();
    this.logger.log('Iniciando sincronização de produtos');

    try {
      const [woocommerceProducts, omniaStock, omniaPrices] = await Promise.all([
        this.woocommerceService.getAllProductsConcurrent(),
        this.omniaService.getStock(),
        this.omniaService.getPrices(),
      ]);

      // Mapa de produtos WooCommerce (usando SKU único)
      this.wooProductsMap = new Map();
      woocommerceProducts.forEach((p) => {
        if (p.sku) {
          const normalizedSku = String(p.sku);
          // Se já existe, mantém o primeiro
          if (!this.wooProductsMap.has(normalizedSku)) {
            this.wooProductsMap.set(normalizedSku, p);
          }
        } else {
          this.logger.error(`Produto ${p.name} sem SKU, pulando...`);
        }
      });

      // Mapa de produtos Omnia (usando preços, considerando apenas valores únicos)
      this.omniaProductsMap = new Map();

      // Primeiro, criar um mapa para agrupar por codprod (último preço vence)
      const omniaPricesByCodprod = new Map();

      omniaPrices.forEach((p) => {
        const sku = String(p.codprod);
        omniaPricesByCodprod.set(sku, p); // Último valor sobrescreve
      });

      // Agora popular o mapa principal
      omniaPricesByCodprod.forEach((price, sku) => {
        this.omniaProductsMap.set(sku, price);
      });

      const newProducts: OmniaPriceInterface[] = [];
      const updateProducts: OmniaPriceInterface[] = [];

      // Verificar produtos do Omnia que não existem no WooCommerce
      for (const [sku, product] of this.omniaProductsMap) {
        if (!this.wooProductsMap.has(sku)) {
          newProducts.push(product);
          this.logger.debug(`SKU novo, será criado: ${sku}`);
        } else {
          updateProducts.push(product);
        }
      }

      // Mostra os produtos que estão faltando criar no WooCommerce
      if (newProducts.length > 0) {
        this.logger.warn(
          `Faltam ${newProducts.length} produtos para criar no WooCommerce.`,
        );
        newProducts.forEach((p) => {
          this.logger.debug(`Faltando criar: SKU=${p.codprod}`);
        });
      } else {
        this.logger.log(
          'Todos os produtos estão sincronizados no WooCommerce.',
        );
      }

      this.logger.log(
        `Produtos únicos WooCommerce: ${this.wooProductsMap.size} | Produtos únicos Omnia: ${this.omniaProductsMap.size}`,
      );

      this.logger.log(
        `Produtos novos: ${newProducts.length} | Produtos para atualizar: ${updateProducts.length}`,
      );

      // Produtos para remover (existem no Woo mas não no Omnia)
      const deleteProducts = Array.from(this.wooProductsMap.values()).filter(
        (p) => {
          if (!p.sku) return false;
          const normalizedSku = String(p.sku);
          return !this.omniaProductsMap.has(normalizedSku);
        },
      );

      this.logger.log(
        `Total SKUs a remover/rascunho: ${deleteProducts.length}`,
      );

      // Executar em paralelo para melhor performance
      await Promise.all([
        this.createProductsBatch(newProducts, omniaStock, omniaPrices),
        this.updateProductsBatch(updateProducts, omniaStock, omniaPrices),
        this.deleteProductsBatch(deleteProducts),
      ]);

      // Verificar consistência após sincronização
      await this.verifySyncConsistency();

      const duration = Date.now() - startTime;
      const durationInSeconds = (duration / 1000).toFixed(2);

      this.logger.log(`Sincronização concluída em ${durationInSeconds}s`);
    } catch (error) {
      this.logger.error('Erro durante a sincronização:', error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Executando sync automático (a cada hora)');
    await this.syncProducts();
  }

  private async createProductsBatch(
    newProducts: OmniaPriceInterface[],
    omniaStock: OmniaStockInterface[],
    omniaPrices: OmniaPriceInterface[],
  ) {
    const failedList: string[] = [];

    // Garantir que o mapa tenha todos os produtos existentes do WooCommerce
    if (!this.wooProductsMap || this.wooProductsMap.size === 0) {
      const allWooProducts =
        await this.woocommerceService.getAllProductsConcurrent();
      this.wooProductsMap = new Map();
      allWooProducts.forEach((p) => {
        if (p.sku) this.wooProductsMap.set(p.sku, p);
      });
    }

    await processBatch(newProducts, async (product) => {
      const sku = String(product.codprod);
      const existingProduct = this.wooProductsMap.get(sku);

      const stockQty =
        omniaStock.find((s) => String(s.codprod) === sku)?.estoque ?? 0;
      const price = omniaPrices.find((pr) => String(pr.codprod) === sku);

      if (!price) {
        this.logger.warn(`Produto ${sku} sem preço no Omnia, pulando`);
        return;
      }

      try {
        if (existingProduct) {
          // Atualiza produto existente
          await this.woocommerceService.updateProduct(
            existingProduct.id,
            product,
            { estoque: stockQty },
            price,
          );
          this.logger.log(`🔄 SKU ${sku} já existia, atualizado com sucesso`);
        } else {
          // Cria produto novo
          const createdProduct = await this.woocommerceService.createProducts(
            product,
            { estoque: stockQty },
            price,
          );
          this.logger.log(`✅ Criado SKU ${sku}`);

          // Adicionar ao mapa local
          this.wooProductsMap.set(sku, createdProduct);
        }
      } catch (err: any) {
        // Tratar erro de SKU duplicado
        const handled = await this.handleProductError(
          err,
          sku,
          product,
          stockQty,
          price,
        );
        if (!handled) {
          failedList.push(sku);
          this.logger.error(
            err.response?.data || err.message,
            `❌ Erro criar SKU ${sku}`,
          );
        }
      }
    });

    if (failedList.length > 0) {
      this.logger.warn(
        `${failedList.length} produtos não foram criados. SKUs: ${failedList.join(', ')}`,
      );
    }
  }

  private async updateProductsBatch(
    updateProducts: OmniaPriceInterface[],
    omniaStock: OmniaStockInterface[],
    omniaPrices: OmniaPriceInterface[],
  ) {
    const failedUpdates: string[] = [];

    await processBatch(updateProducts, async (product) => {
      const sku = String(product.codprod);
      const wcProduct = this.wooProductsMap.get(sku);

      if (!wcProduct) {
        this.logger.warn(
          `Produto ${sku} não encontrado no WooCommerce para atualização`,
        );
        return;
      }

      const stockQty =
        omniaStock.find((s) => String(s.codprod) === sku)?.estoque ?? 0;
      const price = omniaPrices.find((pr) => String(pr.codprod) === sku);

      if (!price) {
        this.logger.warn(
          `Produto ${sku} sem preço no Omnia, pulando atualização`,
        );
        return;
      }

      const changes: string[] = [];

      // Verificar se há mudanças no estoque
      if (
        wcProduct.stock_quantity !== undefined &&
        Number(wcProduct.stock_quantity) !== stockQty
      ) {
        changes.push(`estoque: ${wcProduct.stock_quantity} → ${stockQty}`);
      }

      // Verificar se há mudanças no preço
      if (
        wcProduct.regular_price &&
        parseFloat(Number(wcProduct.regular_price).toFixed(2)) !==
          parseFloat(Number(price.pvenda).toFixed(2))
      ) {
        changes.push(`preço: ${wcProduct.regular_price} → ${price.pvenda}`);
      }

      // Verificar regras de preço atacado
      const wcTieredRules =
        wcProduct.meta_data?.find((m: any) => m.key === '_fixed_price_rules')
          ?.value || {};
      const omniaTieredRules =
        price.qtminimaatacado > 1
          ? {
              [price.qtminimaatacado.toString()]: Number(
                price.pvendaatacado,
              ).toFixed(2),
            }
          : {};

      if (JSON.stringify(wcTieredRules) !== JSON.stringify(omniaTieredRules)) {
        changes.push(
          `preço atacado: ${JSON.stringify(wcTieredRules)} → ${JSON.stringify(omniaTieredRules)}`,
        );
      }

      if (changes.length > 0) {
        try {
          await retry(async () => {
            await this.woocommerceService.updateProduct(
              wcProduct.id,
              product,
              { estoque: stockQty },
              price,
            );
            this.logger.log(
              `Atualizado SKU ${sku} | Campos alterados: ${changes.join(', ')}`,
            );
          });
        } catch (err) {
          failedUpdates.push(sku);
          this.logger.error(err, `❌ Erro atualizar SKU ${sku}`);
        }
      }
    });

    if (failedUpdates.length > 0) {
      this.logger.warn(
        `${failedUpdates.length} produtos não foram atualizados. SKUs: ${failedUpdates.join(', ')}`,
      );
    }
  }

  private async deleteProductsBatch(deleteProducts: any[]) {
    const failedDeletes: string[] = [];

    await processBatch(deleteProducts, async (product) => {
      const sku = String(product.sku).trim();

      try {
        await retry(async () => {
          await this.woocommerceService.deleteProduct(product.id);
          this.logger.log(`Produto movido para lixeira ${sku}`);
        });
      } catch (err) {
        failedDeletes.push(sku);
        this.logger.error(err, `Erro ao deletar SKU ${sku}`);
      }
    });

    if (failedDeletes.length > 0) {
      this.logger.warn(
        `${failedDeletes.length} produtos não foram removidos. SKUs: ${failedDeletes.join(', ')}`,
      );
    }
  }

  private async handleProductError(
    error: any,
    sku: string,
    product: OmniaProduct,
    stockQty: number,
    price: OmniaPriceInterface,
  ): Promise<boolean> {
    const uniqueSku = error?.response?.data?.data?.unique_sku;

    if (uniqueSku) {
      const normalizedSku = uniqueSku;
      const existingProduct = this.wooProductsMap.get(normalizedSku);

      if (existingProduct) {
        try {
          await this.woocommerceService.updateProduct(
            existingProduct.id,
            product,
            { estoque: stockQty },
            price,
          );

          // Atualiza o mapa com os dados atualizados
          this.wooProductsMap.set(normalizedSku, existingProduct);
          this.logger.warn(
            `SKU ${sku} já existe como ${uniqueSku}, atualizado com sucesso`,
          );
          return true;
        } catch (err) {
          this.logger.error(
            err,
            `Erro ao atualizar SKU existente ${uniqueSku}`,
          );
        }
      }
    }

    return false; // se não conseguiu tratar, retorna false
  }

  private async verifySyncConsistency() {
    try {
      const [wooProducts, omniaProducts] = await Promise.all([
        this.woocommerceService.getAllProductsConcurrent(),
        this.omniaService.getPrices(),
      ]);

      const wooSkus = wooProducts
        .map((p) => (p.sku ? p.sku : ''))
        .filter((sku) => sku !== '');

      const omniaSkus = omniaProducts
        .map((p) => String(p.codprod))
        .filter((sku) => sku !== '');

      const missingInWoo = omniaSkus.filter((sku) => !wooSkus.includes(sku));
      const extraInWoo = wooSkus.filter((sku) => !omniaSkus.includes(sku));

      this.logger.log(`Verificação de consistência:`);
      this.logger.log(
        `   - Produtos faltando no WooCommerce: ${missingInWoo.length}`,
      );
      this.logger.log(
        `   - Produtos extras no WooCommerce: ${extraInWoo.length}`,
      );

      if (missingInWoo.length > 0) {
        this.logger.warn(
          `   - SKUs faltantes: ${missingInWoo.slice(0, 10).join(', ')}${missingInWoo.length > 10 ? '...' : ''}`,
        );
      }

      if (extraInWoo.length > 0) {
        this.logger.warn(
          `   - SKUs extras: ${extraInWoo.slice(0, 10).join(', ')}${extraInWoo.length > 10 ? '...' : ''}`,
        );
      }

      return { missingInWoo, extraInWoo };
    } catch (error) {
      this.logger.error('Erro na verificação de consistência:', error);
      return { missingInWoo: [], extraInWoo: [] };
    }
  }

  private formatClient(order: Order, ibgeCode: string): CreateOmniClientDto {
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

  private formatOrder(order: Order, ibgeCode: string) {
    const allProductsValue = order.line_items.reduce((acc, item) => {
      return Number(acc) + Number(item.total);
    }, 0);

    const brand = order.meta_data.find(
      (m) => m.key === '_wc_rede_transaction_brand',
    )?.value;

    const newOrderFormatted = {
      codparceiro: 'DIGITAL',
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
      telcelent: order.billing.phone.replace(/\D/g, ''),
      fretedespacho: 'C',
      idtransportadora: order.shipping_lines[0].method_title,
      vlprodutos: allProductsValue,
      vlfrete: order.shipping_total,
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
          formapagamento: brand ? proccessPaymentMethod(brand) : 'PIX',
          idpagamentopix: '',
          nomeformapagamento: order.payment_method_title,
          nsucartao: order.meta_data.find(
            (m) => m.key === '_wc_rede_transaction_nsu',
          )?.value,
          parcelas: Number(
            order.meta_data.find(
              (m) => m.key === '_wc_rede_transaction_installments',
            )?.value ?? 1,
          ),
          valorpago: parseFloat(order.total),
        },
      ],
    };

    return newOrderFormatted;
  }
}
