// src/main.ts

/**
 * Pontos principais deste arquivo:
 * 1) Carregar as variáveis de ambiente do arquivo .env (via dotenv)
 * 2) Inicializar a aplicação NestJS
 * 3) Habilitar express-session para gerenciar state e tokens em sessão
 * 4) Colocar a aplicação para ouvir na porta definida em process.env.PORT
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 1️⃣ Carrega as variáveis do .env no process.env
import * as dotenv from 'dotenv';
dotenv.config(); // isso vai ler “.env” na raiz e popular process.env

import * as session from 'express-session';

async function bootstrap() {
  // 2️⃣ Cria a aplicação NestJS usando o módulo raiz (AppModule)
  const app = await NestFactory.create(AppModule);

  // 3️⃣ Habilita o middleware de sessão do Express
  //    - CONTEXT: Qualquer controller que usar @Session() poderá ler/escrever dados
  app.use(
    session({
      // Usa SESSION_SECRET do .env (ou um valor padrão se não definir)
      secret: process.env.SESSION_SECRET || 'default_secret_key',
      resave: false, // evita salvar a sessão se não houver alterações
      saveUninitialized: false, // não cria sessão sem dados
      cookie: { secure: false }, // se for HTTPS, coloque secure: true
    }),
  );

  // 4️⃣ Define a porta de escuta (process.env.PORT ou 3000)
  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
