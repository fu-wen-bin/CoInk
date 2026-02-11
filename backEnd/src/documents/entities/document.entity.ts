export enum DocumentType {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
}

export enum LinkPermission {
  CLOSE = 'close',
  VIEW = 'view',
  EDIT = 'edit',
}

// 文档元数据实体（对应 documents_info 表）
export class DocumentInfo {
  documentId: string;
  title: string;
  type: DocumentType;
  ownerId: string;
  parentId?: string;
  isStarred: boolean;
  sortOrder: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  shareToken: string;
  linkPermission: LinkPermission;
}

// 文档内容实体（对应 document_contents 表）
export class DocumentContent {
  documentId: string;
  content: Record<string, unknown>;
  updatedAt: Date;
  updatedBy?: string;
}

// 文档版本实体（对应 document_versions 表）
export class DocumentVersion {
  versionId: Date;
  documentId: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: Date;
  userId: string;
}
