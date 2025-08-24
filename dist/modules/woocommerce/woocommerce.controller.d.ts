import { WoocommerceService } from './woocommerce.service';
import { OrderDirection } from 'src/shared/interfaces/order-direction.interface';
import { OrderStatus } from 'src/shared/enum/order-status.enum';
export declare class WoocommerceController {
    private readonly wooService;
    constructor(wooService: WoocommerceService);
    getProducts(page: number, perPage: number, search: string, orderby: string, order: OrderDirection): Promise<{
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
    getProductBySku(sku: string): Promise<any>;
    getProductsStock(page: number, perPage: number, orderby: string, order: OrderDirection): Promise<{
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
    getOrders(page: number, perPage: number, status: OrderStatus): Promise<{
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
    getCustomers(page?: number, perPage?: number): Promise<{
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
    getAllProducts(): Promise<{
        totalRecords: any;
        data: any[];
    }>;
    deleteProductBySku(sku: string): Promise<void>;
}
