// src/main.ts

/**
 * Pontos principais deste arquivo:
 *  1) Inicializar a aplicação NestJS
 *  2) Habilitar express-session para gerenciar state e tokens em sessão
 *  3) Configurar Swagger UI em /docs
 *  4) Colocar a aplicação para ouvir na porta definida em configuração
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

import * as session from 'express-session';

// 2️⃣ Imports para Swagger
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ▶️ Importação de Logger
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 1) Loga as variáveis de configuração essenciais
  logger.log('Carregando variáveis de configuração...');
  logger.debug(`PORT = ${configService.get<string>('PORT')}`);
  logger.debug(
    `SESSION_SECRET = ${configService.get<string>('SESSION_SECRET') ? '***' : '(padrão usado)'}`,
  );
  logger.debug(
    `JIRA_CLIENT_ID = ${configService.get<string>('JIRA_CLIENT_ID') ? '***' : '(não definido)'}`,
  );
  logger.debug(
    `JIRA_REDIRECT_URI = ${configService.get<string>('JIRA_REDIRECT_URI') ? configService.get<string>('JIRA_REDIRECT_URI') : '(não definido)'}`,
  );
  logger.debug(
    `JIRA_BASE_URL = ${configService.get<string>('JIRA_BASE_URL') ? configService.get<string>('JIRA_BASE_URL') : '(não definido)'}`,
  );

  // 3️⃣ Habilita o middleware de sessão do Express
  logger.log('Configurando express-session...');
  app.use(
    session({
      secret: configService.get<string>('SESSION_SECRET') || 'default_secret_key',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  );

  // -----------------------
  // 2.3.2: Configuração do Swagger
  // -----------------------

  // 2.3.2.1) Define título, descrição e versão para o Swagger
  logger.log('Configurando Swagger...');
  const config = new DocumentBuilder()
    .setTitle('Jira Monitor API')
    .setDescription('API para monitorar filas do Jira via OAuth 2.0 (3LO)')
    .setVersion('1.0.0')
    // .addBearerAuth(...)  // Se você for usar autenticação via Bearer dentro do Swagger
    .build();

  // 2.3.2.2) Cria o documento OpenAPI, varrendo todos os controllers anotados
  const document = SwaggerModule.createDocument(app, config);

  // 2.3.2.3) Expõe a interface Swagger em /docs
  SwaggerModule.setup('docs', app, document);
  logger.log('Swagger disponível em /docs');

  // -----------------------

  // 4️⃣ Define a porta de escuta (PORT ou 3000)
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  logger.log(`Aplicação rodando em http://localhost:${port}`);
}

bootstrap();
