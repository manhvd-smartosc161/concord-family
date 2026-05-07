import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  fundId?: string;

  /** Signed integer VND. Negative = expense, positive = income. */
  @IsOptional()
  @IsInt()
  amount?: number;

  /** Pass `null` explicitly to remove the category. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  note?: string | null;
}
