import { Injectable, Logger } from '@nestjs/common';

import { OmniaPriceInterface } from '../omnia/interfaces/omnia-price.interface';
import { OmniaProduct } from '../omnia/interfaces/omnia-product';
import { OmniaStockInterface } from '../omnia/interfaces/omnia-stock.interface';
import { OrderDirection } from 'src/shared/interfaces/order-direction.interface';
import { OrderStatus } from 'src/shared/enum/order-status.enum';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { WooCreateProductDto } from './dto/woo-create-product.dto';

@Injectable()
export class WoocommerceService {
  private api: WooCommerceRestApi;

  constructor(private readonly logger: Logger) {
    this.api = new WooCommerceRestApi({
      url: process.env.WC_URL,
      consumerKey: process.env.WC_CONSUMER_KEY,
      consumerSecret: process.env.WC_CONSUMER_SECRET,
      version: 'wc/v3',
    });
  }

  async createProducts(
    product: OmniaProduct,
    stock: OmniaStockInterface,
    price: OmniaPriceInterface,
  ) {
    const weightKg = Number(product.pesoliq_gr ?? 0) / 1000;

    const dimensions: Record<string, string> = {};
    if (Number(product.comprimento_cm) > 0)
      dimensions.length = String(Number(product.comprimento_cm));
    if (Number(product.largura_cm) > 0)
      dimensions.width = String(Number(product.largura_cm));
    if (Number(product.altura_cm) > 0)
      dimensions.height = String(Number(product.altura_cm));

    const finalDimensions = Object.keys(dimensions).length
      ? dimensions
      : undefined;

    const productToCreate: any = {
      name: product.nomeecommerce || product.descricao,
      description: product.descricaolonga || '',
      short_description: product.descricaocurta || '',
      sku: String(product.codprod),
      regular_price: String(Number(price.pvenda).toFixed(2)),
      manage_stock: true,
      stock_quantity: Math.floor(Number(stock.estoque ?? 0)),
      stock_status: Number(stock.estoque) > 0 ? 'instock' : 'outofstock',
      weight: String(weightKg),
      dimensions: finalDimensions,
      type: 'simple',
      status: 'publish',
    };

    try {
      return await this.api.post('products', productToCreate);
    } catch (err: any) {
      if (err.response) {
        // Mostra de forma legível
        this.logger.error(
          `❌ Erro criar SKU ${product.codprod}: ${JSON.stringify(err.response.data)}`,
        );
      } else {
        this.logger.error(
          `❌ Erro criar SKU ${product.codprod}: ${err.message}`,
        );
      }
      throw err;
    }
  }

  async updateProduct(
    wcProductId: number,
    product: OmniaProduct,
    stock: OmniaStockInterface,
    price: OmniaPriceInterface,
  ) {
    const productToUpdate: Partial<WooCreateProductDto> = {
      name: product.nomeecommerce || product.descricao,
      description: product.descricaolonga || '',
      short_description: product.descricaocurta || '',
      regular_price: String(Number(price.pvenda).toFixed(2)),
      stock_quantity: Math.floor(Number(stock.estoque ?? 0)),
      stock_status: Number(stock.estoque) > 0 ? 'instock' : 'outofstock',
      type: 'simple',
      status: 'publish',
    };

    try {
      return await this.api.put(`products/${wcProductId}`, productToUpdate);
    } catch (error) {
      this.logger.error(
        `Erro atualizar SKU ${product.codprod} (wcId: ${wcProductId})`,
        error instanceof Error ? error.stack : String(error),
        JSON.stringify({
          productData: productToUpdate,
          rawError: error.response?.data || error.message,
        }),
      );
      throw error;
    }
  }

  async deleteProduct(productId: number | string) {
    try {
      await this.api.delete(`products/${productId}`);
      this.logger.log(`Produto marcado como draft: ID ${productId}`);
    } catch (err) {
      this.logger.error(
        `Erro ao marcar produto como draft: ID ${productId}`,
        err,
      );
    }
  }

  async getProducts(
    page = 1,
    perPage = 10,
    search?: string,
    orderby: string = 'date',
    order: OrderDirection = 'desc',
  ) {
    const response = await this.api.get('products', {
      page,
      per_page: perPage,
      search: search,
      orderby,
      order,
    });

    const totalRecords = Number(response.headers['x-wp-total']);
    const totalPages = Number(response.headers['x-wp-totalpages']);
    const currentPage = Number(page);

    return {
      pagination: {
        currentPage,
        pageSize: Number(perPage),
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      data: response.data,
    };
  }

  async getProductsStock(
    page = 1,
    perPage = 10,
    orderby: string = 'date',
    order: OrderDirection = 'desc',
  ) {
    const response = await this.api.get('products', {
      page,
      per_page: perPage,
      orderby,
      order,
    });

    const totalRecords = Number(response.headers['x-wp-total']);
    const totalPages = Number(response.headers['x-wp-totalpages']);
    const currentPage = Number(page);

    const stock = response.data.map((product: any) => ({
      id: product.id,
      name: product.name,
      stock_quantity: product.stock_quantity ?? 0,
      stock_status: product.stock_status,
    }));

    return {
      pagination: {
        currentPage,
        pageSize: Number(perPage),
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      data: stock,
    };
  }

  async getOrders(page = 1, perPage = 10, status?: OrderStatus) {
    const response = await this.api.get('orders', {
      page,
      per_page: perPage,
      status,
    });

    const totalRecords = Number(response.headers['x-wp-total']);
    const totalPages = Number(response.headers['x-wp-totalpages']);
    const currentPage = Number(page);

    return {
      pagination: {
        currentPage,
        pageSize: Number(perPage),
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      data: response.data,
    };
  }

  async getCustomers(
    page = 1,
    perPage = 10,
    search?: string,
    orderby: string = 'registered_date',
    order: OrderDirection = 'desc',
  ) {
    const response = await this.api.get('customers', {
      page,
      per_page: perPage,
      search: search,
      orderby,
      order,
    });

    const totalRecords = Number(response.headers['x-wp-total']);
    const totalPages = Number(response.headers['x-wp-totalpages']);
    const currentPage = Number(page);

    return {
      pagination: {
        currentPage,
        pageSize: Number(perPage),
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      data: response.data,
    };
  }

  async getAllCustomersFromOrders(page = 1, perPage = 20) {
    const customersMap = new Map<string, any>();

    let currentPage = 1;

    while (true) {
      const response = await this.api.get('orders', {
        page: currentPage,
        per_page: 100, // buscar em lotes grandes para reduzir requests
        orderby: 'date',
        order: 'desc',
      });

      const orders = response.data;
      if (!orders.length) break;

      for (const order of orders) {
        const { billing, customer_id, date_created } = order;

        // Considera apenas clientes cadastrados
        if (!billing || !billing.email || !customer_id || customer_id <= 0)
          continue;

        if (!customersMap.has(billing.email)) {
          customersMap.set(billing.email, {
            first_name: billing.first_name,
            last_name: billing.last_name,
            email: billing.email,
            phone: billing.phone,
            city: billing.city,
            country: billing.country,
            total_orders: 1,
            total_spent: parseFloat(order.total),
            registered_date: date_created,
          });
        } else {
          const existing = customersMap.get(billing.email);
          existing.total_orders += 1;
          existing.total_spent += parseFloat(order.total);
        }
      }

      // Para se já temos clientes suficientes para a página solicitada
      if (customersMap.size >= page * perPage) break;

      // Passa para a próxima página do WooCommerce
      currentPage += 1;
      const totalPages = Number(response.headers['x-wp-totalpages']);
      if (currentPage > totalPages) break;
    }

    const allCustomers = Array.from(customersMap.values());

    // Paginação
    const totalRecords = allCustomers.length;
    const totalPages = Math.ceil(totalRecords / perPage);
    const paginatedData = allCustomers.slice(
      (page - 1) * perPage,
      page * perPage,
    );

    return {
      pagination: {
        currentPage: page,
        pageSize: perPage,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: paginatedData,
    };
  }

  async getAllProductsConcurrent(): Promise<any[]> {
    const concurrency = Number(process.env.WOO_CONCURRENCY ?? 5); // padrão = 5
    const perPage = 100;
    const results: any[] = [];

    // Função auxiliar com retry + backoff
    const fetchWithRetry = async (
      page: number,
      retries = 3,
      delay = 1000,
    ): Promise<any> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await this.getProducts(page, perPage);
        } catch (err) {
          this.logger.warn(
            `Erro ao buscar página ${page}, tentativa ${attempt}/${retries}`,
          );
          if (attempt === retries) throw err;
          await new Promise((res) => setTimeout(res, delay * attempt)); // backoff exponencial
        }
      }
    };

    // Primeira página para descobrir totalPages
    const firstPage = await fetchWithRetry(1);
    results.push(...firstPage.data);

    const totalPages = firstPage.pagination.totalPages;
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    this.logger.log(
      `Total de páginas: ${totalPages} (perPage=${perPage}, concorrência=${concurrency})`,
    );

    // Processa páginas restantes em lotes concorrentes
    for (let i = 0; i < pages.length; i += concurrency) {
      const batch = pages.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((page) => fetchWithRetry(page).then((res) => res.data)),
      );

      batchResults.forEach((pageData) => results.push(...pageData));
      this.logger.log(
        `Batch ${i / concurrency + 1} concluído (${results.length}/${perPage * totalPages} produtos carregados até agora)`,
      );
    }

    this.logger.log(`Todos os produtos carregados: ${results.length}`);
    return results;
  }
}
