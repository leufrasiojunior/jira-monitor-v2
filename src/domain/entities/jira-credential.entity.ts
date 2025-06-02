// src/domain/entities/jira-credential.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidade que mapeia a tabela jira_credentials no SQLite.
 * Armazena tokens do OAuth 2.0 (3LO) do Jira para um determinado usuário (ou contexto).
 */
@Entity({ name: 'jira_credentials' })
export class JiraCredentialEntity {
  /**
   * Chave primária autogerada em formato UUID.
   * Garante unicidade e facilita referenciar credenciais em outros lugares (se necessário).
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador do “usuário” (ou instalação) a quem pertencem estas credenciais.
   * Caso seu sistema use login, aqui você armazenaria o userId (ex.: ID interno do seu sistema).
   * Se não houver múltiplos usuários, basta usar um valor fixo como "default".
   */
  @Column({ type: 'varchar', length: 128 })
  @Index() // Índice para busca rápida por userId
  userId: string;

  /**
   * O cloudId retornado por GET https://api.atlassian.com/oauth/token/accessible-resources.
   * É necessário incluir este valor em todas as chamadas posteriores à API do Jira Cloud.
   */
  @Column({ type: 'varchar', length: 64 })
  cloudId: string;

  /**
   * Token de acesso (“Bearer”) atual para chamar a API do Jira.
   * Possui validade limitada (veja expiresAt).
   */
  @Column({ type: 'text' })
  accessToken: string;

  /**
   * Token de refresh usado para renovar o accessToken quando este expirar.
   * Também armazenado como texto, pois normalmente vem em formato codificado.
   */
  @Column({ type: 'text' })
  refreshToken: string;

  /**
   * Data e hora em que o accessToken expira.
   * Calculamos assim: agora + expires_in (retornado pelo Jira em segundos).
   * Usamos “timestamp with time zone” (ou apenas “timestamp” no SQLite) para manter consistência.
   */
  @Column({ type: 'datetime' })
  expiresAt: Date;

  /**
   * Data de criação do registro no banco (gerada automaticamente pelo TypeORM).
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Data da última vez em que o registro foi atualizado (gerada automaticamente).
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
