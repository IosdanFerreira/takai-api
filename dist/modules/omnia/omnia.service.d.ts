import { ConfigService } from '@nestjs/config';
import { CreateOmniClientDto } from './interfaces/omnia-create-client.interface';
import { OmniClient } from './interfaces/omnia-client.interface';
import { OmniaPriceInterface } from './interfaces/omnia-price.interface';
import { OmniaProduct } from './interfaces/omnia-product';
import { OmniaStockInterface } from './interfaces/omnia-stock.interface';
export declare class OmniaService {
    private configService;
    private readonly logger;
    private api;
    constructor(configService: ConfigService);
    private formatAxiosError;
    getToken(): Promise<string>;
    getClientByCpfOrCnpj(cpfOrCnpj: string): Promise<OmniClient[]>;
    fetchAllPagesConcurrent<T>(endpoint: string, token: string, concurrency?: number, maxRetries?: number): Promise<T[]>;
    getProducts(): Promise<OmniaProduct[]>;
    getStock(): Promise<OmniaStockInterface[]>;
    getPrices(): Promise<OmniaPriceInterface[]>;
    createClient(client: CreateOmniClientDto): Promise<any>;
    createOrder(order: any): Promise<any>;
}
