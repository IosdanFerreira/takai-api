import { Logger } from '@nestjs/common';
import { OmniaPriceInterface } from '../omnia/interfaces/omnia-price.interface';
import { OmniaProduct } from '../omnia/interfaces/omnia-product';
import { OmniaStockInterface } from '../omnia/interfaces/omnia-stock.interface';
import { OrderDirection } from 'src/shared/interfaces/order-direction.interface';
import { OrderStatus } from 'src/shared/enum/order-status.enum';
export declare class WoocommerceService {
    private readonly logger;
    private api;
    constructor(logger: Logger);
    createProducts(product: OmniaProduct, stock: OmniaStockInterface, price: OmniaPriceInterface): Promise<any>;
    updateProduct(wcProductId: number, product: OmniaProduct, stock: OmniaStockInterface, price: OmniaPriceInterface): Promise<any>;
    deleteProduct(productId: number | string): Promise<void>;
    getProducts(page?: number, perPage?: number, search?: string, orderby?: string, order?: OrderDirection): Promise<{
        pagination: {
            currentPage: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        data: any;
    }>;
    getProductsStock(page?: number, perPage?: number, orderby?: string, order?: OrderDirection): Promise<{
        pagination: {
            currentPage: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        data: any;
    }>;
    getOrders(page?: number, perPage?: number, status?: OrderStatus): Promise<{
        pagination: {
            currentPage: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        data: any;
    }>;
    getCustomers(page?: number, perPage?: number, search?: string, orderby?: string, order?: OrderDirection): Promise<{
        pagination: {
            currentPage: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        data: any;
    }>;
    getAllCustomersFromOrders(page?: number, perPage?: number): Promise<{
        pagination: {
            currentPage: number;
            pageSize: number;
            totalRecords: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
        data: any[];
    }>;
    getAllProductsConcurrent(): Promise<any[]>;
    getProductBySku(sku: string): Promise<any | null>;
}
