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
const normalizeSku_utils_1 = require("../../shared/utils/normalizeSku.utils");
const proccessBatch_utils_1 = require("../../shared/utils/proccessBatch.utils");
const retry_utils_1 = require("../../shared/utils/retry.utils");
let SyncService = class SyncService {
    constructor(omniaService, woocommerceService, logger) {
        this.omniaService = omniaService;
        this.woocommerceService = woocommerceService;
        this.logger = logger;
    }
    async processNewOrder(rawBody, signature) {
        if (!rawBody) {
            this.logger.error('❌ Body não encontrado na requisição');
            throw new common_1.BadRequestException('RawBody ausente');
        }
        if (!signature) {
            this.logger.error('❌ Assinatura não encontrada nos headers');
            throw new common_1.BadRequestException('Assinatura do webhook ausente');
        }
        const secret = process.env.WC_CREATED_ORDER_WEBHOOK_SECRET;
        const computedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('base64');
        if (computedSignature !== signature) {
            this.logger.warn('❌ Assinatura inválida do webhook WooCommerce');
            throw new common_1.UnauthorizedException('Assinatura inválida');
        }
        const order = JSON.parse(rawBody.toString('utf8'));
        const ibgeCode = await (0, getCityCodeIbge_utils_1.getIbgeCodeByCep)(order.billing.postcode.replace('-', ''));
        const clientFromNewOrder = this.formatClient(order);
        const newOrderFormatted = this.formatOrder(order, ibgeCode);
        const clientExist = await this.omniaService.getClientByCpfOrCnpj(order?.billing?.persontype === 'F'
            ? order?.billing?.cpf
            : order?.billing?.cnpj);
        if (clientExist.length === 0) {
            this.logger.warn('Cliente inexistente, criando novo cliente', clientFromNewOrder);
        }
        console.log('Criando um novo pedido', newOrderFormatted);
    }
    async syncProducts() {
        const startTime = Date.now();
        const [woocommerceProducts, omniaProducts, omniaStock, omniaPrices] = await Promise.all([
            this.woocommerceService.getAllProductsConcurrent(),
            this.omniaService.getProducts(),
            this.omniaService.getStock(),
            this.omniaService.getPrices(),
        ]);
        this.logger.log(`WooCommerce: ${woocommerceProducts.length} produtos carregados`);
        this.logger.log(`Omnia: ${omniaProducts.length} produtos`);
        this.logger.log(`Omnia Estoque: ${omniaStock.length}`);
        this.logger.log(`Omnia Preços: ${omniaPrices.length}`);
        const wcProductMap = new Map();
        const wcSkus = new Set();
        woocommerceProducts.forEach((p) => {
            if (!p.sku)
                return;
            const sku = (0, normalizeSku_utils_1.normalizeSku)(p.sku);
            wcProductMap.set(sku, p);
            wcSkus.add(sku);
        });
        const omniaProductMap = new Map();
        const omniaPriceMap = new Map();
        const omniaStockMap = new Map();
        omniaProducts.forEach((p) => omniaProductMap.set(String(p.codprod), p));
        omniaPrices.forEach((pr) => omniaPriceMap.set(String(pr.codprod), pr));
        omniaStock.forEach((s) => {
            const sku = String(s.codprod);
            const current = omniaStockMap.get(sku) ?? 0;
            omniaStockMap.set(sku, current + Number(s.estoque ?? 0));
        });
        const newProducts = [];
        const updateProducts = [];
        omniaProducts.forEach((p) => {
            const sku = (0, normalizeSku_utils_1.normalizeSku)(String(p.codprod));
            if (wcSkus.has(sku)) {
                updateProducts.push(p);
            }
            else {
                newProducts.push(p);
            }
        });
        const deleteProducts = woocommerceProducts.filter((p) => p.sku &&
            !omniaProducts.some((op) => (0, normalizeSku_utils_1.normalizeSku)(String(op.codprod)) === (0, normalizeSku_utils_1.normalizeSku)(p.sku)));
        this.logger.log(`Produtos novos: ${newProducts.length}, atualizar: ${updateProducts.length}, deletar: ${deleteProducts.length}`);
        await this.createProductsBatch(newProducts, wcSkus, wcProductMap, omniaStockMap, omniaPriceMap);
        await this.updateProductsBatch(updateProducts, wcProductMap, omniaStockMap, omniaPriceMap);
        await this.deleteProductsBatch(deleteProducts);
        const duration = Date.now() - startTime;
        this.logger.log(`✅ Sincronização concluída em ${duration}ms`);
    }
    async handleCron() {
        this.logger.log('⏰ Executando sync automático (a cada hora)');
        await this.syncProducts();
    }
    async createProductsBatch(newProducts, wcSkus, wcProductMap, omniaStockMap, omniaPriceMap) {
        const seenSkus = new Set();
        const failedSkus = new Set();
        await (0, proccessBatch_utils_1.processBatch)(newProducts, async (product) => {
            const sku = (0, normalizeSku_utils_1.normalizeSku)(String(product.codprod));
            if (wcSkus.has(sku) || seenSkus.has(sku) || failedSkus.has(sku))
                return;
            seenSkus.add(sku);
            const stockQty = omniaStockMap.get(sku) ?? 0;
            const price = omniaPriceMap.get(sku);
            if (!price) {
                this.logger.warn(`Produto ${sku} sem preço no Omnia, pulando criação`);
                return;
            }
            await (0, retry_utils_1.retry)(async () => {
                try {
                    await this.woocommerceService.createProducts(product, { estoque: stockQty }, price);
                    this.logger.log(`Criado SKU ${sku}`);
                }
                catch (err) {
                    const code = err?.response?.data?.code;
                    const uniqueSku = err?.response?.data?.unique_sku;
                    if (code === 'product_invalid_sku' ||
                        code === 'woocommerce_rest_product_not_created') {
                        let wcProduct = wcProductMap.get(sku);
                        if (!wcProduct && uniqueSku) {
                            wcProduct = await this.woocommerceService
                                .getProductBySku(uniqueSku)
                                .catch(() => null);
                            if (wcProduct)
                                wcProductMap.set(sku, wcProduct);
                        }
                        if (!wcProduct) {
                            this.logger.error(`SKU ${sku} já existe no WooCommerce mas não encontrado, pulando update`);
                            failedSkus.add(sku);
                            return;
                        }
                        this.logger.warn(`SKU ${sku} já existe, movendo para fluxo de update`);
                        await this.woocommerceService.updateProduct(wcProduct.id, product, { estoque: stockQty }, price);
                        this.logger.log(`Atualizado SKU ${sku} no lugar de criar`);
                        return;
                    }
                    throw err;
                }
            }).catch((err) => this.logger.error(`❌ Erro criar SKU ${sku}`, err));
        });
    }
    async updateProductsBatch(updateProducts, wcProductMap, omniaStockMap, omniaPriceMap) {
        await (0, proccessBatch_utils_1.processBatch)(updateProducts, async (product) => {
            const sku = String(product.codprod).trim();
            const wcProduct = wcProductMap.get(sku);
            const stockQty = omniaStockMap.get(sku) ?? 0;
            const price = omniaPriceMap.get(sku);
            if (!wcProduct || !price)
                return;
            const changes = [];
            const wcStock = Number(wcProduct.stock_quantity);
            if (wcStock !== stockQty)
                changes.push(`estoque: ${wcStock} → ${stockQty}`);
            const wcPrice = parseFloat(Number(wcProduct.regular_price).toFixed(2));
            const omniaPriceRounded = parseFloat(Number(price.pvenda).toFixed(2));
            if (wcPrice !== omniaPriceRounded)
                changes.push(`preço: ${wcPrice} → ${omniaPriceRounded}`);
            if (changes.length > 0) {
                await (0, retry_utils_1.retry)(async () => {
                    await this.woocommerceService.updateProduct(wcProduct.id, product, { estoque: stockQty }, price);
                    this.logger.log(`Atualizado SKU ${sku} | Campos alterados: ${changes.join(', ')}`);
                }).catch((err) => this.logger.error(`❌ Erro atualizar SKU ${sku}`, err));
            }
        });
    }
    async deleteProductsBatch(deleteProducts) {
        await (0, proccessBatch_utils_1.processBatch)(deleteProducts, async (product) => {
            const sku = String(product.sku).trim();
            await (0, retry_utils_1.retry)(async () => {
                await this.woocommerceService.deleteProduct(product.id);
                this.logger.log(`Produto movido para rascunho SKU ${sku}`);
            }).catch((err) => this.logger.error(`Erro ao deletar/draft SKU ${sku}`, err));
        });
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