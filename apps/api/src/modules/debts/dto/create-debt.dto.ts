import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDebtDto {
  @IsEnum(['i_owe', 'they_owe_me'])
  direction!: 'i_owe' | 'they_owe_me';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  counterparty!: string;

  @IsInt()
  @IsPositive()
  principal!: number;

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
