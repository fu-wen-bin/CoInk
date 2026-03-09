import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  category: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(512)
  thumbnailUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsNotEmpty()
  creatorId: string;
}
