// src/app.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JiraModule } from '@modules/jira/jira.module'; // <-- importa o JiraModule
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [__dirname + '/domain/entities/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    AuthModule,
    JiraModule, // <-- garante que o módulo de monitoramento seja carregado
  ],
})
export class AppModule {}
