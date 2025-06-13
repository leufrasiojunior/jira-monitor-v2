// src/adapters/controllers/jira/jira-cron.controller.ts

import { Controller, Post, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JiraQueueMonitorService } from '@services/queue-monitor/jira-queue-monitor.service';

/**
 * JiraCronController
 * ------------------
 * Responsável apenas por expor endpoints para controle manual dos jobs Cron
 * relacionados ao monitoramento de filas do Jira.
 */
@ApiTags('Jira Cron')
@Controller('jira/monitor/cron')
export class JiraCronController {
  private readonly logger = new Logger(JiraCronController.name);

  constructor(private readonly jiraMonitorService: JiraQueueMonitorService) {}

  /** Inicia o job Cron manualmente */
  @ApiOperation({ summary: 'Iniciar cron de monitoramento' })
  @ApiResponse({ status: 201, description: 'Cron iniciado.' })
  @Post('start')
  startCron(): { message: string } {
    this.logger.log('Iniciando cron via endpoint');
    this.jiraMonitorService.startCron();
    return { message: 'Cron iniciado' };
  }

  /** Interrompe o job Cron manualmente */
  @ApiOperation({ summary: 'Parar cron de monitoramento' })
  @ApiResponse({ status: 200, description: 'Cron parado.' })
  @Post('stop')
  stopCron(): { message: string } {
    this.logger.log('Parando cron via endpoint');
    this.jiraMonitorService.stopCron();
    return { message: 'Cron parado' };
  }
}
