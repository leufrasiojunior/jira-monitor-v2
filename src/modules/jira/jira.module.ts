// src/modules/jira/jira.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { JiraCredentialEntity } from '../../domain/entities/jira-credential.entity';
import { JiraCredentialRepository } from '../../infra/repositories/jira/jira-credential.repository';

import { AuthService } from '../../application/services/auth/auth.service';
import { JiraQueueMonitorService } from '../../application/services/queue-monitor/jira-queue-monitor.service';

import { JiraMonitorController } from 'src/adapters/controllers/jira/jira-monitor.controller';
import { ProcessIssuesUseCase } from 'src/application/usecases/jira/process-issues.usecase';

@Module({
  imports: [
    // 1) Garante que HttpService seja disponibilizado
    HttpModule,

    // 2) Registra a entidade para que o repository funcione
    TypeOrmModule.forFeature([JiraCredentialEntity]),

    // 3) Habilita o ScheduleModule para que decoradores como @Interval funcionem
    ScheduleModule.forRoot(),
  ],
  controllers: [
    JiraMonitorController, // <-- adiciona o controller aqui
  ],
  providers: [
    // 4) Serviços e repositórios
    JiraCredentialRepository, // Repositório de credenciais
    AuthService, // Serviço de autenticação (refresh, handleCallback)
    JiraQueueMonitorService, // Nosso service agendado
    ProcessIssuesUseCase, // UseCase para tratar o JSON de issues
  ],
  exports: [
    // Se outros módulos precisarem usar esse service ou usecase, exporte-os:
    JiraQueueMonitorService,
    ProcessIssuesUseCase,
  ],
})
export class JiraModule {}
