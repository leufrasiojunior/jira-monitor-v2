// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { JiraModule } from '@modules/jira/jira.module'; // <-- importa o JiraModule

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JiraModule, // <-- garante que o módulo de monitoramento seja carregado
  ],
})
export class AppModule {}
