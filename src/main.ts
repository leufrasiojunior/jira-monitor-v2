// src/main.ts

/**
 * Pontos principais deste arquivo:
 *  1) Carregar as variáveis de ambiente do arquivo .env (via dotenv)
 *  2) Inicializar a aplicação NestJS
 *  3) Habilitar express-session para gerenciar state e tokens em sessão
 *  4) Configurar Swagger UI em /docs
 *  5) Colocar a aplicação para ouvir na porta definida em process.env.PORT
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 1️⃣ Carrega as variáveis do .env no process.env
import * as dotenv from 'dotenv';
dotenv.config();

import * as session from 'express-session';

// 2️⃣ Imports para Swagger
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ▶️ Importação de Logger
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 1) Loga as variáveis de ambiente essenciais
  logger.log('Carregando variáveis de ambiente...');
  logger.debug(`PORT = ${process.env.PORT}`);
  logger.debug(
    `SESSION_SECRET = ${process.env.SESSION_SECRET ? '***' : '(padrão usado)'}`,
  );
  logger.debug(
    `JIRA_CLIENT_ID = ${process.env.JIRA_CLIENT_ID ? '***' : '(não definido)'}`,
  );
  logger.debug(
    `JIRA_REDIRECT_URI = ${process.env.JIRA_REDIRECT_URI ? process.env.JIRA_REDIRECT_URI : '(não definido)'}`,
  );
  logger.debug(
    `JIRA_BASE_URL = ${process.env.JIRA_BASE_URL ? process.env.JIRA_BASE_URL : '(não definido)'}`,
  );

  // 2️⃣ Cria a aplicação NestJS usando o módulo raiz (AppModule)
  logger.log('Inicializando aplicação NestJS...');
  const app = await NestFactory.create(AppModule);

  // 3️⃣ Habilita o middleware de sessão do Express
  logger.log('Configurando express-session...');
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'default_secret_key',
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

  // 4️⃣ Define a porta de escuta (process.env.PORT ou 3000)
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Aplicação rodando em http://localhost:${port}`);
}

bootstrap();
