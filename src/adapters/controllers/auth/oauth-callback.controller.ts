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

// 1) Importa decoradores do Swagger
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthService } from '@app/services/auth/auth.service';

@ApiTags('Auth') // 2) Agrupa este controller na seção “Auth”
@Controller('oauth')
export class OauthCallbackController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET /oauth/callback?code=...&state=...
   * Recebe o código de autorização do Jira e troca por tokens, salvando no banco.
   */
  @ApiOperation({
    summary: 'Callback do OAuth 2.0 (Jira)',
    description:
      'Recebe query params `code` e `state` do Jira, valida o state contra a sessão e troca o código por tokens. Persiste os tokens no banco.',
  })
  // 3) Documenta os query params esperados
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Código de autorização retornado pelo Jira',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State enviado anteriormente para prevenção de CSRF',
  })
  @ApiResponse({
    status: 200,
    description:
      'Autorização concluída com sucesso; retorna cloudId e expiresIn.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Parâmetros ausentes ou inválidos (ex.: state não confere, code ausente).',
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno durante a troca de tokens ou persistência.',
  })
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
    delete session.jiraOAuthState;

    // 2) Obtém userId da sessão (definido no JiraAuthController.install)
    const userId = session.userId;
    if (!userId) {
      throw new BadRequestException('userId não encontrado na sessão.');
    }

    // 3) Chama o AuthService para trocar o code por tokens e persistir no banco
    const { cloudId, expiresIn } = await this.authService.handleCallback(
      code,
      session,
      userId,
    );

    // 4) Retorna JSON com dados não sensíveis ao front-end
    return res.json({
      message: 'Autorização concluída com sucesso!',
      cloudId,
      expiresIn,
    });
  }
}
