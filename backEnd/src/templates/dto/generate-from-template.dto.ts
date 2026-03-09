import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateFromTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(512)
  title?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  ownerId: string;
}
