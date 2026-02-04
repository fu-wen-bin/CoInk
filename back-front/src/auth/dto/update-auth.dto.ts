import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { RegisterDto } from './create-auth.dto';

// 更新用户认证信息 DTO
export class UpdateAuthDto extends PartialType(RegisterDto) {
  @IsString()
  @IsOptional()
  @MaxLength(512)
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  websiteUrl?: string;
}
