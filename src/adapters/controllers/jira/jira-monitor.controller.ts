// src/adapters/controllers/jira/jira-monitor.controller.ts

import {
  Controller,
  Get,
  Post,
  InternalServerErrorException,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JiraQueueMonitorService } from '@services/queue-monitor/jira-queue-monitor.service';

// Decorators do Swagger para documentação automática
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';

import { ProcessedIssuesResponseDto } from '@dtos/jira/processed-issues-response.dto';

/**
 * JiraMonitorController
 * ---------------------
 * Exponencial endpoints para interagir com o monitor de filas Jira:
 *  - fetchIssues: busca e processa issues via JQL dinâmico
 *  - refreshTokenManually: renova token manualmente
 *  - postActions: executa ações de escrita em uma issue específica
 */
@ApiTags('Jira Monitor')
@Controller('jira/monitor')
export class JiraMonitorController {
  // Logger para rastrear chamadas e facilitar debug
  private readonly logger = new Logger(JiraMonitorController.name);

  constructor(private readonly jiraMonitorService: JiraQueueMonitorService) {}

  /**
   * GET /jira/monitor/fetch?userId={userId}&jql={jql}
   *
   * Busca issues no Jira usando JQL dinâmico ou padrão,
   * processa os resultados e retorna o DTO com resumo.
   */
  @ApiOperation({
    summary: 'Buscar e processar issues do Jira com JQL dinâmico',
    description:
      'Consulta o Jira usando o JQL informado (ou padrão OMNIJS), filtra, agrupa e retorna resumo das issues.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Identificador das credenciais (ex.: "default").',
  })
  @ApiQuery({
    name: 'jql',
    required: false,
    description:
      'JQL completo; se omitido, usa: project = "OMNIJS" ORDER BY created DESC.',
  })
  @ApiOkResponse({
    description: 'Retorna summary com total, issues e statusCounts.',
    type: ProcessedIssuesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Erro interno.' })
  @Get('fetch')
  async fetchIssues(
    @Query('userId') userId?: string,
    @Query('jql') jql?: string,
  ): Promise<ProcessedIssuesResponseDto> {
    const effectiveUserId = userId || 'default';
    this.logger.log(
      `GET /jira/monitor/fetch - userId=${effectiveUserId}, jql=${jql}`,
    );
    try {
      const result = await this.jiraMonitorService.fetchAndProcessIssues(
        effectiveUserId,
        jql,
      );
      this.logger.log(
        `fetchIssues sucesso - userId=${effectiveUserId}, total=${result.total}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `fetchIssues erro - userId=${effectiveUserId}, message=${error.message}`,
      );
      throw new InternalServerErrorException(
        `Falha ao buscar/processar issues: ${error.message}`,
      );
    }
  }

  /**
   * GET /jira/monitor/post-actions?issueKey={issueKey}
   *
   * Executa ações de escrita (campo, transição, comentário) em uma issue específica.
   */
  @ApiOperation({
    summary: 'Executar post-actions em uma issue específica',
    description:
      'Atualiza campo customizado, aplica transições e adiciona comentário na issue informada.',
  })
  @ApiQuery({
    name: 'issueKey',
    required: true,
    description: 'Chave da issue (ex.: "OMNIJS-101").',
  })
  @ApiOkResponse({
    description: 'Ações executadas com sucesso.',
    schema: {
      example: { message: 'Post actions concluídas para issue OMNIJS-101' },
    },
  })
  @ApiResponse({ status: 400, description: 'Parâmetro issueKey ausente.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao executar ações.' })
  @Get('post-actions')
  async postActions(
    @Query('issueKey') issueKey: string,
  ): Promise<{ message: string }> {
    if (!issueKey) {
      throw new BadRequestException('Parâmetro issueKey é obrigatório.');
    }
    this.logger.log(`GET /jira/monitor/post-actions - issueKey=${issueKey}`);
    try {
      const cred =
        await this.jiraMonitorService['jiraCredRepo'].findByUserId('default');
      if (!cred) {
        this.logger.error('Credenciais não encontradas para post-actions');
        throw new InternalServerErrorException('Credenciais não encontradas.');
      }
      await this.jiraMonitorService.performPostActions(issueKey, cred.cloudId);
      this.logger.log(`postActions concluído - issueKey=${issueKey}`);
      return { message: `Post actions concluídas para issue ${issueKey}` };
    } catch (error) {
      this.logger.error(
        `postActions erro - issueKey=${issueKey}, message=${error.message}`,
      );
      throw new InternalServerErrorException(
        `Falha nas ações: ${error.message}`,
      );
    }
  }
}
