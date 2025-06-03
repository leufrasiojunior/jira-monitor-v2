// src/modules/jira/jira.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JiraMonitorController } from '@adapters/controllers/jira/jira-monitor.controller';
import { AuthService } from '@app/services/auth/auth.service';
import { JiraQueueMonitorService } from '@app/services/queue-monitor/jira-queue-monitor.service';
import { ProcessIssuesUseCase } from '@app/usecases/jira/process-issues.usecase';
import { JiraCredentialEntity } from '@domain/entities/jira-credential.entity';
import { JiraCredentialRepository } from '@infra/repositories/jira/jira-credential.repository';

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
