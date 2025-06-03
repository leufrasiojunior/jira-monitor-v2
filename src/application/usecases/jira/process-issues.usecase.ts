// src/application/usecases/jira/process-issues.usecase.ts

import { Injectable } from '@nestjs/common';

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
  async execute(rawJson: any): Promise<any> {
    // 1) Verifica se rawJson.issues existe e é um array
    if (!rawJson || !Array.isArray(rawJson.issues)) {
      return {
        total: 0,
        issues: [],
        statusCounts: {},
      };
    }

    // 2) Filtra as issues que NÃO estejam em um dos status a excluir.
    //    - Normaliza o nome do status para minúsculas, removendo espaços extras.
    const statusesToExclude = new Set(['resolvido', 'concluído', 'cancelado']);
    const filteredIssues = rawJson.issues.filter((issue: any) => {
      const statusName: string = issue.fields?.status?.name || '';
      const normalized = statusName.trim().toLowerCase();
      return !statusesToExclude.has(normalized);
    });

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
        // Converte milissegundos em dias, arredondando para baixo
        timeOpenDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        key,
        summary,
        status,
        created,
        assignee,
        reporter,
        priority,
        timeOpenDays,
      };
    });

    // 4) Conta quantas issues existem para cada status dinamicamente
    const statusCounts: Record<string, number> = {};
    for (const issue of mappedIssues) {
      const st = issue.status;
      if (statusCounts[st]) {
        statusCounts[st]++;
      } else {
        statusCounts[st] = 1;
      }
    }

    // 5) Retorna o total de issues após filtro, a lista mapeada e os contadores por status
    return {
      total: mappedIssues.length,
      issues: mappedIssues,
      statusCounts,
    };
  }
}
