import { OmniaService } from './omnia.service';
export declare class OmniaController {
    private readonly omniaService;
    constructor(omniaService: OmniaService);
    getAllData(): Promise<{
        productsCount: number;
        stockCount: number;
        pricesCount: number;
        durationMs: number;
    }>;
}
