// src/modules/auth/jira-auth.controller.ts

import { Controller, Get, Res, Session } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from 'src/application/services/auth/auth.service';

@Controller('jira/auth')
export class JiraAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Rota: GET /jira/auth/install
   *
   * 1) Gera um state único (anti-CSRF) e armazena na sessão.
   * 2) Monta a URL de autorização do Jira Cloud.
   * 3) Redireciona o navegador para essa URL, para que o usuário
   *    entre com sua conta Atlassian e conceda acesso ao app.
   */
  @Get('install')
  install(@Res() res: Response, @Session() session: Record<string, any>) {
    // 1) Gera state
    const state = this.authService.createState(session);

    // 2) Monta a URL de autorização (inclui client_id, redirect_uri, state, etc)
    const authUrl = this.authService.buildAuthorizationUrl(state);

    // 3) Redireciona o navegador do usuário para o Jira Cloud
    return res.redirect(authUrl);
  }
}
