import { Body, Controller, Get, Ip, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  async findAll(@Res({ passthrough: true }) res: Response) {
    const { data, hit } = await this.productsService.findAll();
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    return data;
  }

  // Declared before any /:id route so "top" is not treated as an id.
  @Get('products/top')
  topProducts() {
    return this.productsService.topProducts(10);
  }

  @Post('orders')
  placeOrder(@Body() body: { productId: number; quantity: number }) {
    return this.productsService.placeOrder(body.productId, body.quantity);
  }

  @Post('products/:id/view')
  addView(@Param('id', ParseIntPipe) id: number, @Ip() ip: string) {
    return this.productsService.addView(id, ip);
  }
}