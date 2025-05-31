// src/modules/auth/oauth-callback.controller.ts

import {
  Controller,
  Get,
  Query,
  Session,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from 'src/application/services/auth/auth.service';

@Controller('oauth')
export class OauthCallbackController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Rota: GET /oauth/callback
   *
   * 1) Recebe ?code=…&state=… na query string.
   * 2) Compara se o state recebido bate com session.jiraOAuthState.
   * 3) Se bater, chama authService.handleCallback(code, session) para:
   *    - Trocar code por access_token + refresh_token.
   *    - Obter cloudId (via accessible-resources).
   *    - Armazenar tudo na sessão (session.jiraAccessToken, session.jiraRefreshToken, session.jiraCloudId).
   * 4) Exclui session.jiraOAuthState (não precisamos mais).
   * 5) Retorna um JSON com mensagem de sucesso e os tokens/cloudId (apenas para teste inicial).
   *
   * 👉 Em produção, normalmente você **não** envia esses tokens ao cliente. Armazene-os em banco.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') returnedState: string,
    @Session() session: Record<string, any>,
  ) {
    // 1) Valida se o state bate
    if (!returnedState || returnedState !== session.jiraOAuthState) {
      throw new BadRequestException('State inválido ou ausente.');
    }

    // 2) Chama o serviço para trocar code por tokens e obter cloudId
    await this.authService.handleCallback(code, session);

    // 3) Remove o state da sessão (já foi usado)
    delete session.jiraOAuthState;

    // 4) Retorna JSON com tokens e cloudId (para teste)
    return {
      message: 'Autorização concluída com sucesso!',
      accessToken: session.jiraAccessToken,
      refreshToken: session.jiraRefreshToken,
      cloudId: session.jiraCloudId,
    };
  }
}
