// src/application/services/jira/jira-queue-monitor.service.ts

/**
 * JiraQueueMonitorService
 * ----------------------
 * Serviço principal para monitorar filas de issues do Jira e executar ações automatizadas.
 *
 * Funcionalidades:
 *   1) Busca de issues abertas via JQL (Query Language do Jira) a partir da API de Search.
 *   2) Processamento dos dados brutos via UseCase para filtrar, mapear e agrupar resultados.
 *   3) Execução de ações automáticas em cada issue aberta:
 *      - Atualização de campos customizados (PUT /issue/{issueKey}).
 *      - Transição de status para fluxos de trabalho (POST /issue/{issueKey}/transitions).
 *      - Inclusão de comentários (POST /issue/{issueKey}/comment).
 *   4) Agendamento periódico do fluxo de fetch (cron configurável).
 *
 * Autenticação:
 *   - Operações de leitura (Search) usam Basic Auth com JIRA_EMAIL e JIRA_API_TOKEN.
 *   - Operações de escrita (PUT/POST em issue) usam Basic Auth com JIRA_EMAIL e JIRA_API_TOKEN.
 *
 * Configurações via Variáveis de Ambiente (.env):
 *   - JIRA_API_BASE_URL: URL base para calls de Search (https://api.atlassian.com).
 *   - JIRA_BASE_URL: URL base da instância Jira Cloud (ex.: https://meu-domain.atlassian.net).
 *   - JIRA_EMAIL: e-mail da conta Atlassian para Basic Auth.
 *   - JIRA_API_TOKEN: token de API gerado em id.atlassian.com.
 *
 * Fluxo de execução:
 *   handleInterval() -> fetchAndProcessIssues(userId) -> processIssuesUseCase.execute()
 *     -> performPostActions(issueKey, cloudId) para cada issue aberta.
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { JiraCredentialRepository } from '@infra/repositories/jira/jira-credential.repository';
import { ProcessIssuesUseCase } from '@app/usecases/jira/process-issues.usecase';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JiraQueueMonitorService {
  // Logger para registrar eventos e facilitar debug
  private readonly logger = new Logger(JiraQueueMonitorService.name);
  // JQL padrão para buscar issues do projeto OMNIJS, ordenadas por data de criação
  private readonly DEFAULT_JQL = 'project = "OMNIJS" ORDER BY created DESC';

  constructor(
    private readonly httpService: HttpService, // Cliente HTTP do Nest
    private readonly jiraCredRepo: JiraCredentialRepository, // Repositório para obter cloudId
    private readonly configService: ConfigService, // Acesso a variáveis de ambiente
    private readonly processIssuesUseCase: ProcessIssuesUseCase, // UseCase para processamento de issues
    private readonly schedulerRegistry: SchedulerRegistry, // Controle dos crons
  ) {}

  /** Recupera a base URL da API do Jira das variáveis de ambiente. */
  private getApiBaseUrl(): string {
    const apiBase = this.configService.get<string>('JIRA_API_BASE_URL');
    if (!apiBase) {
      this.logger.error('Variável JIRA_API_BASE_URL não definida');
      throw new InternalServerErrorException(
        'Configuração ausente: JIRA_API_BASE_URL',
      );
    }
    this.logger.debug(`Usando JIRA_API_BASE_URL=${apiBase}`);
    return apiBase;
  }

  /** Gera o header Authorization com credenciais básicas. */
  private getBasicAuthHeader(): string {
    const email = this.configService.get<string>('JIRA_USERNAME');
    const token = this.configService.get<string>('JIRA_API_TOKEN');
    if (!email || !token) {
      this.logger.error('JIRA_USERNAME ou JIRA_API_TOKEN não definidos');
      throw new InternalServerErrorException('Credenciais Basic Auth ausentes');
    }
    const encoded = Buffer.from(`${email}:${token}`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * performPostActions
   * ------------------
   * Executa ações de escrita em uma issue específica:
   *   - Atualiza campos customizados (PUT)
   *   - Executa transições de workflow (POST /transitions)
   *   - Adiciona comentário (POST /comment)
   *
   * @param issueKey - chave da issue (ex.: "OMNIJS-123")
   * @param cloudId  - identificador da instância Jira para Search
   */
  async performPostActions(issueKey: string, cloudId: string): Promise<void> {
    // 1) Obter URL base da instância Jira Cloud
    const jiraBase = this.getApiBaseUrl();

    // 2) Cabeçalho de autenticação
    const authHeader = this.getBasicAuthHeader();

    // 3) Definir URL e headers para as chamadas
    const issueUrl = `${jiraBase}/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`;

    const headers = {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      // 3.1) PUT - Atualizar campo customizado
      const updatePayload = {
        fields: { customfield_11231: { value: 'Minor / Localized' } },
      };
      this.logger.debug(
        `PUT ${issueUrl} payload=${JSON.stringify(updatePayload)}`,
      );
      await firstValueFrom(
        this.httpService.put(issueUrl, updatePayload, { headers }),
      );

      // 3.2) POST - Primeira transição de workflow
      const transitionsUrl = `${issueUrl}/transitions`;
      const transition1 = { transition: { id: '11' } };
      this.logger.debug(
        `POST ${transitionsUrl} payload=${JSON.stringify(transition1)}`,
      );
      await firstValueFrom(
        this.httpService.post(transitionsUrl, transition1, { headers }),
      );

      // 3.3) POST - Segunda transição de workflow
      const transition2 = { transition: { id: '131' } };
      this.logger.debug(
        `POST ${transitionsUrl} payload=${JSON.stringify(transition2)}`,
      );
      await firstValueFrom(
        this.httpService.post(transitionsUrl, transition2, { headers }),
      );

      // 3.4) POST - Adicionar comentário rich-text
      const commentUrl = `${issueUrl}/comment`;
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
                  text: 'Sua solicitação está sob análise. Atenciosamente, Equipe de Suporte.',
                },
              ],
            },
          ],
        },
      };
      this.logger.debug(
        `POST ${commentUrl} payload=${JSON.stringify(commentPayload)}`,
      );
      await firstValueFrom(
        this.httpService.post(commentUrl, commentPayload, { headers }),
      );

      this.logger.log(`Post actions concluídas para issue ${issueKey}`);
    } catch (error) {
      this.logger.error(
        `Falha no post actions para ${issueKey}: ${error.message}`,
      );
    }
  }

  /**
   * handleInterval
   * --------------
   * Job Cron que dispara a cada minuto (configurável) para:
   *   - Buscar e processar issues
   *   - Executar ações automáticas em issues abertas
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'jira-fetch-cron' })
  async handleInterval() {
    const userId = 'default';
    this.logger.log(
      `Iniciando cron fetchAndProcessIssues para userId=${userId}`,
    );
    try {
      await this.fetchAndProcessIssues(userId);
      this.logger.log(`Cron concluído para userId=${userId}`);
    } catch (err) {
      this.logger.error(`Erro no cron: ${err.message}`);
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * fetchAndProcessIssues
   * ----------------------
   * 1) Obtém cloudId do banco
   * 2) Monta e executa GET /search via API Atlassian com Basic Auth
   * 3) Processa JSON bruto via ProcessIssuesUseCase
   * 4) Para cada issue aberta, chama performPostActions
   *
   * @param userId - id de credenciais ("default")
   * @param jql    - string JQL opcional (usa DEFAULT_JQL se ausente)
   */
  async fetchAndProcessIssues(userId: string, jql?: string): Promise<any> {
    this.logger.log(`fetchAndProcessIssues iniciado para userId=${userId}`);

    // 1) Recuperar credenciais e cloudId
    const cred = await this.jiraCredRepo.findByUserId(userId);
    if (!cred) {
      this.logger.error(`Credenciais não encontradas para userId=${userId}`);
      throw new InternalServerErrorException('Credenciais não encontradas');
    }
    const cloudId = cred.cloudId;

    // 2) Montar URL de Search
    const apiBase = this.getApiBaseUrl();

    const jqlToUse = jql || this.DEFAULT_JQL;
    const encodedJql = encodeURIComponent(jqlToUse);
    const apiUrl = `${apiBase}/ex/jira/${cloudId}/rest/api/3/search?jql=${encodedJql}&maxResults=50`;
    this.logger.log(`GET ${apiUrl}`);

    // 3) Executar GET com Basic Auth
    const authHeader = this.getBasicAuthHeader();

    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }),
      );
      this.logger.log(`GET concluído com status ${response.status}`);
    } catch (error) {
      this.logger.error(`Falha no GET ${apiUrl}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    // 4) Processar issues
    const result = await this.processIssuesUseCase.execute(response.data);
    this.logger.log(`ProcessIssuesUseCase result.total=${result.total}`);

    // 5) Executar ações em issues abertas
    const openIssues = result.issues.filter((i) =>
      ['open', 'aberto'].some((s) => i.status.toLowerCase().includes(s)),
    );
    for (const issue of openIssues) {
      await this.performPostActions(issue.key, cloudId);
    }

    return result;
  }

  /** Inicia o cron agendado manualmente */
  startCron(): void {
    const job = this.schedulerRegistry.getCronJob('jira-fetch-cron');
    if (!job.isActive) {
      job.start();
      this.logger.log('Cron jira-fetch-cron iniciado manualmente');
    }
  }

  /** Interrompe a execução do cron agendado */
  stopCron(): void {
    const job = this.schedulerRegistry.getCronJob('jira-fetch-cron');
    if (job.isActive) {
      job.stop();
      this.logger.log('Cron jira-fetch-cron parado manualmente');
    }
  }
}
