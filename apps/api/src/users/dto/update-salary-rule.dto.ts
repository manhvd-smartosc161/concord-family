import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSalaryRuleDto {
  @IsInt()
  @Min(0)
  @Max(100)
  pctToPersonal!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  pctToJoint!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedAmountToJoint?: number | null;
}
