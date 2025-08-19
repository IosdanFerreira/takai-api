import { Logger } from '@nestjs/common';
import { SyncService } from './sync.service';
import { Request, Response } from 'express';
export declare class SyncController {
    private readonly syncService;
    private readonly logger;
    constructor(syncService: SyncService, logger: Logger);
    handleOrderCreated(req: Request, res: Response, topic: string, signature: string): Promise<void>;
    getAllProductsFromApis(): Promise<void>;
}
