import { Logger } from '@nestjs/common';
import { OmniaService } from '../omnia/omnia.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
export declare class SyncService {
    private readonly omniaService;
    private readonly woocommerceService;
    private logger;
    constructor(omniaService: OmniaService, woocommerceService: WoocommerceService, logger: Logger);
    processNewOrder(rawBody: Buffer, signature: string): Promise<void>;
    syncProducts(): Promise<void>;
    handleCron(): Promise<void>;
    private createProductsBatch;
    private updateProductsBatch;
    private deleteProductsBatch;
    private formatClient;
    private formatOrder;
}
