// src/adapters/controllers/auth/oauth-callback.controller.ts

import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../../../application/services/auth/auth.service';

@Controller('oauth')
export class OauthCallbackController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Passo 7.2: GET /oauth/callback?code=...&state=...
   *
   * 1) Valida se o state retornado bate com o que está em sessão.
   * 2) Lê o userId de req.session (está definido como "default" no install).
   * 3) Chama handleCallback(code, session, userId) no AuthService.
   * 4) Retorna resposta ao cliente (sem expor tokens em produção).
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') returnedState: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 1) Validação do state para evitar CSRF
    const session = req.session as any;
    const originalState = session.jiraOAuthState;
    if (!returnedState || returnedState !== originalState) {
      throw new BadRequestException('State inválido ou ausente.');
    }
    // Remover state da sessão após uso
    delete session.jiraOAuthState;

    // 2) Obter userId da sessão (definido no JiraAuthController.install como "default" ou valor real)
    const userId = session.userId;
    if (!userId) {
      // Em caso raro de não existir, lançamos erro para evitar chamada sem userId
      throw new BadRequestException('userId não encontrado na sessão.');
    }

    // 3) Chamar handleCallback fornecendo code, session e userId
    const { accessToken, refreshToken, cloudId, expiresIn } =
      await this.authService.handleCallback(code, session, userId);

    // 4) Retornar informações mínimas ao cliente
    return res.json({
      message: 'Autorização concluída com sucesso!',
      cloudId,
      expiresIn,
    });
  }
}
