// src/application/dtos/jira/issue-summary.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO que descreve a estrutura de cada issue resumida,
 * conforme o ProcessIssuesUseCase retorna.
 */
export class IssueSummaryDto {
  @ApiProperty({
    example: 'OMNIJS-123',
    description: 'Chave única da issue no Jira',
  })
  key: string;

  @ApiProperty({
    example: 'Implementar fluxo OAuth',
    description: 'Sumário (título) da issue',
  })
  summary: string;

  @ApiProperty({
    example: 'In Progress',
    description: 'Status atual da issue',
  })
  status: string;

  @ApiProperty({
    example: '2025-05-20T14:30:00.000Z',
    description: 'Data de criação da issue (formato ISO 8601)',
  })
  created: string;

  @ApiProperty({
    example: 'João Silva',
    description: 'Nome do usuário a quem a issue está atribuída (assignee).',
    nullable: true,
  })
  assignee: string | null;

  @ApiProperty({
    example: 'Ana Souza',
    description: 'Nome do usuário que reportou a issue (reporter).',
    nullable: true,
  })
  reporter: string | null;

  @ApiProperty({
    example: 'High',
    description: 'Prioridade da issue (se definida).',
    nullable: true,
  })
  priority: string | null;

  @ApiProperty({
    example: 3,
    description: 'Quantidade de dias que a issue está em aberto',
  })
  timeOpenDays: number;
}
