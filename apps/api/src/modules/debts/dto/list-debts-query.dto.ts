import { IsEnum, IsOptional } from 'class-validator';

export class ListDebtsQueryDto {
  @IsEnum(['open', 'closed'])
  @IsOptional()
  status?: 'open' | 'closed';

  @IsEnum(['i_owe', 'they_owe_me'])
  @IsOptional()
  direction?: 'i_owe' | 'they_owe_me';

  @IsEnum(['private', 'shared'])
  @IsOptional()
  visibility?: 'private' | 'shared';
}
