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
exports.OmniaController = void 0;
const common_1 = require("@nestjs/common");
const omnia_service_1 = require("./omnia.service");
let OmniaController = class OmniaController {
    constructor(omniaService) {
        this.omniaService = omniaService;
    }
    async getAllData() {
        const start = Date.now();
        const [products, stock, prices] = await Promise.all([
            this.omniaService.getProducts(),
            this.omniaService.getStock(),
            this.omniaService.getPrices(),
        ]);
        const durationMs = Date.now() - start;
        console.log(`Produtos: ${products.length}`);
        console.log(`Estoques: ${stock.length}`);
        console.log(`Preços: ${prices.length}`);
        console.log(`Tempo total: ${durationMs}ms`);
        return {
            productsCount: products.length,
            stockCount: stock.length,
            pricesCount: prices.length,
            durationMs,
        };
    }
};
exports.OmniaController = OmniaController;
__decorate([
    (0, common_1.Get)('all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OmniaController.prototype, "getAllData", null);
exports.OmniaController = OmniaController = __decorate([
    (0, common_1.Controller)('omnia'),
    __metadata("design:paramtypes", [omnia_service_1.OmniaService])
], OmniaController);
//# sourceMappingURL=omnia.controller.js.map