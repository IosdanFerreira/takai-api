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
exports.WoocommerceService = void 0;
const common_1 = require("@nestjs/common");
const woocommerce_rest_api_1 = require("@woocommerce/woocommerce-rest-api");
let WoocommerceService = class WoocommerceService {
    constructor(logger) {
        this.logger = logger;
        this.api = new woocommerce_rest_api_1.default({
            url: process.env.WC_URL,
            consumerKey: process.env.WC_CONSUMER_KEY,
            consumerSecret: process.env.WC_CONSUMER_SECRET,
            version: 'wc/v3',
        });
    }
    async createProducts(product, stock, price) {
        const weightKg = Number(product.pesoliq_gr ?? 0) / 1000;
        const dimensions = {};
        if (Number(product.comprimento_cm) > 0)
            dimensions.length = String(Number(product.comprimento_cm));
        if (Number(product.largura_cm) > 0)
            dimensions.width = String(Number(product.largura_cm));
        if (Number(product.altura_cm) > 0)
            dimensions.height = String(Number(product.altura_cm));
        const finalDimensions = Object.keys(dimensions).length
            ? dimensions
            : undefined;
        const productToCreate = {
            name: product.nomeecommerce || product.descricao,
            description: product.descricaolonga || '',
            short_description: product.descricaocurta || '',
            sku: String(product.codprod),
            regular_price: String(Number(price.pvenda).toFixed(2)),
            manage_stock: true,
            stock_quantity: Math.floor(Number(stock.estoque ?? 0)),
            stock_status: Number(stock.estoque) > 0 ? 'instock' : 'outofstock',
            weight: String(weightKg),
            dimensions: finalDimensions,
            type: 'simple',
            status: 'publish',
        };
        try {
            return await this.api.post('products', productToCreate);
        }
        catch (err) {
            if (err.response) {
                this.logger.error(`Erro criar SKU ${product.codprod}: ${JSON.stringify(err.response.data)}`);
            }
            else {
                this.logger.error(`Erro criar SKU ${product.codprod}: ${err.message}`);
            }
            throw err;
        }
    }
    async updateProduct(wcProductId, product, stock, price) {
        const productToUpdate = {
            name: product.nomeecommerce || product.descricao,
            description: product.descricaolonga || '',
            short_description: product.descricaocurta || '',
            regular_price: String(Number(price.pvenda).toFixed(2)),
            manage_stock: true,
            stock_quantity: Math.floor(Number(stock.estoque ?? 0)),
            stock_status: Number(stock.estoque) > 0 ? 'instock' : 'outofstock',
            type: 'simple',
            status: 'publish',
        };
        try {
            return await this.api.put(`products/${wcProductId}`, productToUpdate);
        }
        catch (error) {
            this.logger.error(`Erro atualizar SKU ${product.codprod} (wcId: ${wcProductId})`, error instanceof Error ? error.stack : String(error), JSON.stringify({
                productData: productToUpdate,
                rawError: error.response?.data || error.message,
            }));
            throw error;
        }
    }
    async deleteProduct(productId) {
        try {
            await this.api.delete(`products/${productId}`);
            this.logger.log(`Produto marcado como draft: ID ${productId}`);
        }
        catch (err) {
            this.logger.error(`Erro ao marcar produto como draft: ID ${productId}`, err);
        }
    }
    async getProducts(page = 1, perPage = 10, search, orderby = 'date', order = 'desc') {
        const response = await this.api.get('products', {
            page,
            per_page: perPage,
            search: search,
            orderby,
            order,
        });
        const totalRecords = Number(response.headers['x-wp-total']);
        const totalPages = Number(response.headers['x-wp-totalpages']);
        const currentPage = Number(page);
        return {
            pagination: {
                currentPage,
                pageSize: Number(perPage),
                totalRecords,
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
            data: response.data,
        };
    }
    async getProductsStock(page = 1, perPage = 10, orderby = 'date', order = 'desc') {
        const response = await this.api.get('products', {
            page,
            per_page: perPage,
            orderby,
            order,
        });
        const totalRecords = Number(response.headers['x-wp-total']);
        const totalPages = Number(response.headers['x-wp-totalpages']);
        const currentPage = Number(page);
        const stock = response.data.map((product) => ({
            id: product.id,
            name: product.name,
            stock_quantity: product.stock_quantity ?? 0,
            stock_status: product.stock_status,
        }));
        return {
            pagination: {
                currentPage,
                pageSize: Number(perPage),
                totalRecords,
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
            data: stock,
        };
    }
    async getOrders(page = 1, perPage = 10, status) {
        const response = await this.api.get('orders', {
            page,
            per_page: perPage,
            status,
        });
        const totalRecords = Number(response.headers['x-wp-total']);
        const totalPages = Number(response.headers['x-wp-totalpages']);
        const currentPage = Number(page);
        return {
            pagination: {
                currentPage,
                pageSize: Number(perPage),
                totalRecords,
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
            data: response.data,
        };
    }
    async getCustomers(page = 1, perPage = 10, search, orderby = 'registered_date', order = 'desc') {
        const response = await this.api.get('customers', {
            page,
            per_page: perPage,
            search: search,
            orderby,
            order,
        });
        const totalRecords = Number(response.headers['x-wp-total']);
        const totalPages = Number(response.headers['x-wp-totalpages']);
        const currentPage = Number(page);
        return {
            pagination: {
                currentPage,
                pageSize: Number(perPage),
                totalRecords,
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
            data: response.data,
        };
    }
    async getAllCustomersFromOrders(page = 1, perPage = 20) {
        const customersMap = new Map();
        let currentPage = 1;
        while (true) {
            const response = await this.api.get('orders', {
                page: currentPage,
                per_page: 100,
                orderby: 'date',
                order: 'desc',
            });
            const orders = response.data;
            if (!orders.length)
                break;
            for (const order of orders) {
                const { billing, customer_id, date_created } = order;
                if (!billing || !billing.email || !customer_id || customer_id <= 0)
                    continue;
                if (!customersMap.has(billing.email)) {
                    customersMap.set(billing.email, {
                        first_name: billing.first_name,
                        last_name: billing.last_name,
                        email: billing.email,
                        phone: billing.phone,
                        city: billing.city,
                        country: billing.country,
                        total_orders: 1,
                        total_spent: parseFloat(order.total),
                        registered_date: date_created,
                    });
                }
                else {
                    const existing = customersMap.get(billing.email);
                    existing.total_orders += 1;
                    existing.total_spent += parseFloat(order.total);
                }
            }
            if (customersMap.size >= page * perPage)
                break;
            currentPage += 1;
            const totalPages = Number(response.headers['x-wp-totalpages']);
            if (currentPage > totalPages)
                break;
        }
        const allCustomers = Array.from(customersMap.values());
        const totalRecords = allCustomers.length;
        const totalPages = Math.ceil(totalRecords / perPage);
        const paginatedData = allCustomers.slice((page - 1) * perPage, page * perPage);
        return {
            pagination: {
                currentPage: page,
                pageSize: perPage,
                totalRecords,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
            data: paginatedData,
        };
    }
    async getAllProductsConcurrent() {
        const concurrency = Number(process.env.WOO_CONCURRENCY ?? 5);
        const perPage = 100;
        const results = [];
        const fetchWithRetry = async (page, retries = 3, delay = 1000) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return await this.getProducts(page, perPage);
                }
                catch (err) {
                    this.logger.warn(`Erro ao buscar página ${page}, tentativa ${attempt}/${retries}`);
                    if (attempt === retries)
                        throw err;
                    await new Promise((res) => setTimeout(res, delay * attempt));
                }
            }
        };
        const firstPage = await fetchWithRetry(1);
        results.push(...firstPage.data);
        const totalPages = firstPage.pagination.totalPages;
        const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        this.logger.log(`Total de páginas: ${totalPages} (perPage=${perPage}, concorrência=${concurrency})`);
        for (let i = 0; i < pages.length; i += concurrency) {
            const batch = pages.slice(i, i + concurrency);
            const batchResults = await Promise.all(batch.map((page) => fetchWithRetry(page).then((res) => res.data)));
            batchResults.forEach((pageData) => results.push(...pageData));
            this.logger.log(`Batch ${i / concurrency + 1} concluído (${results.length}/${perPage * totalPages} produtos carregados até agora)`);
        }
        this.logger.log(`Todos os produtos carregados: ${results.length}`);
        return results;
    }
    async getProductBySku(sku) {
        if (!sku)
            return null;
        try {
            const response = await this.api.get('products', { sku });
            const products = response.data;
            if (Array.isArray(products) && products.length > 0) {
                return products[0];
            }
            return null;
        }
        catch (err) {
            this.logger.error(`Erro ao buscar produto por SKU ${sku}`, err);
            return null;
        }
    }
};
exports.WoocommerceService = WoocommerceService;
exports.WoocommerceService = WoocommerceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [common_1.Logger])
], WoocommerceService);
//# sourceMappingURL=woocommerce.service.js.map