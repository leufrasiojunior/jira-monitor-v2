// src/adapters/controllers/auth/jira-auth.controller.ts

import { Controller, Get, Req, Res, Logger } from '@nestjs/common'; // ▶️ import Logger
import { Request, Response } from 'express';

import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '@app/services/auth/auth.service';

@ApiTags('Auth')
@Controller('jira/auth')
export class JiraAuthController {
  private readonly logger = new Logger(JiraAuthController.name); // ▶️ instância de Logger

  constructor(private readonly authService: AuthService) {}

  /**
   * GET /jira/auth/install
   * Redireciona o usuário ao Jira para iniciar o fluxo OAuth 3LO.
   */
  @ApiOperation({
    summary: 'Inicia o fluxo OAuth 2.0 (3LO) do Jira',
    description:
      'Gera um state para proteção CSRF, define userId na sessão e redireciona o navegador para a URL de autorização do Jira.',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redireciona o navegador para o Jira para autenticação/consentimento.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Erro interno (por exemplo, falha ao montar a URL de autorização).',
  })
  @Get('install')
  async install(@Req() req: Request, @Res() res: Response) {
    this.logger.log('Iniciando /jira/auth/install'); // ▶️ log de entrada

    // 1) Gera um state aleatório e armazena na sessão
    const state = Math.random().toString(36).substring(2);
    this.logger.debug(`State gerado: ${state}`); // ▶️ log do state

    // 2) Para evitar erro de tipagem, faremos cast de req.session para any:
    const session = req.session as any;

    // 3) Agora podemos definir as propriedades sem erro de TS
    session.jiraOAuthState = state;
    this.logger.debug(`State salvo na sessão: ${session.jiraOAuthState}`); // ▶️ log

    // 4) Garante que exista userId (dentro de session)
    if (!session.userId) {
      session.userId = 'default';
      this.logger.log('Nenhum userId na sessão; definindo como "default"'); // ▶️ log
    } else {
      this.logger.debug(`userId existente na sessão: ${session.userId}`); // ▶️ log
    }

    // 5) Constrói a URL de autorização e redireciona
    const authUrl = this.authService.buildAuthorizationUrl(state);
    this.logger.log(
      `Redirecionando para URL de autorização do Jira: ${authUrl}`,
    ); // ▶️ log
    return res.redirect(authUrl);
  }
}
