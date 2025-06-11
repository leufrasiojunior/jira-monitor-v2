// src/application/services/jira/jira-queue-monitor.service.ts

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';

import { JiraCredentialRepository } from '@infra/repositories/jira/jira-credential.repository';
import { ProcessIssuesUseCase } from '@app/usecases/jira/process-issues.usecase';
import { AuthService } from '@services/auth/auth.service';

/**
 * Serviço responsável por:
 *  1) Recuperar do banco (SQLite) as credenciais OAuth do Jira para um dado userId.
 *  2) Verificar o token (accessToken) e renovar automaticamente se estiver perto de expirar.
 *  3) Fazer chamada GET na API Jira para buscar issues do projeto OMNIJS.
 *  4) Encaminhar o JSON bruto para o UseCase que tratará esses dados.
 *
 * A verificação automática do token ocorrerá a cada 50 minutos, via @Cron.
 * A busca de issues ocorre a cada 10 minutos, via @Cron (cron expression).
 */
@Injectable()
export class JiraQueueMonitorService {
  private readonly logger = new Logger(JiraQueueMonitorService.name);
  /**
   * Buffer de 1 minuto antes da expiração real do token:
   * se faltar menos de 1 minuto para expirar, já renovamos antecipadamente.
   */
  private readonly REFRESH_BUFFER_MS = 60 * 1000; // 1 minuto
  private readonly DEFAULT_JQL = 'project = "OMNIJS" ORDER BY created DESC';

  constructor(
    private readonly httpService: HttpService,
    private readonly jiraCredRepo: JiraCredentialRepository,
    private readonly authService: AuthService,
    private readonly processIssuesUseCase: ProcessIssuesUseCase,
  ) {}

  private async performPostActions(
    issueKey: string,
    accessToken: string,
    cloudId: string,
  ): Promise<void> {
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
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
   * Verifica a validade do token a cada 50 minutos:
   * se estiver a menos de 1 minuto de expirar, renova via AuthService.refreshAccessToken().
   */
  @Cron('*/50 * * * *') // rodará nos minutos 0 e 50 de cada hora (aprox. a cada 50 minutos)
  async checkAndRefreshToken() {
    const userId = 'default';
    this.logger.log(`Iniciando verificação de token para userId="${userId}".`);
    const cred = await this.jiraCredRepo.findByUserId(userId);
    if (!cred) {
      this.logger.warn(
        `Nenhuma credencial encontrada para userId="${userId}". Abortando check.`,
      );
      return;
    }

    const now = Date.now();
    const expiresAtTime = cred.expiresAt.getTime();
    const msLeft = expiresAtTime - now;
    this.logger.debug(`Token expira em ${msLeft} ms para userId="${userId}".`);

    if (msLeft < this.REFRESH_BUFFER_MS) {
      this.logger.log(
        `Token próximo da expiração (faltam ${msLeft} ms). Renovando...`,
      );
      try {
        await this.authService.refreshAccessToken(userId);
        this.logger.log(
          `Token do Jira renovado automaticamente para userId="${userId}".`,
        );
      } catch (error) {
        this.logger.error(
          `Falha ao renovar token automaticamente para userId="${userId}": ${error.message}`,
        );
      }
    } else {
      this.logger.log(
        `Token ainda válido (faltam ${msLeft} ms). Não é necessário renovar.`,
      );
    }
  }

  /**
   * Passo 8.1.1: Método agendado para rodar automaticamente a cada 10 minutos.
   *    - Busca/renova token se necessário (chamando checkAndRefreshToken).
   *    - Chama a API Jira.
   *    - Encaminha o JSON para o ProcessIssuesUseCase.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleInterval() {
    const userId = 'default';
    this.logger.log(
      `Início do job agendado de busca de issues para userId="${userId}".`,
    );
    try {
      // Antes de buscar issues, garante que o token está válido
      await this.checkAndRefreshToken();
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
    // 1) Recuperar credencial do banco para este userId
    const cred = await this.jiraCredRepo.findByUserId(userId);
    if (!cred) {
      this.logger.error(
        `Credenciais do Jira não encontradas para userId="${userId}".`,
      );
      throw new InternalServerErrorException(
        `Credenciais do Jira não encontradas para userId="${userId}".`,
      );
    }
    this.logger.debug(
      `Credencial encontrada para userId="${userId}", cloudId="${cred.cloudId}".`,
    );

    // 2) Verificar e renovar token se necessário
    const now = Date.now();
    const expiresAtTime = cred.expiresAt.getTime();
    const msLeft = expiresAtTime - now;
    this.logger.debug(`Token expira em ${msLeft} ms para userId="${userId}".`);
    if (msLeft < this.REFRESH_BUFFER_MS) {
      this.logger.log(
        `Token próximo da expiração (faltam ${msLeft} ms). Renovando antes da busca...`,
      );
      try {
        const { newAccessToken, newRefreshToken, newExpiresIn } =
          await this.authService.refreshAccessToken(userId);

        cred.accessToken = newAccessToken;
        cred.refreshToken = newRefreshToken;
        cred.expiresAt = new Date(now + newExpiresIn * 1000);
        this.logger.log(
          `Token renovado no fetchAndProcessIssues para userId="${userId}".`,
        );
      } catch (error) {
        this.logger.error(
          `Falha ao renovar token no fetchAndProcessIssues para userId="${userId}": ${error.message}`,
        );
      }
    }

    // 3) Decide qual JQL usar: recebido ou padrão
    const jqlToUse = jql || this.DEFAULT_JQL;
    this.logger.log(`Usando JQL="${jqlToUse}" para userId="${userId}".`);
    const encodedJql = encodeURIComponent(jqlToUse);

    // 4) Monta a URL final de consulta ao Jira
    const apiUrl = `https://api.atlassian.com/ex/jira/${cred.cloudId}/rest/api/3/search?jql=${encodedJql}`;
    this.logger.log(`Realizando GET em ${apiUrl}.`);

    // 5) Executar a requisição GET para a API Jira
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${cred.accessToken}`,
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
      await this.performPostActions(issue.key, cred.accessToken, cred.cloudId);
    }

    return result;
  }
}
