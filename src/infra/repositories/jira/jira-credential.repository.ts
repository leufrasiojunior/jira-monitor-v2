// src/infra/repositories/jira-credential.repository.ts

import { JiraCredentialEntity } from '@domain/entities/jira-credential.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, UpdateResult } from 'typeorm';

/**
 * Repositório responsável por todas as operações de CRUD
 * na tabela jira_credentials (SQLite). Aqui concentramos:
 *   - criação ou atualização de credenciais (upsert)
 *   - busca de credenciais por userId
 *   - atualização parcial de tokens (accessToken ou refreshToken)
 *   - remoção de credenciais
 */
@Injectable()
export class JiraCredentialRepository {
  constructor(
    // Injetamos o repositório TypeORM para a entidade JiraCredentialEntity.
    @InjectRepository(JiraCredentialEntity)
    private readonly repo: Repository<JiraCredentialEntity>,
  ) {}

  /**
   * Cria um novo registro de credenciais ou atualiza o existente para um dado userId.
   *
   * @param params.userId       Identificador do usuário/instalação (pode ser "default" se
   *                            seu sistema não tiver múltiplos usuários).
   * @param params.cloudId      O cloudId retornado pelo Jira (accessible-resources[0].id).
   * @param params.accessToken  O accessToken (Bearer) atual para chamar APIs do Jira.
   * @param params.refreshToken O refreshToken para renovar o accessToken quando expirar.
   * @param params.expiresAt    Data/hora em que o current accessToken expira.
   *
   * @returns A entidade salva (com campos atualizados, inclusive timestamps).
   */
  async upsertCredentials(params: {
    userId: string;
    cloudId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<JiraCredentialEntity> {
    const { userId, cloudId, accessToken, refreshToken, expiresAt } = params;

    // 1) Busca registro existente pelo userId.
    const existing = await this.repo.findOne({ where: { userId } });

    if (existing) {
      // 2a) Se já existe, atualiza apenas os campos relacionados a tokens e expiresAt.
      existing.cloudId = cloudId;
      existing.accessToken = accessToken;
      existing.refreshToken = refreshToken;
      existing.expiresAt = expiresAt;
      // Ao chamar save(existing), o TypeORM vai atualizar o registro e setar updatedAt.
      return await this.repo.save(existing);
    }

    // 2b) Se não existe, cria um novo registro com todos os dados.
    const newCred = this.repo.create({
      userId,
      cloudId,
      accessToken,
      refreshToken,
      expiresAt,
    });
    return await this.repo.save(newCred);
  }

  /**
   * Busca credenciais existentes para um determinado userId.
   *
   * @param userId Identificador do usuário/instalação.
   * @returns A entidade JiraCredentialEntity ou undefined se não encontrada.
   */
  async findByUserId(userId: string): Promise<JiraCredentialEntity | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /**
   * Atualiza apenas o accessToken (e, opcionalmente, o refreshToken) para um dado userId.
   * Útil quando fazemos um refresh_token grant para obter tokens novos.
   *
   * @param params.userId          Identificador do usuário/instalação.
   * @param params.newAccessToken  Novo accessToken retornado pelo Jira.
   * @param params.newExpiresAt    Data/hora em que esse novo accessToken expira.
   * @param params.newRefreshToken (Opcional) Novo refreshToken, caso o Jira tenha retornado.
   *
   * @returns Resultado da operação de update.
   */
  async updateAccessToken(params: {
    userId: string;
    newAccessToken: string;
    newExpiresAt: Date;
    newRefreshToken?: string;
  }): Promise<UpdateResult> {
    const { userId, newAccessToken, newExpiresAt, newRefreshToken } = params;

    // Montamos um objeto parcial apenas com as colunas que mudam.
    const updateData: Partial<JiraCredentialEntity> = {
      accessToken: newAccessToken,
      expiresAt: newExpiresAt,
    };

    // Se veio um novo refreshToken do Jira, atualizamos também.
    if (newRefreshToken) {
      updateData.refreshToken = newRefreshToken;
    }

    // Executa update WHERE userId = :userId
    return this.repo.update({ userId }, updateData);
  }

  /**
   * Remove credenciais associadas a um determinado userId.
   * Pode ser usado em um endpoint de logout ou revogação.
   *
   * @param userId Identificador do usuário/instalação.
   */
  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
