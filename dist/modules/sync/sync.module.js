"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncModule = void 0;
const common_1 = require("@nestjs/common");
const omnia_service_1 = require("../omnia/omnia.service");
const sync_controller_1 = require("./sync.controller");
const sync_service_1 = require("./sync.service");
const woocommerce_service_1 = require("../woocommerce/woocommerce.service");
let SyncModule = class SyncModule {
};
exports.SyncModule = SyncModule;
exports.SyncModule = SyncModule = __decorate([
    (0, common_1.Module)({
        controllers: [sync_controller_1.SyncController],
        providers: [sync_service_1.SyncService, woocommerce_service_1.WoocommerceService, omnia_service_1.OmniaService, common_1.Logger],
    })
], SyncModule);
//# sourceMappingURL=sync.module.js.map