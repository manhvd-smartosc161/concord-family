import { IsInt, Min } from 'class-validator';

export class SetOpeningBalanceDto {
  @IsInt()
  @Min(0)
  amount!: number;
}
