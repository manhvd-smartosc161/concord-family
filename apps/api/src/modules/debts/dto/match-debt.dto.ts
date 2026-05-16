import { IsOptional, IsString, MinLength } from 'class-validator';

export class MatchDebtDto {
  @IsString()
  @MinLength(1)
  counterparty!: string;

  @IsString()
  @IsOptional()
  direction?: 'i_owe' | 'they_owe_me';
}
