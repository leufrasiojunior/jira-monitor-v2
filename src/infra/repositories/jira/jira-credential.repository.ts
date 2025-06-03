// src/infra/repositories/jira-credential.repository.ts

import { JiraCredentialEntity } from '@domain/entities/jira-credential.entity';
import { Injectable, Logger } from '@nestjs/common'; // ▶️ import Logger
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
  private readonly logger = new Logger(JiraCredentialRepository.name); // ▶️ instância de Logger

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
    this.logger.log(`upsertCredentials chamado para userId="${userId}"`); // ▶️ log de entrada

    // 1) Busca registro existente pelo userId.
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) {
      this.logger.log(
        `Credencial existente encontrada para userId="${userId}". Atualizando campos.`,
      ); // ▶️ log
      // 2a) Se já existe, atualiza apenas os campos relacionados a tokens e expiresAt.
      existing.cloudId = cloudId;
      existing.accessToken = accessToken;
      existing.refreshToken = refreshToken;
      existing.expiresAt = expiresAt;
      const saved = await this.repo.save(existing);
      this.logger.log(
        `Credenciais atualizadas no banco para userId="${userId}".`,
      ); // ▶️ log de sucesso
      return saved;
    }

    this.logger.log(
      `Nenhuma credencial existente para userId="${userId}". Criando nova.`,
    ); // ▶️ log
    // 2b) Se não existe, cria um novo registro com todos os dados.
    const newCred = this.repo.create({
      userId,
      cloudId,
      accessToken,
      refreshToken,
      expiresAt,
    });
    const savedNew = await this.repo.save(newCred);
    this.logger.log(`Nova credencial persistida para userId="${userId}".`); // ▶️ log de sucesso
    return savedNew;
  }

  /**
   * Busca credenciais existentes para um determinado userId.
   *
   * @param userId Identificador do usuário/instalação.
   * @returns A entidade JiraCredentialEntity ou null se não encontrada.
   */
  async findByUserId(userId: string): Promise<JiraCredentialEntity | null> {
    this.logger.log(`findByUserId chamado para userId="${userId}"`); // ▶️ log de entrada
    const result = await this.repo.findOne({ where: { userId } });
    if (result) {
      this.logger.log(`Credencial encontrada para userId="${userId}".`); // ▶️ log de sucesso
    } else {
      this.logger.warn(
        `Nenhuma credencial encontrada para userId="${userId}".`,
      ); // ▶️ log de aviso
    }
    return result;
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
    this.logger.log(`updateAccessToken chamado para userId="${userId}"`); // ▶️ log de entrada

    // Montamos um objeto parcial apenas com as colunas que mudam.
    const updateData: Partial<JiraCredentialEntity> = {
      accessToken: newAccessToken,
      expiresAt: newExpiresAt,
    };
    this.logger.debug(`Dados para update: ${JSON.stringify(updateData)}`); // ▶️ log debug

    // Se veio um novo refreshToken do Jira, atualizamos também.
    if (newRefreshToken) {
      updateData.refreshToken = newRefreshToken;
      this.logger.debug(
        `Novo refreshToken incluso no update para userId="${userId}"`,
      ); // ▶️ log debug
    }

    // Executa update WHERE userId = :userId
    const result = await this.repo.update({ userId }, updateData);
    this.logger.log(
      `updateAccessToken concluído para userId="${userId}". Affected: ${result.affected}`,
    ); // ▶️ log de sucesso
    return result;
  }

  /**
   * Remove credenciais associadas a um determinado userId.
   * Pode ser usado em um endpoint de logout ou revogação.
   *
   * @param userId Identificador do usuário/instalação.
   */
  async deleteByUserId(userId: string): Promise<void> {
    this.logger.log(`deleteByUserId chamado para userId="${userId}"`); // ▶️ log de entrada
    await this.repo.delete({ userId });
    this.logger.log(`Credenciais removidas para userId="${userId}".`); // ▶️ log de sucesso
  }
}
