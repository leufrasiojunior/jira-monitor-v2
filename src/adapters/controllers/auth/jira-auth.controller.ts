// src/adapters/controllers/auth/jira-auth.controller.ts

import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../../../application/services/auth/auth.service';

@Controller('jira/auth')
export class JiraAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Passo 7.1.2: GET /jira/auth/install
   *
   * 1) Gera um state aleatório e armazena em sessão (para proteção CSRF).
   * 2) Garante que `req.session.userId` exista. Se não houver login real, define "default".
   * 3) Monta a URL de autorização do Jira e redireciona o navegador para ela.
   */
  @Get('install')
  async install(@Req() req: Request, @Res() res: Response) {
    // 1) Gera um state (pode ser qualquer string aleatória; em produção, use crypto).
    const state = Math.random().toString(36).substring(2);
    // Armazena na sessão para depois validar no callback
    req.session.jiraOAuthState = state;

    // 2) Garante que exista um identificador de usuário na sessão.
    //    - Se sua aplicação tiver autenticação, substitua por req.user.id ou similar.
    //    - Caso não haja login, utilizamos "default" como única chave de credenciais.
    if (!req.session.userId) {
      req.session.userId = 'default';
    }

    // 3) Usa o AuthService para construir a URL de autorização,
    //    passando o 'state' para evitar CSRF.
    const authUrl = this.authService.buildAuthorizationUrl(state);

    // 4) Redireciona o cliente para o Jira. A partir daí, o usuário fará login/autorização.
    return res.redirect(authUrl);
  }
}
