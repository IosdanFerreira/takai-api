export interface WooCreateProductDto {
    name: string;
    type?: 'simple' | 'variable' | 'grouped' | 'external';
    status?: 'draft' | 'pending' | 'private' | 'publish';
    description?: string;
    short_description?: string;
    sku?: string;
    regular_price?: string;
    sale_price?: string;
    stock_quantity?: number;
    manage_stock?: boolean;
    stock_status?: 'instock' | 'outofstock' | 'onbackorder';
    weight?: string;
    dimensions?: {
        length?: string;
        width?: string;
        height?: string;
    };
}
