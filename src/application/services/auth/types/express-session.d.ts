// src/types/express-session.d.ts

import 'express-session';

/**
 * Aqui estendemos a interface SessionData (de express-session)
 * para conter exatamente as propriedades que usaremos (por ex. userId, jiraOAuthState etc).
 * Você pode adicionar outros campos conforme necessidade.
 */
declare module 'express-session' {
  interface SessionData {
    userId: string;
    jiraOAuthState: string;
    jiraAccessToken?: string;
    jiraRefreshToken?: string;
    jiraCloudId?: string;
    jiraExpiresAt?: Date;
    // adicione outros campos de sessão que seu app use, se houver
  }
}

import 'express';
import { SessionData } from 'express-session';

/**
 * Também vamos estender a interface Request do Express para que o campo
 * `session: Session & Partial<SessionData>` seja reconhecido.
 */
declare module 'express' {
  interface Request {
    session: SessionData;
  }
}
