// src/application/services/jira/jira-queue-monitor.service.ts

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ConfigService } from '@nestjs/config';
import { ProcessIssuesUseCase } from '@app/usecases/jira/process-issues.usecase';

/**
 * Serviço responsável por:
 *  1) Fazer chamada GET na API Jira usando autenticação básica.
 *  2) Encaminhar o JSON bruto para o UseCase que tratará esses dados.
 *
 * A busca de issues ocorre a cada 10 minutos, via @Cron (cron expression).
 */
@Injectable()
export class JiraQueueMonitorService {
  private readonly logger = new Logger(JiraQueueMonitorService.name);
  private readonly DEFAULT_JQL = 'project = "OMNIJS" ORDER BY created DESC';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly processIssuesUseCase: ProcessIssuesUseCase,
  ) {}

  private async performPostActions(issueKey: string): Promise<void> {
    const jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL');
    const username = this.configService.get<string>('JIRA_USERNAME');
    const apiToken = this.configService.get<string>('JIRA_API_TOKEN');
    const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');
    const baseUrl = `${jiraBaseUrl}/rest/api/3/issue/${issueKey}`;
    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    };

    try {
      const updatePayload = {
        fields: {
          customfield_11231: { value: 'Minor / Localized' },
        },
      };
      await firstValueFrom(
        this.httpService.post(baseUrl, updatePayload, { headers }),
      );

      const transitionsUrl = `${baseUrl}/transitions`;
      await firstValueFrom(
        this.httpService.post(
          transitionsUrl,
          { transition: { id: '11' } },
          { headers },
        ),
      );
      await firstValueFrom(
        this.httpService.post(
          transitionsUrl,
          { transition: { id: '131' } },
          { headers },
        ),
      );

      const commentPayload = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Sua solicitação está sob análise. Estamos trabalhando para resolvê-la o mais rápido possível.\nAtenciosamente,\nEquipe de Suporte ',
                },
              ],
            },
          ],
        },
      };
      await firstValueFrom(
        this.httpService.post(`${baseUrl}/comment`, commentPayload, {
          headers,
        }),
      );

      this.logger.log(`Post actions concluídas para issue ${issueKey}`);
    } catch (error) {
      this.logger.error(
        `Falha ao executar post actions para issue ${issueKey}: ${error.message}`,
      );
    }
  }

  /**
   * Passo 8.1.1: Método agendado para rodar automaticamente a cada 10 minutos.
   *    - Chama a API Jira usando autenticação básica.
   *    - Encaminha o JSON para o ProcessIssuesUseCase.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleInterval() {
    const userId = 'default';
    this.logger.log(
      `Início do job agendado de busca de issues para userId="${userId}".`,
    );
    try {
      await this.fetchAndProcessIssues(userId);
      this.logger.log(
        `Job agendado de busca de issues concluído para userId="${userId}".`,
      );
    } catch (err) {
      this.logger.error(
        `Erro no agendamento de JiraQueueMonitor para userId="${userId}": ${err.message}`,
      );
      throw new InternalServerErrorException(
        `Erro no agendamento de JiraQueueMonitor: ${err.message}`,
      );
    }
  }

  /**
   * Função pública que pode ser chamada diretamente (por exemplo, via controller)
   * para forçar a consulta ao Jira e processamento imediato.
   *
   * @param userId Identificador das credenciais (ex.: "default")
   * @param jql   Consulta JQL completa; se omitido, usa DEFAULT_JQL
   */
  async fetchAndProcessIssues(userId: string, jql?: string): Promise<any> {
    this.logger.log(`Iniciando fetchAndProcessIssues para userId="${userId}".`);

    const jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL');
    const username = this.configService.get<string>('JIRA_USERNAME');
    const apiToken = this.configService.get<string>('JIRA_API_TOKEN');
    const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');

    const jqlToUse = jql || this.DEFAULT_JQL;
    this.logger.log(`Usando JQL="${jqlToUse}" para userId="${userId}".`);
    const encodedJql = encodeURIComponent(jqlToUse);

    // 4) Monta a URL final de consulta ao Jira
    const apiUrl = `${jiraBaseUrl}/rest/api/3/search?jql=${encodedJql}`;
    this.logger.log(`Realizando GET em ${apiUrl}.`);

    // 5) Executar a requisição GET para a API Jira
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        }),
      );
      this.logger.log(
        `Resposta recebida do Jira para userId="${userId}". Status: ${response.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao consultar Jira em ${apiUrl} para userId="${userId}": ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Falha ao consultar Jira (${apiUrl}): ${error.message}`,
      );
    }

    // 6) Enviar o JSON bruto retornado para o UseCase que irá tratá-lo
    this.logger.log(
      `Enviando dados para ProcessIssuesUseCase para userId="${userId}".`,
    );
    const result = await this.processIssuesUseCase.execute(response.data);
    this.logger.log(
      `ProcessIssuesUseCase concluído para userId="${userId}". Total issues: ${result.total}`,
    );

    const openIssues = result.issues.filter((issue: any) => {
      const st = (issue.status || '').toLowerCase();
      return st.includes('open') || st.includes('aberto');
    });

    for (const issue of openIssues) {
      await this.performPostActions(issue.key);
    }

    return result;
  }
}
