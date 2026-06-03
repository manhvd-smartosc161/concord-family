import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  fundName!: string;

  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}
