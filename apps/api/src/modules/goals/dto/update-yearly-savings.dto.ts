import { IsInt, Min } from 'class-validator';

export class UpdateYearlySavingsDto {
  @IsInt()
  @Min(0)
  targetAmount!: number;
}
