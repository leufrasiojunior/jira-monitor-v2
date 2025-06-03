// src/adapters/controllers/jira/jira-monitor.controller.ts

import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';
import { JiraQueueMonitorService } from '../../../application/services/queue-monitor/jira-queue-monitor.service';

/**
 * Controller responsável por expor endpoints para forçar a execução
 * do monitor de filas do Jira (“fetchAndProcessIssues”) manualmente.
 */
@Controller('jira/monitor')
export class JiraMonitorController {
  constructor(private readonly jiraMonitorService: JiraQueueMonitorService) {}

  /**
   * GET /jira/monitor/fetch?userId=XYZ
   *
   * Rota alternativa que executa imediatamente a busca de issues no Jira
   * para o userId fornecido (ou “default” se não especificado).
   *
   * Exemplo de chamada: GET http://localhost:3000/jira/monitor/fetch
   *   (usar userId=default, pois só há uma credencial).
   */
  @Get('fetch')
  async fetchIssues(@Query('userId') userId?: string): Promise<any> {
    // Se não vier userId como query param, usa “default”
    const effectiveUserId = userId || 'default';

    try {
      // Chama o método que busca e processa issues
      const result =
        await this.jiraMonitorService.fetchAndProcessIssues(effectiveUserId);
      return result;
    } catch (error) {
      // Em caso de falha, lança exceção para que o Nest envie 500 com a mensagem
      throw new InternalServerErrorException(
        `Falha ao buscar/ processar issues para userId="${effectiveUserId}": ${error.message}`,
      );
    }
  }
}
