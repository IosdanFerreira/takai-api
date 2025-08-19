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
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const sync_service_1 = require("./sync.service");
let SyncController = class SyncController {
    constructor(syncService, logger) {
        this.syncService = syncService;
        this.logger = logger;
    }
    async handleOrderCreated(req, res, topic, signature) {
        try {
            await this.syncService.processNewOrder(req.body, signature);
            res.status(200).send({ received: true });
        }
        catch (error) {
            console.error('Erro ao processar webhook', error);
            res.status(500).send({ error: 'Erro interno' });
        }
    }
    async getAllProductsFromApis() {
        this.logger.log('Iniciando busca de produtos, estoque e preços...');
        return await this.syncService.syncProducts();
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('woocommerce/webhook/created-order'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('x-wc-webhook-topic')),
    __param(3, (0, common_1.Headers)('x-wc-webhook-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "handleOrderCreated", null);
__decorate([
    (0, common_1.Get)('all-products-from-apis'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getAllProductsFromApis", null);
exports.SyncController = SyncController = __decorate([
    (0, common_1.Controller)('sync'),
    __metadata("design:paramtypes", [sync_service_1.SyncService,
        common_1.Logger])
], SyncController);
//# sourceMappingURL=sync.controller.js.map