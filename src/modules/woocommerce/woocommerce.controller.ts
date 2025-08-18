import { Controller, Get, Query } from '@nestjs/common';
import { WoocommerceService } from './woocommerce.service';
import { OrderDirection } from 'src/shared/interfaces/order-direction.interface';
import { OrderStatus } from 'src/shared/enum/order-status.enum';

@Controller('woocommerce')
export class WoocommerceController {
  constructor(private readonly wooService: WoocommerceService) {}

  /**
   * GET /woocommerce/products
   * Lista produtos do WooCommerce com paginação
   */
  @Get('produtos')
  async getProducts(
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 20,
    @Query('search') search: string,
    @Query('orderby') orderby: string,
    @Query('order') order: OrderDirection,
  ) {
    return await this.wooService.getProducts(
      page,
      perPage,
      search,
      orderby,
      order,
    );
  }

  @Get('estoque')
  async getProductsStock(
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 20,
    @Query('orderby') orderby: string,
    @Query('order') order: OrderDirection,
  ) {
    return await this.wooService.getProductsStock(
      page,
      perPage,
      orderby,
      order,
    );
  }

  @Get('pedidos')
  async getOrders(
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 20,
    @Query('status') status: OrderStatus,
  ) {
    return await this.wooService.getOrders(page, perPage, status);
  }

  @Get('clientes')
  async getCustomers(
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 20,
  ) {
    return await this.wooService.getAllCustomersFromOrders(page, perPage);
  }

  @Get('total-produtos')
  async getAllProducts(): Promise<{
    totalRecords: number;
    durationMs: number;
  }> {
    const start = Date.now();

    const products = await this.wooService.getAllProductsConcurrent();

    const durationMs = Date.now() - start;

    console.log(`Produtos WooCommerce: ${products.length}`);
    console.log(`Tempo total: ${durationMs}ms`);

    return {
      totalRecords: products.length,
      durationMs,
    };
  }
}
