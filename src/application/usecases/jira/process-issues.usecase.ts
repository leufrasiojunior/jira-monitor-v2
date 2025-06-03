// src/application/usecases/jira/process-issues.usecase.ts

import { Injectable, Logger } from '@nestjs/common';

/**
 * UseCase que recebe o JSON bruto de issues retornado pela API do Jira e:
 *  1) Filtra para remover todas as issues cujo campo `status` seja:
 *     - "Resolvido"
 *     - "concluído"
 *     - "Cancelado"
 *     (comparação feita de forma case-insensitive)
 *  2) Mapeia cada issue restante para um formato resumido contendo:
 *     { key, summary, status, created, assignee, reporter, priority, timeOpenDays }
 *     onde `timeOpenDays` é quantos dias se passaram desde a data de criação até agora.
 *     Se a data de criação for inválida ou ausente, `timeOpenDays` será 0.
 *  3) Conta dinamicamente quantas issues existem para cada status (após filtro),
 *     sem precisar antecipar quais são os nomes de status.
 *
 * Caso o JSON não tenha o formato esperado, retorna { total: 0, issues: [], statusCounts: {} }.
 */
@Injectable()
export class ProcessIssuesUseCase {
  private readonly logger = new Logger(ProcessIssuesUseCase.name);

  async execute(rawJson: any): Promise<any> {
    this.logger.log('Início do ProcessIssuesUseCase.execute');
    if (!rawJson || !Array.isArray(rawJson.issues)) {
      this.logger.warn('JSON inválido ou sem campo issues; retornando vazio');
      return {
        total: 0,
        issues: [],
        statusCounts: {},
      };
    }
    this.logger.debug(
      `Número bruto de issues recebido: ${rawJson.issues.length}`,
    );

    // 2) Filtra as issues que NÃO estejam em um dos status a excluir.
    const statusesToExclude = new Set(['resolvido', 'concluído', 'cancelado']);
    const filteredIssues = rawJson.issues.filter((issue: any) => {
      const statusName: string = issue.fields?.status?.name || '';
      const normalized = statusName.trim().toLowerCase();
      const exclude = statusesToExclude.has(normalized);
      if (exclude) {
        this.logger.debug(
          `Excluindo issue ${issue.key} com status '${statusName}'`,
        );
      }
      return !exclude;
    });
    this.logger.log(`Issues após filtro: ${filteredIssues.length}`);

    // 3) Mapeia cada issue filtrada para um objeto resumido
    const mappedIssues = filteredIssues.map((issue: any) => {
      const key = issue.key;
      const fields = issue.fields || {};

      const summary = fields.summary || '';
      const status = fields.status?.name || 'UNKNOWN';
      const createdStr: string = fields.created || '';
      const created = createdStr ? new Date(createdStr) : null;
      const assignee = fields.assignee?.displayName || null;
      const reporter = fields.reporter?.displayName || null;
      const priority = fields.priority?.name || null;

      // Cálculo de tempo em aberto em dias (valor padrão 0 se created não existir)
      let timeOpenDays = 0;
      if (created) {
        const now = Date.now();
        const createdTime = created.getTime();
        const diffMs = now - createdTime;
        timeOpenDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      const issueSummary = {
        key,
        summary,
        status,
        created,
        assignee,
        reporter,
        priority,
        timeOpenDays,
      };
      this.logger.debug(`Issue processada: ${JSON.stringify(issueSummary)}`);
      return issueSummary;
    });

    // 4) Conta quantas issues existem para cada status dinamicamente
    const statusCounts: Record<string, number> = {};
    for (const issue of mappedIssues) {
      const st = issue.status;
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }
    this.logger.log(`Contagem por status: ${JSON.stringify(statusCounts)}`);

    // 5) Retorna o total de issues após filtro, a lista mapeada e os contadores por status
    const result = {
      total: mappedIssues.length,
      statusCounts,
      issues: mappedIssues,
    };
    this.logger.log(
      `ProcessIssuesUseCase.execute concluído; total final: ${result.total}`,
    );
    return result;
  }
}
