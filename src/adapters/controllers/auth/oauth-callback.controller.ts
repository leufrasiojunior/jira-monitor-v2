// src/adapters/controllers/auth/oauth-callback.controller.ts

import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
  Logger, // ▶️ import Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

// 1) Importa decoradores do Swagger
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthService } from '@app/services/auth/auth.service';

@ApiTags('Auth') // 2) Agrupa este controller na seção “Auth”
@Controller('oauth')
export class OauthCallbackController {
  private readonly logger = new Logger(OauthCallbackController.name); // ▶️ instância de Logger

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
    this.logger.log('Iniciando /oauth/callback'); // ▶️ log de entrada
    this.logger.debug(
      `Parâmetros recebidos - code: ${code}, state: ${returnedState}`,
    ); // ▶️ log

    // 1) Validação do state para evitar CSRF
    const session = req.session as any;
    const originalState = session.jiraOAuthState;
    if (!returnedState || returnedState !== originalState) {
      this.logger.warn(
        `State inválido. Esperado: ${originalState}, recebido: ${returnedState}`,
      ); // ▶️ log
      throw new BadRequestException('State inválido ou ausente.');
    }
    this.logger.log('State validado com sucesso.'); // ▶️ log
    delete session.jiraOAuthState;

    // 2) Obtém userId da sessão (definido no JiraAuthController.install)
    const userId = session.userId;
    if (!userId) {
      this.logger.error('userId não encontrado na sessão.'); // ▶️ log
      throw new BadRequestException('userId não encontrado na sessão.');
    }
    this.logger.debug(`userId obtido da sessão: ${userId}`); // ▶️ log

    // 3) Chama o AuthService para trocar o code por tokens e persistir no banco
    try {
      this.logger.log(
        'Chamando AuthService.handleCallback para troca de tokens.',
      ); // ▶️ log
      const { cloudId, expiresIn } = await this.authService.handleCallback(
        code,
        session,
        userId,
      );
      this.logger.log(
        `Tokens trocados com sucesso. cloudId: ${cloudId}, expiresIn: ${expiresIn}`,
      ); // ▶️ log

      // 4) Retorna JSON com dados não sensíveis ao front-end
      return res.json({
        message: 'Autorização concluída com sucesso!',
        cloudId,
        expiresIn,
      });
    } catch (error) {
      this.logger.error(`Erro em AuthService.handleCallback: ${error.message}`); // ▶️ log
      throw error;
    }
  }
}
