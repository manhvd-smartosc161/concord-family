import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateImportantDateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(['birthday', 'death_anniversary', 'anniversary', 'other'])
  type!: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';

  @IsISO8601()
  date!: string;

  @IsBoolean()
  isLunar!: boolean;

  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(60, { each: true })
  remindDaysBefore!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
