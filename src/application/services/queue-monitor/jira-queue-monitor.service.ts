// src/application/services/jira/jira-queue-monitor.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Interval } from '@nestjs/schedule';
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
 * A verificação automática ocorre a cada 10 minutos (600.000 ms).
 */
@Injectable()
export class JiraQueueMonitorService {
  /**
   * Buffer de 1 minuto antes da expiração real do token:
   * se faltar menos de 1 minuto para expirar, já renovamos antecipadamente.
   */
  private readonly REFRESH_BUFFER_MS = 60 * 1000; // 1 minuto em milissegundos

  /**
   * Construímos a URL completa de consulta usando:
   *   - JIRA_BASE_URL (do .env)
   *   - rota REST /rest/api/3/search
   *   - JQL: project = "OMNIJS" ORDER BY created DESC
   */
  private readonly JQL_QUERY =
    '?jql=project%20%3D%20"OMNIJS"%20ORDER%20BY%20created%20DESC';

  constructor(
    private readonly httpService: HttpService,
    private readonly jiraCredRepo: JiraCredentialRepository,
    private readonly authService: AuthService,
    private readonly processIssuesUseCase: ProcessIssuesUseCase, // injetamos o use case para tratar retorno
  ) {}

  /**
   * Passo 8.1.1: Método agendado para rodar automaticamente a cada 10 minutos.
   *    - Busca/renova token se necessário.
   *    - Chama a API Jira.
   *    - Encaminha o JSON para o ProcessIssuesUseCase.
   */
  @Interval(600000) // 600.000 ms = 10 minutos
  async handleInterval() {
    // Sempre usamos "default" para este exemplo, pois não há múltiplos usuários ainda.
    const userId = 'default';
    try {
      await this.fetchAndProcessIssues(userId);
    } catch (err) {
      // Logue ou trate como quiser; aqui apenas lançamos para o Nest capturar
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
   * @returns Resultado do ProcessIssuesUseCase (ou lança exceção em caso de erro).
   */
  async fetchAndProcessIssues(userId: string): Promise<any> {
    // 1) Recuperar credencial do banco para este userId
    const cred = await this.jiraCredRepo.findByUserId(userId);
    if (!cred) {
      throw new InternalServerErrorException(
        `Credenciais do Jira não encontradas para userId="${userId}".`,
      );
    }

    // 2) Verificar se o accessToken expirou ou está prestes a expirar.
    //    Se faltar menos que REFRESH_BUFFER_MS, renovamos antes de chamar a API.
    const now = Date.now();
    const expiresAtTime = cred.expiresAt.getTime();
    if (expiresAtTime - now < this.REFRESH_BUFFER_MS) {
      // 2.1) Invoca AuthService.refreshAccessToken para obter token novo
      const { newAccessToken, newRefreshToken, newExpiresIn } =
        await this.authService.refreshAccessToken(userId);

      // 2.2) Atualiza as variáveis locais para usar logo em seguida
      cred.accessToken = newAccessToken;
      cred.refreshToken = newRefreshToken;
      cred.expiresAt = new Date(now + newExpiresIn * 1000);
      // (O próprio AuthService já atualizou o SQLite via repositório)
    }

    // 3) Montar a URL completa de consulta ao Jira:
    //    ex: https://brandlive-summa.atlassian.net/rest/api/3/search?jql=...
    const cloudId = cred.cloudId;
    // if (!baseUrl) {
    //   throw new InternalServerErrorException(
    //     'Variável de ambiente JIRA_BASE_URL não definida.',
    //   );
    // }
    const apiUrl = `https://api.atlassian.com/ex/jira/${cred.cloudId}/rest/api/3/search${this.JQL_QUERY}`;

    // 4) Executar a requisição GET para a API Jira
    let response;
    try {
      response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${cred.accessToken}`, // usa o token (possivelmente renovado)
            Accept: 'application/json',
          },
        }),
      );
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        `Falha ao consultar Jira (${apiUrl}): ${error.message}`,
      );
    }

    // 5) Enviar o JSON bruto retornado para o UseCase que irá tratá-lo
    //    O UseCase pode filtrar, paginar, armazenar em outro local, etc.
    return this.processIssuesUseCase.execute(response.data);
  }
}
