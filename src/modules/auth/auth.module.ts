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
