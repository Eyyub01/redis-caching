import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  findAll() {
    return this.productsService.findAll();
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
  addView(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.addView(id);
  }
}
