import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum DocumentType {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
}

export enum LinkPermission {
  CLOSE = 'close',
  VIEW = 'view',
  EDIT = 'edit',
}

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  title: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  isStarred?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateDocumentContentDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class CreateDocumentVersionDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  title: string;

  /** 版本说明（快照描述） */
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;

  /** 可选：base64(encodeStateAsUpdate)，与协同 y_state 一致 */
  @IsString()
  @IsOptional()
  yStateBase64?: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
