import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateEnvelopeDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsIn(['savings', 'investment'])
  purpose?: 'savings' | 'investment';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetAmount?: number;

  @IsOptional()
  @IsDateString()
  targetDeadline?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyContributionTarget?: number;
}
