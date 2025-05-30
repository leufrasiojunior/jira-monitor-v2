// src/auth/auth.controller.ts
import { Controller, Get, Res, Session } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

/**
 * AuthController lida com o fluxo de autorização OAuth2 (3LO) do Jira.
 * Ele delega a geração do `state` e montagem da URL de autorização ao AuthService,
 * mantendo o controller enxuto e focado em rotas e respostas HTTP.
 */
@Controller('jira/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Inicia o fluxo de OAuth2 redirecionando para o endpoint de autorização.
   * GET /jira/auth/install
   */
  @Get('install')
  async install(@Res() res: Response, @Session() session: Record<string, any>) {
    // Gera e armazena o state via service
    const state = this.authService.createState(session);

    // Monta URL de autorização completa via service
    const authUrl = this.authService.buildAuthorizationUrl(state);

    // Redireciona para a URL de autorização do Atlassian
    res.redirect(authUrl);
  }
}
