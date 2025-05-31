// src/app.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from './modules/auth/auth.module';
// Se desejar, mais tarde você adicionará:
// import { JiraIssuesModule } from './modules/jira-issues/jira-issues.module';

@Module({
  imports: [
    HttpModule, // disponibiliza HttpService globalmente (pode ser também importado nos módulos específicos)
    AuthModule, // registra JiraAuthController e OauthCallbackController
    // JiraIssuesModule,  // até agora vazio; será usado depois
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
