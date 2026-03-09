import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @IsBoolean()
  @IsOptional()
  isOfficial?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
