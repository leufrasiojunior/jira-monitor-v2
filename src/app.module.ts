// src/app.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from './modules/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JiraCredentialEntity } from './domain/entities/jira-credential.entity';
// Se desejar, mais tarde você adicionará:
// import { JiraIssuesModule } from './modules/jira-issues/jira-issues.module';

@Module({
  imports: [
    HttpModule, // disponibiliza HttpService globalmente (pode ser também importado nos módulos específicos)
    AuthModule, // registra JiraAuthController e OauthCallbackController
    TypeOrmModule.forRoot({
      type: 'sqlite', // 1. Escolhe o SQLite como banco
      database: 'database.sqlite', // 2. Nome do arquivo onde ficarão os dados
      entities: [JiraCredentialEntity], // 3. Lista de entidades que o TypeORM deve mapear (criaremos em breve)
      synchronize: true, // 4. Durante desenvolvimento, cria/atualiza tabelas automaticamente
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
