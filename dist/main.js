"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = require("body-parser");
const app_module_1 = require("./app.module");
const core_1 = require("@nestjs/core");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: false,
    });
    app.use('/sync/woocommerce/webhook/created-order', (0, body_parser_1.raw)({ type: () => true }));
    app.use((0, body_parser_1.json)());
    console.log(`Aplicação rodando na porta ${process.env.APP_PORT}`);
    await app.listen(process.env.APP_PORT, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map