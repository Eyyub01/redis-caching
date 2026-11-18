import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
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

const STATS_KEY = 'products:stats';
const TOP_KEY = 'products:top';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject('PG') private readonly pool: Pool,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

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

  async findAll(): Promise<{ data: ProductStats[]; hit: boolean }> {
    // GET: read cached stats; null if the key is missing or expired.
    const cached = await this.redis.get(STATS_KEY);
    if (cached) {
      this.logger.log('CACHE HIT');
      return { data: JSON.parse(cached), hit: true };
    }

    this.logger.log('CACHE MISS');
    const stats = await this.computeStats();
    // SET ... EX 60: store stats and let Redis remove the key after 60 seconds.
    await this.redis.set(STATS_KEY, JSON.stringify(stats), 'EX', 60);
    return { data: stats, hit: false };
  }

  async placeOrder(productId: number, quantity: number) {
    const { rows } = await this.pool.query(
      `INSERT INTO orders (product_id, quantity) VALUES ($1, $2)
       RETURNING product_id, quantity`,
      [productId, quantity],
    );
    // DEL: a new order changes totals, so cached stats would be wrong.
    await this.redis.del(STATS_KEY);
    return rows[0];
  }

  async addView(productId: number, ip: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const rateKey = `ratelimit:${ip}`;
    // INCR: count this request; the key starts at 1 on the first hit.
    const count = await this.redis.incr(rateKey);
    if (count === 1) {
      // EXPIRE: start a 60 second window on the first request.
      await this.redis.expire(rateKey, 60);
    }
    if (count > 5) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // ZINCRBY: add 1 to this product's score on the views leaderboard.
    const views = await this.redis.zincrby(TOP_KEY, 1, productId);
    return { id: product.id, views: Number(views) };
  }

  async topProducts(limit: number) {
    // ZREVRANGE ... WITHSCORES: highest scores first, as [id, score, id, score, ...].
    const result = await this.redis.zrevrange(TOP_KEY, 0, limit - 1, 'WITHSCORES');

    const top: { id: number; name: string; views: number }[] = [];
    for (let i = 0; i < result.length; i += 2) {
      const product = products.find((p) => p.id === Number(result[i]));
      if (product) {
        top.push({ id: product.id, name: product.name, views: Number(result[i + 1]) });
      }
    }
    return top;
  }
}