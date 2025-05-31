// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JiraAuthController } from 'src/adapters/auth/jira-auth.controller';
import { OauthCallbackController } from 'src/adapters/auth/oauth-callback.controller';
import { AuthService } from 'src/application/services/auth/auth.service';

@Module({
  // Precisamos do HttpModule para que o Nest injete HttpService no AuthService
  imports: [HttpModule],
  controllers: [
    JiraAuthController, // mapeia  GET /jira/auth/install
    OauthCallbackController, // mapeia  GET /oauth/callback
  ],
  providers: [AuthService],
})
export class AuthModule {}
