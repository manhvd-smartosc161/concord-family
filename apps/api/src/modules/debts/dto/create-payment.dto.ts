import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsISO8601()
  paidAt!: string;

  @IsUUID()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
