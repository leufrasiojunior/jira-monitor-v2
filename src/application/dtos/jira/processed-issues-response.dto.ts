// src/application/dtos/jira/processed-issues-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IssueSummaryDto } from './issue-summary.dto';

/**
 * DTO que descreve a resposta do ProcessIssuesUseCase,
 * contendo o total de issues após filtro, a lista resumida e
 * um objeto com contagem por status.
 */
export class ProcessedIssuesResponseDto {
  @ApiProperty({
    example: 5,
    description: 'Total de issues após filtrar os status indesejados.',
  })
  total: number;

  @ApiProperty({
    type: [IssueSummaryDto],
    description: 'Lista de issues após processamento e filtro.',
  })
  issues: IssueSummaryDto[];

  @ApiProperty({
    example: { 'In Progress': 2, 'To Do': 3 },
    description: 'Objeto contendo a contagem de issues por status.',
  })
  statusCounts: Record<string, number>;
}
