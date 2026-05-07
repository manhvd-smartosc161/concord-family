import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateEnvelopeDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetAmount?: number | null;

  @IsOptional()
  @IsDateString()
  targetDeadline?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyContributionTarget?: number | null;
}
