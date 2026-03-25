import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  document_principals_permission,
  document_principals_principal_type,
} from '../../../generated/prisma/client';

export class PermissionTargetDto {
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsEnum(document_principals_permission)
  permission: document_principals_permission;
}

export class BatchUpsertPermissionsDto {
  @IsString()
  @IsOptional()
  grantedBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionTargetDto)
  @IsOptional()
  userTargets?: PermissionTargetDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionTargetDto)
  @IsOptional()
  groupTargets?: PermissionTargetDto[];

  @IsBoolean()
  @IsOptional()
  sendNotification?: boolean;
}

export class BatchRemovePermissionsDto {
  @IsString()
  @IsOptional()
  grantedBy?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groupIds?: string[];
}

export class DocumentPrincipalItemDto {
  principalType: document_principals_principal_type;
  principalId: string;
  permission: document_principals_permission;
  name: string;
  avatarUrl?: string | null;
}

