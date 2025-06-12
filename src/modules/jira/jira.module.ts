// src/modules/jira/jira.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { JiraMonitorController } from '@adapters/controllers/jira/jira-monitor.controller';
import { JiraQueueMonitorService } from '@app/services/queue-monitor/jira-queue-monitor.service';
import { ProcessIssuesUseCase } from '@app/usecases/jira/process-issues.usecase';

@Module({
  imports: [
    // 1) Garante que HttpService seja disponibilizado
    HttpModule,

    // 2) Habilita o ScheduleModule para que decoradores como @Interval funcionem
    ScheduleModule.forRoot(),
  ],
  controllers: [
    JiraMonitorController, // <-- adiciona o controller aqui
  ],
  providers: [
    // 3) Serviços
    JiraQueueMonitorService, // Nosso service agendado
    ProcessIssuesUseCase, // UseCase para tratar o JSON de issues
  ],
  exports: [JiraQueueMonitorService, ProcessIssuesUseCase],
})
export class JiraModule {}
