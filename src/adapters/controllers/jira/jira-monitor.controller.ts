// src/adapters/controllers/jira/jira-monitor.controller.ts

import { ProcessedIssuesResponseDto } from '@app/dtos/jira/processed-issues-response.dto';
import { JiraQueueMonitorService } from '@app/services/queue-monitor/jira-queue-monitor.service';
import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';

// 1) Importa decoradores do Swagger
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';

// 2) Importa o DTO de resposta

@ApiTags('Jira Monitor') // Agrupa esse controller na seção “Jira Monitor”
@Controller('jira/monitor')
export class JiraMonitorController {
  constructor(private readonly jiraMonitorService: JiraQueueMonitorService) {}

  /**
   * GET /jira/monitor/fetch?userId=XYZ
   * Executa a busca de issues no Jira e retorna o JSON processado pelo UseCase.
   */
  @ApiOperation({
    summary: 'Buscar e processar issues do Jira',
    description:
      'Executa imediatamente a consulta ao Jira para o projeto OMNIJS, filtra, agrupa e retorna resumo das issues.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Identificador das credenciais (ex.: "default")',
  })
  // 3) Em caso de sucesso (200), retorna o DTO ProcessedIssuesResponseDto
  @ApiOkResponse({
    description:
      'Retorna objeto contendo total, lista de issues e contagem por status',
    type: ProcessedIssuesResponseDto,
  })
  // 4) Possíveis erros
  @ApiResponse({
    status: 400,
    description: 'Parâmetro inválido (ex.: userId não existe)',
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno ao processar a requisição',
  })
  @Get('fetch')
  async fetchIssues(
    @Query('userId') userId?: string,
  ): Promise<ProcessedIssuesResponseDto> {
    const effectiveUserId = userId || 'default';
    try {
      return await this.jiraMonitorService.fetchAndProcessIssues(
        effectiveUserId,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Falha ao buscar/processar issues para userId="${effectiveUserId}": ${error.message}`,
      );
    }
  }
}
