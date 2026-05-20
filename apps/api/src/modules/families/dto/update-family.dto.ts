import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateFamilyDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsISO8601()
  weddingDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  financialMonthCutoffDay?: number;
}
