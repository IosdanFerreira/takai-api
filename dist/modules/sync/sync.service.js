"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const omnia_service_1 = require("../omnia/omnia.service");
const woocommerce_service_1 = require("../woocommerce/woocommerce.service");
const getCityCodeIbge_utils_1 = require("../../shared/utils/getCityCodeIbge.utils");
const proccessPaymentMethod_utils_1 = require("../../shared/utils/proccessPaymentMethod.utils");
const proccessBatch_utils_1 = require("../../shared/utils/proccessBatch.utils");
const retry_utils_1 = require("../../shared/utils/retry.utils");
let SyncService = class SyncService {
    constructor(omniaService, woocommerceService, logger) {
        this.omniaService = omniaService;
        this.woocommerceService = woocommerceService;
        this.logger = logger;
        this.wooProductsMap = new Map();
        this.omniaProductsMap = new Map();
    }
    async processNewOrder(rawBody, signature) {
        if (!rawBody) {
            this.logger.error('Body não encontrado na requisição');
            throw new common_1.BadRequestException('RawBody ausente');
        }
        if (!signature) {
            this.logger.error('Assinatura não encontrada nos headers');
            throw new common_1.BadRequestException('Assinatura do webhook ausente');
        }
        const secret = process.env.WC_CREATED_ORDER_WEBHOOK_SECRET;
        const computedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('base64');
        if (computedSignature !== signature) {
            this.logger.warn('Assinatura inválida do webhook WooCommerce');
            throw new common_1.UnauthorizedException('Assinatura inválida');
        }
        const order = JSON.parse(rawBody.toString('utf8'));
        const ibgeCode = await (0, getCityCodeIbge_utils_1.getIbgeCodeByCep)(order.billing.postcode.replace('-', ''));
        const clientFromNewOrder = this.formatClient(order, ibgeCode);
        const newOrderFormatted = this.formatOrder(order, ibgeCode);
        const clientExist = await this.omniaService.getClientByCpfOrCnpj(order?.billing?.persontype === 'F'
            ? order?.billing?.cpf
            : order?.billing?.cnpj);
        if (clientExist.length === 0) {
            this.logger.warn(clientFromNewOrder, 'Cliente inexistente, criando novo cliente');
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
            this.wooProductsMap = new Map();
            woocommerceProducts.forEach((p) => {
                if (p.sku) {
                    const normalizedSku = String(p.sku);
                    if (!this.wooProductsMap.has(normalizedSku)) {
                        this.wooProductsMap.set(normalizedSku, p);
                    }
                }
                else {
                    this.logger.error(`Produto ${p.name} sem SKU, pulando...`);
                }
            });
            this.omniaProductsMap = new Map();
            const omniaPricesByCodprod = new Map();
            omniaPrices.forEach((p) => {
                const sku = String(p.codprod);
                omniaPricesByCodprod.set(sku, p);
            });
            omniaPricesByCodprod.forEach((price, sku) => {
                this.omniaProductsMap.set(sku, price);
            });
            const newProducts = [];
            const updateProducts = [];
            for (const [sku, product] of this.omniaProductsMap) {
                if (!this.wooProductsMap.has(sku)) {
                    newProducts.push(product);
                    this.logger.debug(`SKU novo, será criado: ${sku}`);
                }
                else {
                    updateProducts.push(product);
                }
            }
            if (newProducts.length > 0) {
                this.logger.warn(`Faltam ${newProducts.length} produtos para criar no WooCommerce.`);
                newProducts.forEach((p) => {
                    this.logger.debug(`Faltando criar: SKU=${p.codprod}`);
                });
            }
            else {
                this.logger.log('Todos os produtos estão sincronizados no WooCommerce.');
            }
            this.logger.log(`Produtos únicos WooCommerce: ${this.wooProductsMap.size} | Produtos únicos Omnia: ${this.omniaProductsMap.size}`);
            this.logger.log(`Produtos novos: ${newProducts.length} | Produtos para atualizar: ${updateProducts.length}`);
            const deleteProducts = Array.from(this.wooProductsMap.values()).filter((p) => {
                if (!p.sku)
                    return false;
                const normalizedSku = String(p.sku);
                return !this.omniaProductsMap.has(normalizedSku);
            });
            this.logger.log(`Total SKUs a remover/rascunho: ${deleteProducts.length}`);
            await Promise.all([
                this.createProductsBatch(newProducts, omniaStock, omniaPrices),
                this.updateProductsBatch(updateProducts, omniaStock, omniaPrices),
                this.deleteProductsBatch(deleteProducts),
            ]);
            await this.verifySyncConsistency();
            const duration = Date.now() - startTime;
            const durationInSeconds = (duration / 1000).toFixed(2);
            this.logger.log(`Sincronização concluída em ${durationInSeconds}s`);
        }
        catch (error) {
            this.logger.error('Erro durante a sincronização:', error);
            throw error;
        }
    }
    async handleCron() {
        this.logger.log('Executando sync automático (a cada hora)');
        await this.syncProducts();
    }
    async createProductsBatch(newProducts, omniaStock, omniaPrices) {
        const failedList = [];
        if (!this.wooProductsMap || this.wooProductsMap.size === 0) {
            const allWooProducts = await this.woocommerceService.getAllProductsConcurrent();
            this.wooProductsMap = new Map();
            allWooProducts.forEach((p) => {
                if (p.sku)
                    this.wooProductsMap.set(p.sku, p);
            });
        }
        await (0, proccessBatch_utils_1.processBatch)(newProducts, async (product) => {
            const sku = String(product.codprod);
            const existingProduct = this.wooProductsMap.get(sku);
            const stockQty = omniaStock.find((s) => String(s.codprod) === sku)?.estoque ?? 0;
            const price = omniaPrices.find((pr) => String(pr.codprod) === sku);
            if (!price) {
                this.logger.warn(`Produto ${sku} sem preço no Omnia, pulando`);
                return;
            }
            try {
                if (existingProduct) {
                    await this.woocommerceService.updateProduct(existingProduct.id, product, { estoque: stockQty }, price);
                    this.logger.log(`🔄 SKU ${sku} já existia, atualizado com sucesso`);
                }
                else {
                    const createdProduct = await this.woocommerceService.createProducts(product, { estoque: stockQty }, price);
                    this.logger.log(`✅ Criado SKU ${sku}`);
                    this.wooProductsMap.set(sku, createdProduct);
                }
            }
            catch (err) {
                const handled = await this.handleProductError(err, sku, product, stockQty, price);
                if (!handled) {
                    failedList.push(sku);
                    this.logger.error(err.response?.data || err.message, `❌ Erro criar SKU ${sku}`);
                }
            }
        });
        if (failedList.length > 0) {
            this.logger.warn(`${failedList.length} produtos não foram criados. SKUs: ${failedList.join(', ')}`);
        }
    }
    async updateProductsBatch(updateProducts, omniaStock, omniaPrices) {
        const failedUpdates = [];
        await (0, proccessBatch_utils_1.processBatch)(updateProducts, async (product) => {
            const sku = String(product.codprod);
            const wcProduct = this.wooProductsMap.get(sku);
            if (!wcProduct) {
                this.logger.warn(`Produto ${sku} não encontrado no WooCommerce para atualização`);
                return;
            }
            const stockQty = omniaStock.find((s) => String(s.codprod) === sku)?.estoque ?? 0;
            const price = omniaPrices.find((pr) => String(pr.codprod) === sku);
            if (!price) {
                this.logger.warn(`Produto ${sku} sem preço no Omnia, pulando atualização`);
                return;
            }
            const changes = [];
            if (wcProduct.stock_quantity !== undefined &&
                Number(wcProduct.stock_quantity) !== stockQty) {
                changes.push(`estoque: ${wcProduct.stock_quantity} → ${stockQty}`);
            }
            if (wcProduct.regular_price &&
                parseFloat(Number(wcProduct.regular_price).toFixed(2)) !==
                    parseFloat(Number(price.pvenda).toFixed(2))) {
                changes.push(`preço: ${wcProduct.regular_price} → ${price.pvenda}`);
            }
            const wcTieredRules = wcProduct.meta_data?.find((m) => m.key === '_fixed_price_rules')
                ?.value || {};
            const omniaTieredRules = price.qtminimaatacado > 1
                ? {
                    [price.qtminimaatacado.toString()]: Number(price.pvendaatacado).toFixed(2),
                }
                : {};
            if (JSON.stringify(wcTieredRules) !== JSON.stringify(omniaTieredRules)) {
                changes.push(`preço atacado: ${JSON.stringify(wcTieredRules)} → ${JSON.stringify(omniaTieredRules)}`);
            }
            if (changes.length > 0) {
                try {
                    await (0, retry_utils_1.retry)(async () => {
                        await this.woocommerceService.updateProduct(wcProduct.id, product, { estoque: stockQty }, price);
                        this.logger.log(`Atualizado SKU ${sku} | Campos alterados: ${changes.join(', ')}`);
                    });
                }
                catch (err) {
                    failedUpdates.push(sku);
                    this.logger.error(err, `❌ Erro atualizar SKU ${sku}`);
                }
            }
        });
        if (failedUpdates.length > 0) {
            this.logger.warn(`${failedUpdates.length} produtos não foram atualizados. SKUs: ${failedUpdates.join(', ')}`);
        }
    }
    async deleteProductsBatch(deleteProducts) {
        const failedDeletes = [];
        await (0, proccessBatch_utils_1.processBatch)(deleteProducts, async (product) => {
            const sku = String(product.sku).trim();
            try {
                await (0, retry_utils_1.retry)(async () => {
                    await this.woocommerceService.deleteProduct(product.id);
                    this.logger.log(`Produto movido para lixeira ${sku}`);
                });
            }
            catch (err) {
                failedDeletes.push(sku);
                this.logger.error(err, `Erro ao deletar SKU ${sku}`);
            }
        });
        if (failedDeletes.length > 0) {
            this.logger.warn(`${failedDeletes.length} produtos não foram removidos. SKUs: ${failedDeletes.join(', ')}`);
        }
    }
    async handleProductError(error, sku, product, stockQty, price) {
        const uniqueSku = error?.response?.data?.data?.unique_sku;
        if (uniqueSku) {
            const normalizedSku = uniqueSku;
            const existingProduct = this.wooProductsMap.get(normalizedSku);
            if (existingProduct) {
                try {
                    await this.woocommerceService.updateProduct(existingProduct.id, product, { estoque: stockQty }, price);
                    this.wooProductsMap.set(normalizedSku, existingProduct);
                    this.logger.warn(`SKU ${sku} já existe como ${uniqueSku}, atualizado com sucesso`);
                    return true;
                }
                catch (err) {
                    this.logger.error(err, `Erro ao atualizar SKU existente ${uniqueSku}`);
                }
            }
        }
        return false;
    }
    async verifySyncConsistency() {
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
            this.logger.log(`   - Produtos faltando no WooCommerce: ${missingInWoo.length}`);
            this.logger.log(`   - Produtos extras no WooCommerce: ${extraInWoo.length}`);
            if (missingInWoo.length > 0) {
                this.logger.warn(`   - SKUs faltantes: ${missingInWoo.slice(0, 10).join(', ')}${missingInWoo.length > 10 ? '...' : ''}`);
            }
            if (extraInWoo.length > 0) {
                this.logger.warn(`   - SKUs extras: ${extraInWoo.slice(0, 10).join(', ')}${extraInWoo.length > 10 ? '...' : ''}`);
            }
            return { missingInWoo, extraInWoo };
        }
        catch (error) {
            this.logger.error('Erro na verificação de consistência:', error);
            return { missingInWoo: [], extraInWoo: [] };
        }
    }
    formatClient(order, ibgeCode) {
        const clientFromNewOrder = {
            codfilial: '4',
            cgcent: order?.billing?.persontype === 'F'
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
    formatOrder(order, ibgeCode) {
        const allProductsValue = order.line_items.reduce((acc, item) => {
            return Number(acc) + Number(item.total);
        }, 0);
        const brand = order.meta_data.find((m) => m.key === '_wc_rede_transaction_brand')?.value;
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
                    formapagamento: brand ? (0, proccessPaymentMethod_utils_1.proccessPaymentMethod)(brand) : 'PIX',
                    idpagamentopix: '',
                    nomeformapagamento: order.payment_method_title,
                    nsucartao: order.meta_data.find((m) => m.key === '_wc_rede_transaction_nsu')?.value,
                    parcelas: Number(order.meta_data.find((m) => m.key === '_wc_rede_transaction_installments')?.value ?? 1),
                    valorpago: parseFloat(order.total),
                },
            ],
        };
        return newOrderFormatted;
    }
};
exports.SyncService = SyncService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncService.prototype, "handleCron", null);
exports.SyncService = SyncService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [omnia_service_1.OmniaService,
        woocommerce_service_1.WoocommerceService,
        common_1.Logger])
], SyncService);
//# sourceMappingURL=sync.service.js.map