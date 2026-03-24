import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { permission_requests_target_permission } from '../../../generated/prisma/client';

export class CreatePermissionRequestDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  applicantId: string;

  @IsEnum(permission_requests_target_permission)
  targetPermission: permission_requests_target_permission;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  message?: string;
}

