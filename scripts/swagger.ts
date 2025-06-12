// scripts/swagger.ts

import { NestFactory } from '@nestjs/core';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs-extra';
import { AppModule } from 'src/app.module';

/**
 * Script para gerar o arquivo openapi.json automaticamente
 * sem precisar copiar manualmente o /docs-json.
 *
 * Uso:
 *   npx ts-node scripts/swagger.ts
 * ou
 *   npm run generate:swagger
 *
 * Ele cria uma instância completa de Nest (INestApplication),
 * gera o documento OpenAPI e salva em 'openapi.json', depois fecha
 * a aplicação para encerrar o processo.
 */

async function generateSwaggerJson() {
  // 1) Cria a aplicação Nest completa (INestApplication).
  //    Desabilitamos logging para não poluir a saída.
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // 2) Opcional: se você tiver olhos em CORS ou prefixos, configure aqui.
  //    Exemplo: app.enableCors();
  //    No entanto, não é estritamente necessário para gerar o JSON.

  // 3) Monta a configuração do Swagger, igual ao que está no main.ts
  const config = new DocumentBuilder()
    .setTitle('Jira Monitor API')
    .setDescription('API para monitorar filas do Jira via autenticacao basica')
    .setVersion('1.0.0')
    .build();

  // 4) Gera o documento OpenAPI (leitura de decorators, DTOs, controllers etc.)
  const document = SwaggerModule.createDocument(app, config);

  // 5) Define o caminho em disco e salva o JSON (com espaçamento para legibilidade)
  const outputPath = 'openapi.json';
  await fs.writeJson(outputPath, document, { spaces: 2 });
  console.log(`🚀 OpenAPI JSON gerado em: ${outputPath}`);

  // 6) Fecha a aplicação para encerrar o processo deste script
  await app.close();
}

generateSwaggerJson().catch((err) => {
  console.error('❌ Erro ao gerar OpenAPI JSON:', err);
  process.exit(1);
});
