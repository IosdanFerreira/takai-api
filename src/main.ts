import { json, raw } from 'body-parser';

import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.use('/sync/woocommerce/webhook/created-order', raw({ type: () => true }));

  app.use(json());

  await app.listen(3000);
}
bootstrap();
