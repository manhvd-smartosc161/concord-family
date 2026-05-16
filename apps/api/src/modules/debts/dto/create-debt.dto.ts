import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDebtDto {
  @IsIn(['lent', 'borrowed'])
  direction!: 'lent' | 'borrowed';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  counterpartyName!: string;

  @IsInt()
  @Min(1)
  principal!: number;

  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsISO8601()
  openedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
