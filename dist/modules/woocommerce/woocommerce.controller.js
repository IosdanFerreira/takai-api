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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WoocommerceController = void 0;
const common_1 = require("@nestjs/common");
const woocommerce_service_1 = require("./woocommerce.service");
const order_status_enum_1 = require("../../shared/enum/order-status.enum");
let WoocommerceController = class WoocommerceController {
    constructor(wooService) {
        this.wooService = wooService;
    }
    async getProducts(page = 1, perPage = 20, search, orderby, order) {
        return await this.wooService.getProducts(page, perPage, search, orderby, order);
    }
    async getProductBySku(sku) {
        return await this.wooService.getProductBySku(sku);
    }
    async getProductsStock(page = 1, perPage = 20, orderby, order) {
        return await this.wooService.getProductsStock(page, perPage, orderby, order);
    }
    async getOrders(page = 1, perPage = 20, status) {
        return await this.wooService.getOrders(page, perPage, status);
    }
    async getCustomers(page = 1, perPage = 20) {
        return await this.wooService.getAllCustomersFromOrders(page, perPage);
    }
    async getAllProducts() {
        const products = await this.wooService.getAllProductsConcurrent();
        console.log(`Produtos WooCommerce: ${products.length}`);
        return {
            totalRecords: products.length,
            data: products,
        };
    }
    async deleteProductBySku(sku) {
        return await this.wooService.deleteProductPermanently(sku);
    }
};
exports.WoocommerceController = WoocommerceController;
__decorate([
    (0, common_1.Get)('produtos'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('perPage')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('orderby')),
    __param(4, (0, common_1.Query)('order')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String, String]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)('produto/:sku'),
    __param(0, (0, common_1.Param)('sku')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getProductBySku", null);
__decorate([
    (0, common_1.Get)('estoque'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('perPage')),
    __param(2, (0, common_1.Query)('orderby')),
    __param(3, (0, common_1.Query)('order')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getProductsStock", null);
__decorate([
    (0, common_1.Get)('pedidos'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('perPage')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)('clientes'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('perPage')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getCustomers", null);
__decorate([
    (0, common_1.Get)('total-produtos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "getAllProducts", null);
__decorate([
    (0, common_1.Delete)('produto/:sku'),
    __param(0, (0, common_1.Param)('sku')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WoocommerceController.prototype, "deleteProductBySku", null);
exports.WoocommerceController = WoocommerceController = __decorate([
    (0, common_1.Controller)('woocommerce'),
    __metadata("design:paramtypes", [woocommerce_service_1.WoocommerceService])
], WoocommerceController);
//# sourceMappingURL=woocommerce.controller.js.map