import { PartialType } from '@nestjs/mapped-types';
import { CreateImportantDateDto } from './create-important-date.dto';

export class UpdateImportantDateDto extends PartialType(
  CreateImportantDateDto,
) {}
