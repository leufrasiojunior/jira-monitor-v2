// src/modules/auth/auth.service.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    // 1) Injetamos HttpService para poder fazer HTTP requests (Axios)
    private readonly httpService: HttpService,
  ) {}

  /**
   * Gera um state aleatório (16 bytes → hex) e o armazena na sessão.
   * Usaremos esse state para validar o callback e impedir CSRF.
   */
  createState(session: Record<string, any>): string {
    const crypto = require('crypto');
    const state = crypto.randomBytes(16).toString('hex');
    session.jiraOAuthState = state;
    this.logger.debug(`State gerado e salvo na sessão: ${state}`);
    return state;
  }

  /**
   * Monta a URL de autorização do Jira (OAuth 2.0 3LO) usando variáveis de ambiente:
   *   - JIRA_CLIENT_ID
   *   - JIRA_REDIRECT_URI  (deve ser “http://localhost:3000/oauth/callback”)
   *
   * Parâmetros fixos:
   *   - audience=api.atlassian.com   (obrigatório para Jira Cloud)
   *   - scope=read:jira-work         (escopo mínimo requerido para ler issues)
   *   - response_type=code           (fluxo Authorization Code)
   *   - prompt=consent               (força a tela de consentimento)
   *
   * @param state Valor anti-CSRF gerado anteriormente
   * @returns URL completa para redirecionar o navegador ao Jira Cloud
   */
  buildAuthorizationUrl(state: string): string {
    // 2) Lê do process.env
    const clientId = process.env.JIRA_CLIENT_ID;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    // 3) Se faltar algo, lançamos erro para avisar que o .env está incompleto
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'As variáveis JIRA_CLIENT_ID e JIRA_REDIRECT_URI devem estar definidas no .env',
      );
    }

    // 4) Base URL de autorização (sempre https://auth.atlassian.com/authorize para Jira Cloud)
    const authBase = 'https://auth.atlassian.com/authorize';

    // 5) Montamos os query params com URLSearchParams para escapar adequadamente
    const params = new URLSearchParams({
      audience: 'api.atlassian.com', // obrigatório para Jira Cloud
      client_id: clientId, // do process.env
      scope: 'read:jira-work offline_access', // ⬅ adicionamos offline_access
      redirect_uri: redirectUri, // do process.env (http://localhost:3000/oauth/callback)
      state, // state anti-CSRF gerado antes
      response_type: 'code', // fluxo Authorization Code
      prompt: 'consent', // força a tela de consentimento
    });

    // 6) Retornamos a URL completa que deve ser usada pelo navegador
    return `${authBase}?${params.toString()}`;
  }

  /**
   * Lida com o callback do Jira (chamado em /oauth/callback?code=…&state=…).
   *
   * Passos:
   *   1) Valida se o state recebido coincide com session.jiraOAuthState.
   *   2) Troca o authorization code por access_token e refresh_token:
   *        POST https://auth.atlassian.com/oauth/token
   *        Body JSON: {
   *          grant_type:    'authorization_code',
   *          client_id:     process.env.JIRA_CLIENT_ID,
   *          client_secret: process.env.JIRA_CLIENT_SECRET,
   *          code,
   *          redirect_uri:  process.env.JIRA_REDIRECT_URI
   *        }
   *      → Resposta: { access_token, refresh_token, expires_in, ... }
   *   3) Armazena access_token e refresh_token em session.
   *   4) Usa access_token para chamar:
   *        GET https://api.atlassian.com/oauth/token/accessible-resources
   *        Headers: { Authorization: `Bearer ${access_token}` }
   *      → Resposta: array de recursos (quase sempre pegamos o primeiro item e usamos resources[0].id como cloudId).
   *   5) Armazena o cloudId em session.jiraCloudId para futuras chamadas.
   *
   * Variáveis obrigatórias em .env:
   *   - JIRA_CLIENT_ID
   *   - JIRA_CLIENT_SECRET
   *   - JIRA_REDIRECT_URI  (http://localhost:3000/oauth/callback)
   *
   * @param code    – valor de “code” passado pelo Jira na query param
   * @param session – objeto de sessão (req.session) para armazenar tokens e cloudId
   */
  async handleCallback(
    code: string,
    session: Record<string, any>,
  ): Promise<void> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'JIRA_CLIENT_ID, JIRA_CLIENT_SECRET e JIRA_REDIRECT_URI devem estar definidos no .env',
      );
    }

    // ──────────── 1) TROCAR 'code' POR 'access_token' + 'refresh_token' ────────────
    try {
      // 1.1) Disparar a requisição POST para o endpoint de tokens
      const tokenResponse: AxiosResponse<any> = await lastValueFrom(
        this.httpService.post(
          'https://auth.atlassian.com/oauth/token',
          {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json', // garante resposta em JSON
            },
          },
        ),
      );

      // 1.2) **Log raw** da resposta – vamos ver exatamente o que o Jira retornou
      this.logger.debug(
        'Resposta completa do token endpoint:',
        JSON.stringify(tokenResponse.data),
      );

      // 1.3) Tenta extrair os tokens do body
      const accessToken = tokenResponse.data?.access_token;
      const refreshToken = tokenResponse.data?.refresh_token;

      // 1.4) Se qualquer um estiver faltando, lança erro detalhado
      if (!accessToken || !refreshToken) {
        // Antes de lançar, incluímos o próprio JSON devolvido na mensagem de erro
        const rawBody = JSON.stringify(tokenResponse.data);
        throw new Error(
          `Não retornou access_token ou refresh_token. Body recebido: ${rawBody}`,
        );
      }

      // 1.5) Se chegamos aqui, salvamos os tokens na sessão
      session.jiraAccessToken = accessToken;
      session.jiraRefreshToken = refreshToken;
      this.logger.debug('Access e refresh tokens armazenados na sessão.');
    } catch (err) {
      // 1.6) Se cair aqui, significa que algo deu errado na requisição/token parsing
      //      Vamos logar para facilitar diagnóstico e depois jogar a exceção
      const errData = (err as any).response?.data || (err as any).message;
      this.logger.error(
        'Falha na requisição ao endpoint de token do Jira:',
        errData,
      );
      // Repassa a mensagem (que já contém o rawBody se falhou no parsing)
      throw new BadRequestException(
        'Falha na requisição ao endpoint de token do Jira: ' + errData,
      );
    }

    // ──────────── 2) OBTER O cloudId VIA "accessible-resources" ────────────
    try {
      const accessToken = session.jiraAccessToken;

      const resourcesResponse: AxiosResponse<any> = await lastValueFrom(
        this.httpService.get(
          'https://api.atlassian.com/oauth/token/accessible-resources',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          },
        ),
      );

      // 2.1) Log raw do array de recursos (para confirmar que veio o JSON certo)
      this.logger.debug(
        'Resposta completa de accessible-resources:',
        JSON.stringify(resourcesResponse.data),
      );

      const resources = resourcesResponse.data as any[];
      if (!resources || resources.length === 0) {
        throw new Error('Nenhum recurso acessível retornado pelo Jira.');
      }

      const cloudId = resources[0].id;
      session.jiraCloudId = cloudId;
      this.logger.debug(`cloudId armazenado na sessão: ${cloudId}`);
    } catch (err) {
      const errData = (err as any).response?.data || (err as any).message;
      this.logger.error('Falha ao buscar accessible-resources:', errData);
      throw new BadRequestException(
        'Falha na requisição de accessible-resources: ' + errData,
      );
    }
  }

  /**
   * Opcional: Atualiza o access_token usando o refresh_token guardado na sessão.
   *
   * Fluxo:
   *   POST https://auth.atlassian.com/oauth/token
   *   Body JSON:
   *     {
   *       grant_type:    'refresh_token',
   *       client_id:     process.env.JIRA_CLIENT_ID,
   *       client_secret: process.env.JIRA_CLIENT_SECRET,
   *       refresh_token: session.jiraRefreshToken
   *     }
   *  → Retorna { access_token, refresh_token, ... }
   *  Substitui os valores na sessão.
   *
   * Em produção, você guardaria refreshToken em banco e não em sessão.
   */
  async refreshAccessToken(session: Record<string, any>): Promise<void> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const oldRefresh = session.jiraRefreshToken;

    if (!clientId || !clientSecret || !oldRefresh) {
      throw new BadRequestException(
        'JIRA_CLIENT_ID, JIRA_CLIENT_SECRET e JIRA_REFRESH_TOKEN precisam estar definidos no .env / sessão',
      );
    }

    try {
      const response: AxiosResponse<any> = await lastValueFrom(
        this.httpService.post(
          'https://auth.atlassian.com/oauth/token',
          {
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: oldRefresh,
          },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const newAccessToken = response.data?.access_token;
      const newRefreshToken = response.data?.refresh_token;

      if (!newAccessToken || !newRefreshToken) {
        throw new Error('Não retornou novos tokens no refresh.');
      }

      session.jiraAccessToken = newAccessToken;
      session.jiraRefreshToken = newRefreshToken;
      this.logger.debug('Tokens atualizados na sessão via refresh.');
    } catch (err) {
      const errorData = (err as any).response?.data || (err as any).message;
      this.logger.error('Erro ao tentar refresh do access_token:', errorData);
      throw new BadRequestException('Falha no refresh token: ' + errorData);
    }
  }
}
