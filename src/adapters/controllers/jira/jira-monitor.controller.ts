// src/adapters/controllers/jira/jira-monitor.controller.ts

import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
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
    try {
      // Se não recebeu JQL, passamos undefined para que o service use o padrão
      return await this.jiraMonitorService.fetchAndProcessIssues(
        effectiveUserId,
        jql,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Falha ao buscar/processar issues para userId="${effectiveUserId}": ${error.message}`,
      );
    }
  }
}
