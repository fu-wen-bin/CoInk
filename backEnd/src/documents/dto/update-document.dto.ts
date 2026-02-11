import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { CreateDocumentContentDto, CreateDocumentDto, LinkPermission } from './create-document.dto';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shareToken?: string;

  @IsEnum(LinkPermission)
  @IsOptional()
  linkPermission?: LinkPermission;

  @IsOptional()
  isDeleted?: boolean;
}

export class UpdateDocumentContentDto extends PartialType(CreateDocumentContentDto) {}
