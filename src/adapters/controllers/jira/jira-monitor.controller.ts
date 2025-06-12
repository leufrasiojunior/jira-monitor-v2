// src/adapters/controllers/jira/jira-monitor.controller.ts

import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Logger, // ▶️ import Logger
} from '@nestjs/common';
import { JiraQueueMonitorService } from '@services/queue-monitor/jira-queue-monitor.service';

// Decorators do Swagger
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';

import { ProcessedIssuesResponseDto } from '@dtos/jira/processed-issues-response.dto';

@ApiTags('Jira Monitor')
@Controller('jira/monitor')
export class JiraMonitorController {
  private readonly logger = new Logger(JiraMonitorController.name); // ▶️ instância de Logger

  constructor(private readonly jiraMonitorService: JiraQueueMonitorService) {}

  /**
   * GET /jira/monitor/fetch?userId=XYZ&jql=...
   * Executa a busca de issues no Jira usando o JQL fornecido (ou o padrão),
   * processa e retorna o JSON tratado.
   */
  @ApiOperation({
    summary: 'Buscar e processar issues do Jira com JQL dinâmico',
    description:
      'Consulta o Jira usando o JQL informado (ou o padrão do projeto OMNIJS), filtra, agrupa e retorna resumo das issues.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Identificador das credenciais (ex.: "default")',
  })
  @ApiQuery({
    name: 'jql',
    required: false,
    description:
      'Consulta JQL completa. Se omitido, usa: project = "OMNIJS" ORDER BY created DESC',
  })
  @ApiOkResponse({
    description:
      'Retorna objeto contendo total, lista de issues e contagem por status',
    type: ProcessedIssuesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Parâmetro inválido (ex.: JQL malformado)',
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno ao processar a requisição',
  })
  @Get('fetch')
  async fetchIssues(
    @Query('userId') userId?: string,
    @Query('jql') jql?: string,
  ): Promise<ProcessedIssuesResponseDto> {
    const effectiveUserId = userId || 'default';
    this.logger.log(
      `Requisição GET /jira/monitor/fetch - userId="${effectiveUserId}", jql="${jql}"`,
    ); // ▶️ log de entrada
    try {
      // Se não recebeu JQL, passamos undefined para que o service use o padrão
      const result = await this.jiraMonitorService.fetchAndProcessIssues(
        effectiveUserId,
        jql,
      );
      this.logger.log(
        `fetchIssues concluído para userId="${effectiveUserId}", total=${result.total}`,
      ); // ▶️ log de sucesso
      return result;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar/processar issues para userId="${effectiveUserId}": ${error.message}`,
      ); // ▶️ log de erro
      throw new InternalServerErrorException(
        `Falha ao buscar/processar issues para userId="${effectiveUserId}": ${error.message}`,
      );
    }
  }
}
