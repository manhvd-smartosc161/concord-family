import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDebtDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  counterparty?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  principal?: number;

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';

  @IsString()
  @IsOptional()
  dueDate?: string | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}
