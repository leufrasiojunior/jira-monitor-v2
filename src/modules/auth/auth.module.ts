// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios'; // <-- importa o HttpModule aqui
import { JiraCredentialEntity } from '@domain/entities/jira-credential.entity';
import { JiraAuthController } from '@adapters/controllers/auth/jira-auth.controller';
import { OauthCallbackController } from '@adapters/controllers/auth/oauth-callback.controller';
import { AuthService } from '@app/services/auth/auth.service';
import { JiraCredentialRepository } from '@infra/repositories/jira/jira-credential.repository';

@Module({
  imports: [
    // 1) Garante que HttpService seja fornecido no contexto deste módulo
    HttpModule,

    // 2) Registra a entidade para que o Repository<JiraCredentialEntity> exista
    TypeOrmModule.forFeature([JiraCredentialEntity]),
  ],
  controllers: [JiraAuthController, OauthCallbackController],
  providers: [AuthService, JiraCredentialRepository],
  exports: [AuthService, JiraCredentialRepository],
})
export class AuthModule {}

//TODO
// ADICIONAR O ENVIO DOS DADOS VIA WHATSAPP PELO EEVOLUTION API

// Ajustar níveis de log (em produção, talvez use logger.error e logger.warn, e silencie debug/verbose configurando o LOG_LEVEL ou a flag adequada no Nest).

// Validação de Entrada
// Use class-validator e class-transformer nos DTOs de query params/body. Por exemplo, no controller de fetch, valide que jql (se existir) seja uma string não vazia. Isso dá respostas 400 mais claras antes de chegar ao serviço.
// Tratamento de Erros Mais Granular
// Atualmente você lança InternalServerErrorException genérico. Considere:
// Lançar BadRequestException quando o JQL for sintaticamente inválido ou ausente.
// Se o Jira retornar 401/403 (token inválido), converter isso numa resposta 401 ao cliente, forçando re-autenticação.
// Se o Jira retornar 429 (rate limit), faça um backoff exponecial ou exponha um endpoint /jira/monitor/health indicando “temporariamente indisponível, tente mais tarde”.

// Variáveis de Ambiente e Configurações Dinâmicas
// Em vez de chamar process.env diretamente dentro dos serviços, considere centralizar
//  as configurações num ConfigService (mesmo sem usar o módulo oficial do Nest). Por exemplo,
//   crie uma classe EnvConfigService que lê process.env e faz parse (converte PORT em número, define valores padrão, valida valores obrigatórios etc.).
//   Assim, se precisar trocar fonte de configuração (por ex., usar Vault ou Kubernetes Secrets), troca apenas esse serviço.

// Auditoria e Histórico
// Se quiser gravar histórico de quando o usuário autenticou ou quando houve falha, crie uma tabela simples (por ex., auth_logs) e, no AuthService, ao gravar credenciais, registre um log em banco com timestamp, userId e ação (sucesso/falha).
// Isso ajuda a auditar acessos em produção.

// Retirada de Código Morto e Refatoração
// Revise se há trechos duplicados ou comentários obsoletos (por ex., linhas duplicadas em jira-auth.controller.ts que definem session.userId duas vezes).
// Remova código comentado que não será usado, garantindo que o repositório fique limpo.
