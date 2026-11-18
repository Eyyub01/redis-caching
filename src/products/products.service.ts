import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface Product {
  id: number;
  name: string;
  views: number;
}

export interface ProductStats {
  id: number;
  name: string;
  totalSold: number;
  bestseller: boolean;
}

const products: Product[] = [
  { id: 1, name: 'Wireless Mouse', views: 0 },
  { id: 2, name: 'Mechanical Keyboard', views: 0 },
  { id: 3, name: 'USB-C Hub', views: 0 },
  { id: 4, name: 'Laptop Stand', views: 0 },
  { id: 5, name: 'Noise Cancelling Headphones', views: 0 },
  { id: 6, name: 'Webcam HD', views: 0 },
  { id: 7, name: 'Desk Lamp', views: 0 },
  { id: 8, name: 'Monitor 27 inch', views: 0 },
  { id: 9, name: 'External SSD 1TB', views: 0 },
  { id: 10, name: 'Phone Charger', views: 0 },
  { id: 11, name: 'Bluetooth Speaker', views: 0 },
  { id: 12, name: 'Gaming Chair', views: 0 },
  { id: 13, name: 'Mouse Pad XL', views: 0 },
  { id: 14, name: 'HDMI Cable', views: 0 },
  { id: 15, name: 'Smart Watch', views: 0 },
  { id: 16, name: 'Fitness Tracker', views: 0 },
  { id: 17, name: 'Portable Power Bank', views: 0 },
  { id: 18, name: 'Wireless Earbuds', views: 0 },
  { id: 19, name: 'Graphics Tablet', views: 0 },
  { id: 20, name: 'Microphone', views: 0 },
];

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@Inject('PG') private readonly pool: Pool) {}

  async computeStats(): Promise<ProductStats[]> {
    this.logger.log('Computing stats from database');

    const { rows } = await this.pool.query<{
      product_id: number;
      total_sold: string;
    }>(
      `SELECT product_id, SUM(quantity) AS total_sold
       FROM orders
       GROUP BY product_id
       ORDER BY total_sold DESC`,
    );

    const soldByProduct = new Map<number, number>();
    for (const row of rows) {
      soldByProduct.set(row.product_id, Number(row.total_sold));
    }

    const stats: ProductStats[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      totalSold: soldByProduct.get(product.id) ?? 0,
      bestseller: false,
    }));

    const top3 = [...stats].sort((a, b) => b.totalSold - a.totalSold).slice(0, 3);
    for (const item of top3) {
      item.bestseller = true;
    }

    return stats;
  }

  async findAll(): Promise<ProductStats[]> {
    // Class step: check Redis first
    return this.computeStats();
  }

  async placeOrder(productId: number, quantity: number) {
    const { rows } = await this.pool.query(
      `INSERT INTO orders (product_id, quantity) VALUES ($1, $2)
       RETURNING product_id, quantity`,
      [productId, quantity],
    );
    // Class step: invalidate Redis cache here
    return rows[0];
  }

  addView(productId: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    product.views++;
    return { id: product.id, views: product.views };
  }

  topProducts(limit: number) {
    return [...products]
      .sort((a, b) => b.views - a.views)
      .slice(0, limit)
      .map((p) => ({ id: p.id, name: p.name, views: p.views }));
  }
}