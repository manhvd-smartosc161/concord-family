import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsISO8601()
  weddingDate?: string;
}
