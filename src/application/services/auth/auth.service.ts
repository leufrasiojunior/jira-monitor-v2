// src/application/services/auth/auth.service.ts

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { JiraCredentialRepository } from 'src/infra/repositories/jira/jira-credential.repository';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // em segundos
  token_type: string;
  scope: string;
}

interface AccessibleResource {
  id: string; // cloudId
  // outros campos retornados por accessible-resources (name, url, scopes) não usados aqui
}

@Injectable()
export class AuthService {
  // URLs fixas para os endpoints de OAuth do Jira
  private readonly jiraAuthBaseUrl = 'https://auth.atlassian.com/oauth/token';
  private readonly jiraAccessibleResourcesUrl =
    'https://api.atlassian.com/oauth/token/accessible-resources';

  constructor(
    private readonly httpService: HttpService,
    private readonly jiraCredentialRepo: JiraCredentialRepository, // repositório para persistir tokens
  ) {}

  /**
   * Constrói a URL de autorização do Jira (3LO).
   * Lê CLIENT_ID e REDIRECT_URI diretamente de process.env.
   *
   * @param state Valor aleatório para proteger contra CSRF.
   * @returns URL completa para redirecionamento ao Jira.
   */
  buildAuthorizationUrl(state: string): string {
    // 1) Lê valores do environment
    const clientId = process.env.JIRA_CLIENT_ID;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    // 2) Validações básicas: se faltar alguma variável, lança exceção
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'As variáveis de ambiente JIRA_CLIENT_ID e/ou JIRA_REDIRECT_URI não estão definidas.',
      );
    }

    // 3) Monta a query string com todos os parâmetros necessários:
    //    - audience: api.atlassian.com (obrigatório para OAuth Atlassian)
    //    - client_id: seu clientId cadastrado no Jira
    //    - scope: “read:jira-work offline_access” para leitura de issues e uso de refresh token
    //    - redirect_uri: para onde o Jira irá retornar o código
    //    - state: valor de proteção CSRF
    //    - response_type=code: indica que queremos o authorization code
    //    - prompt=consent: força exibir tela de consentimento, garantindo refresh_token
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: 'read:jira-work offline_access',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    // 4) Retorna a URL completa de autorização
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Recebe o authorization code do Jira e faz trocas de token.
   * Em seguida obtém o cloudId e persiste tudo no banco (SQLite) através do Repositório.
   *
   * @param code    Código de autorização retornado pelo Jira.
   * @param session Sessão do usuário (para gravar tokens temporários, se necessário).
   * @param userId  Identificador do usuário/instalação (pode ser "default").
   *
   * @returns Dados básicos: accessToken, refreshToken, cloudId e expiresIn (em segundos).
   */
  async handleCallback(
    code: string,
    session: Record<string, any>,
    userId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    cloudId: string;
    expiresIn: number;
  }> {
    // 1) Obter diretamente do env as variáveis obrigatórias para trocar o code por token
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    // 2) Verificar se todas as variáveis existem, senão erro
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'As variáveis JIRA_CLIENT_ID, JIRA_CLIENT_SECRET e/ou JIRA_REDIRECT_URI não estão definidas.',
      );
    }

    // 3) Montar payload para a requisição de troca de authorization code por tokens
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    };

    // 4) Fazer POST no endpoint https://auth.atlassian.com/oauth/token
    let tokenResponse: AxiosResponse<TokenResponse>;
    try {
      tokenResponse = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          this.jiraAuthBaseUrl,
          tokenPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );
    } catch (error) {
      // Caso a requisição falhe (rede, 4xx/5xx, etc.), lança erro interno
      throw new InternalServerErrorException(
        `Falha na requisição ao endpoint de token do Jira: ${error.message}`,
      );
    }

    const tokenData = tokenResponse.data;
    // 5) Validar resposta: deve conter access_token e refresh_token
    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new BadRequestException(
        `Não retornou access_token ou refresh_token. Body recebido: ${JSON.stringify(
          tokenData,
        )}`,
      );
    }

    // 6) Agora, usando o access_token, buscar o cloudId
    let resourcesResponse: AxiosResponse<AccessibleResource[]>;
    try {
      resourcesResponse = await firstValueFrom(
        this.httpService.get<AccessibleResource[]>(
          this.jiraAccessibleResourcesUrl,
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: 'application/json',
            },
          },
        ),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Falha ao buscar accessible-resources no Jira: ${error.message}`,
      );
    }

    const resources = resourcesResponse.data;
    if (!resources || resources.length === 0) {
      throw new BadRequestException(
        'Nenhum recurso acessível retornado pelo Jira. Verifique suas permissões.',
      );
    }
    const cloudId = resources[0].id;

    // 7) Calcular a data de expiração do accessToken (expires_in está em segundos)
    const expiresIn = tokenData.expires_in; // ex.: 3600 = 1h
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 8) Persistir no SQLite usando o JiraCredentialRepository
    await this.jiraCredentialRepo.upsertCredentials({
      userId,
      cloudId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
    });

    // 9) (Opcional) Atualizar a sessão para uso imediato nesta requisição
    session.jiraAccessToken = tokenData.access_token;
    session.jiraRefreshToken = tokenData.refresh_token;
    session.jiraCloudId = cloudId;
    session.jiraExpiresAt = expiresAt;

    // 10) Retornar apenas o mínimo necessário (não exponha tokens ao front em produção)
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      cloudId,
      expiresIn,
    };
  }

  /**
   * Renova o accessToken usando o refreshToken já armazenado no banco.
   *
   * @param userId  Identificador do usuário/instalação.
   * @param session (Opcional) Sessão do usuário, caso queira atualizar também.
   *
   * @returns Novo accessToken, novo refreshToken e expiresIn (em segundos).
   */
  async refreshAccessToken(
    userId: string,
    session?: Record<string, any>,
  ): Promise<{
    newAccessToken: string;
    newRefreshToken: string;
    newExpiresIn: number;
  }> {
    // 1) Buscar credencial existente no banco
    const existingCred = await this.jiraCredentialRepo.findByUserId(userId);
    if (!existingCred) {
      throw new BadRequestException(
        'Nenhuma credencial encontrada para este usuário. Talvez o fluxo de OAuth não tenha sido concluído.',
      );
    }

    // 2) Lê clientId e clientSecret diretamente de process.env
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'As variáveis JIRA_CLIENT_ID e/ou JIRA_CLIENT_SECRET não estão definidas.',
      );
    }

    // 3) Monta payload para refresh token grant
    const payload = {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: existingCred.refreshToken,
    };

    // 4) Faz POST para renovar
    let tokenResp: AxiosResponse<TokenResponse>;
    try {
      tokenResp = await firstValueFrom(
        this.httpService.post<TokenResponse>(this.jiraAuthBaseUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Falha ao renovar token: ${error.message}`,
      );
    }

    const newData = tokenResp.data;
    // 5) Validar presença de access_token e refresh_token
    if (!newData.access_token || !newData.refresh_token) {
      throw new BadRequestException(
        `Resposta de refresh sem access_token/refresh_token. Body: ${JSON.stringify(
          newData,
        )}`,
      );
    }

    // 6) Calcular nova data de expiração
    const newExpiresIn = newData.expires_in;
    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);

    // 7) Atualizar somente os campos necessários no banco
    await this.jiraCredentialRepo.updateAccessToken({
      userId,
      newAccessToken: newData.access_token,
      newExpiresAt,
      newRefreshToken: newData.refresh_token,
    });

    // 8) (Opcional) Atualizar a sessão se enviada como parâmetro
    if (session) {
      session.jiraAccessToken = newData.access_token;
      session.jiraRefreshToken = newData.refresh_token;
      session.jiraExpiresAt = newExpiresAt;
    }

    return {
      newAccessToken: newData.access_token,
      newRefreshToken: newData.refresh_token,
      newExpiresIn,
    };
  }
}
