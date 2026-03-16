import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { document_principals_permission, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDocumentContentDto,
  CreateDocumentDto,
  CreateDocumentVersionDto,
  DocumentType,
} from './dto/create-document.dto';
import { UpdateDocumentContentDto, UpdateDocumentDto } from './dto/update-document.dto';

// 权限等级映射
const PERMISSION_LEVELS: Record<document_principals_permission, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  manage: 4,
  full: 5,
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 文档元数据操作 ====================

  /**
   * 创建文档或文件夹
   */
  async create(createDocumentDto: CreateDocumentDto) {
    const documentId = nanoid();
    const shareToken = nanoid();

    // 如果有parentId，检查父文件夹是否存在
    if (createDocumentDto.parentId) {
      const parent = await this.prisma.documents_info.findUnique({
        where: { document_id: createDocumentDto.parentId },
      });
      if (!parent || parent.type !== 'FOLDER') {
        throw new BadRequestException('父文件夹不存在');
      }
    }

    // 创建文档元数据
    const doc = await this.prisma.documents_info.create({
      data: {
        document_id: documentId,
        title: createDocumentDto.title,
        type: createDocumentDto.type,
        owner_id: createDocumentDto.ownerId,
        parent_id: createDocumentDto.parentId || null,
        is_starred: createDocumentDto.isStarred || false,
        sort_order: createDocumentDto.sortOrder || 0,
        is_deleted: false,
        share_token: shareToken,
        link_permission: 'close',
      },
    });

    // 如果是文件，创建空内容
    if (createDocumentDto.type === DocumentType.FILE) {
      await this.prisma.document_contents.create({
        data: {
          document_id: documentId,
          content: {},
          updated_by: createDocumentDto.ownerId,
        },
      });
    }

    // 给所有者添加 full 权限
    await this.prisma.document_principals.create({
      data: {
        document_id: documentId,
        principal_type: 'user',
        principal_id: createDocumentDto.ownerId,
        permission: 'full',
        granted_by: createDocumentDto.ownerId,
      },
    });

    return {
      documentId: doc.document_id,
      title: doc.title,
      type: doc.type,
      ownerId: doc.owner_id,
      parentId: doc.parent_id,
      isStarred: doc.is_starred,
      sortOrder: doc.sort_order,
      shareToken: doc.share_token,
      linkPermission: doc.link_permission,
      createdAt: doc.created_at,
    };
  }

  /**
   * 获取用户的所有文档（不包含已删除的）
   */
  async findAll(ownerId: string) {
    const docs = await this.prisma.documents_info.findMany({
      where: {
        owner_id: ownerId,
        is_deleted: false,
      },
      orderBy: [{ is_starred: 'desc' }, { sort_order: 'asc' }, { updated_at: 'desc' }],
    });

    return docs.map((doc) => this.mapDocumentInfo(doc));
  }

  /**
   * 获取单个文档详情
   */
  async findOne(documentId: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return this.mapDocumentInfo(doc);
  }

  /**
   * 按父目录获取文档
   */
  async findByParent(parentId: string | null, ownerId: string) {
    const docs = await this.prisma.documents_info.findMany({
      where: {
        owner_id: ownerId,
        parent_id: parentId || null,
        is_deleted: false,
      },
      orderBy: [
        { type: 'desc' }, // FOLDER 在前
        { sort_order: 'asc' },
        { updated_at: 'desc' },
      ],
    });

    return docs.map((doc) => this.mapDocumentInfo(doc));
  }

  /**
   * 获取星标文档
   */
  async findStarred(ownerId: string) {
    const docs = await this.prisma.documents_info.findMany({
      where: {
        owner_id: ownerId,
        is_starred: true,
        is_deleted: false,
      },
      orderBy: [{ sort_order: 'asc' }, { updated_at: 'desc' }],
    });

    return docs.map((doc) => this.mapDocumentInfo(doc));
  }

  /**
   * 获取回收站文档
   */
  async findDeleted(ownerId: string) {
    const docs = await this.prisma.documents_info.findMany({
      where: {
        owner_id: ownerId,
        is_deleted: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    return docs.map((doc) => this.mapDocumentInfo(doc));
  }

  /**
   * 通过分享token获取文档
   */
  async findByShareToken(shareToken: string, userId?: string) {
    const doc = await this.prisma.documents_info.findFirst({
      where: { share_token: shareToken },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.is_deleted) {
      throw new NotFoundException('文档已被删除');
    }

    // 检查分享权限
    if (doc.link_permission === 'close') {
      throw new ForbiddenException('分享链接已关闭');
    }

    // 检查用户是否有权限查看
    if (userId && userId !== doc.owner_id) {
      const hasAccess = await this.checkUserPermission(doc.document_id, userId, 'view');
      if (!hasAccess) {
        throw new ForbiddenException('没有权限访问此文档');
      }
    }

    return {
      ...this.mapDocumentInfo(doc),
      linkPermission: doc.link_permission,
    };
  }

  /**
   * 获取与我共享的文档列表
   */
  async findSharedWithMe(userId: string) {
    // 获取用户直接拥有的权限
    const principals = await this.prisma.document_principals.findMany({
      where: {
        principal_type: 'user',
        principal_id: userId,
      },
    });

    // 获取用户所在组的权限
    const userGroups = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });

    const groupPrincipals = await this.prisma.document_principals.findMany({
      where: {
        principal_type: 'group',
        principal_id: {
          in: userGroups.map((g) => g.group_id),
        },
      },
    });

    // 获取所有相关的文档ID
    const allDocIds = [...principals, ...groupPrincipals].map((p) => p.document_id);
    const uniqueDocIds = [...new Set(allDocIds)];

    // 批量查询文档信息
    const docs = await this.prisma.documents_info.findMany({
      where: {
        document_id: { in: uniqueDocIds },
        is_deleted: false,
        owner_id: { not: userId }, // 排除自己的文档
      },
    });

    // 构建权限映射
    const permissionMap = new Map<string, (typeof principals)[0]>();
    for (const p of [...principals, ...groupPrincipals]) {
      const existing = permissionMap.get(p.document_id);
      if (!existing || PERMISSION_LEVELS[p.permission] > PERMISSION_LEVELS[existing.permission]) {
        permissionMap.set(p.document_id, p);
      }
    }

    return docs.map((doc) => ({
      ...this.mapDocumentInfo(doc),
      myPermission: permissionMap.get(doc.document_id)?.permission,
    }));
  }

  /**
   * 更新文档元数据
   */
  async update(documentId: string, updateDocumentDto: UpdateDocumentDto) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const data: Prisma.documents_infoUpdateInput = {
      updated_at: new Date(),
    };

    if (updateDocumentDto.title !== undefined) {
      data.title = updateDocumentDto.title;
    }
    if (updateDocumentDto.parentId !== undefined) {
      data.parent_id = updateDocumentDto.parentId || null;
    }
    if (updateDocumentDto.isStarred !== undefined) {
      data.is_starred = updateDocumentDto.isStarred;
    }
    if (updateDocumentDto.sortOrder !== undefined) {
      data.sort_order = updateDocumentDto.sortOrder;
    }
    if (updateDocumentDto.linkPermission !== undefined) {
      data.link_permission = updateDocumentDto.linkPermission;
    }
    if (updateDocumentDto.isDeleted !== undefined) {
      data.is_deleted = updateDocumentDto.isDeleted;
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data,
    });

    return this.mapDocumentInfo(doc);
  }

  /**
   * 重命名文档
   */
  async rename(documentId: string, newTitle: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        title: newTitle,
        updated_at: new Date(),
      },
    });

    return this.mapDocumentInfo(doc);
  }

  /**
   * 移动文档到指定文件夹
   */
  async move(documentId: string, targetParentId: string | null, userId: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 检查权限
    if (doc.owner_id !== userId) {
      const hasPermission = await this.checkUserPermission(documentId, userId, 'edit');
      if (!hasPermission) {
        throw new ForbiddenException('没有权限移动此文档');
      }
    }

    // 检查目标文件夹
    if (targetParentId) {
      const target = await this.prisma.documents_info.findUnique({
        where: { document_id: targetParentId },
      });
      if (!target || target.type !== 'FOLDER') {
        throw new BadRequestException('目标文件夹不存在');
      }

      // 防止循环引用
      await this.checkCircularReference(documentId, targetParentId);

      // 检查目标文件夹权限
      if (target.owner_id !== userId) {
        const hasTargetPermission = await this.checkUserPermission(targetParentId, userId, 'edit');
        if (!hasTargetPermission) {
          throw new ForbiddenException('没有权限移动到目标文件夹');
        }
      }
    }

    const updated = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        parent_id: targetParentId || null,
        updated_at: new Date(),
      },
    });

    return this.mapDocumentInfo(updated);
  }

  /**
   * 星标/取消星标文档
   */
  async toggleStar(documentId: string, isStarred: boolean) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        is_starred: isStarred,
        updated_at: new Date(),
      },
    });

    return this.mapDocumentInfo(doc);
  }

  /**
   * 软删除文档（移动到回收站）
   */
  async softDelete(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    // 如果是文件夹，同时软删除所有子文档
    if (existing.type === 'FOLDER') {
      await this.softDeleteChildren(documentId);
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        is_deleted: true,
        updated_at: new Date(),
      },
    });

    return this.mapDocumentInfo(doc);
  }

  /**
   * 恢复回收站文档
   */
  async restore(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    // 如果是文件夹，同时恢复所有子文档
    if (existing.type === 'FOLDER') {
      await this.restoreChildren(documentId);
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        is_deleted: false,
        updated_at: new Date(),
      },
    });

    return this.mapDocumentInfo(doc);
  }

  /**
   * 永久删除文档
   */
  async remove(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    // 只有已软删除的文档才能永久删除
    if (!existing.is_deleted) {
      throw new BadRequestException('请先删除文档到回收站');
    }

    // 如果是文件夹，先删除所有子文档
    if (existing.type === 'FOLDER') {
      await this.removeChildren(documentId);
    }

    // 删除关联数据
    await this.prisma.$transaction([
      this.prisma.document_contents.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_versions.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_principals.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.documents_info.delete({
        where: { document_id: documentId },
      }),
    ]);

    return { success: true };
  }

  /**
   * 生成分享链接
   */
  async generateShareToken(documentId: string, permission: 'view' | 'edit') {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        link_permission: permission,
        updated_at: new Date(),
      },
    });

    return {
      shareToken: doc.share_token,
      linkPermission: doc.link_permission,
    };
  }

  /**
   * 关闭分享链接
   */
  async closeShare(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        link_permission: 'close',
        updated_at: new Date(),
      },
    });

    return {
      shareToken: doc.share_token,
      linkPermission: doc.link_permission,
    };
  }

  // ==================== 文档内容操作 ====================

  /**
   * 创建文档内容（初始化时使用）
   */
  async createContent(createContentDto: CreateDocumentContentDto) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: createContentDto.documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const content = await this.prisma.document_contents.create({
      data: {
        document_id: createContentDto.documentId,
        content: createContentDto.content as Prisma.InputJsonValue,
        updated_by: createContentDto.updatedBy,
      },
    });

    return {
      documentId: content.document_id,
      content: content.content,
      updatedAt: content.updated_at,
      updatedBy: content.updated_by,
    };
  }

  /**
   * 获取文档内容
   */
  async findContent(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const content = await this.prisma.document_contents.findUnique({
      where: { document_id: documentId },
    });

    if (!content) {
      throw new NotFoundException('文档内容不存在');
    }

    return {
      documentId: content.document_id,
      content: content.content,
      updatedAt: content.updated_at,
      updatedBy: content.updated_by,
    };
  }

  /**
   * 更新文档内容
   */
  async updateContent(documentId: string, updateContentDto: UpdateDocumentContentDto) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const content = await this.prisma.document_contents.update({
      where: { document_id: documentId },
      data: {
        content: updateContentDto.content as Prisma.InputJsonValue,
        updated_by: updateContentDto.updatedBy,
        updated_at: new Date(),
      },
    });

    return {
      documentId: content.document_id,
      content: content.content,
      updatedAt: content.updated_at,
      updatedBy: content.updated_by,
    };
  }

  // ==================== 文档版本操作 ====================

  /**
   * 创建文档版本（保存历史）
   */
  async createVersion(createVersionDto: CreateDocumentVersionDto) {
    // 获取当前内容
    const currentContent = await this.prisma.document_contents.findUnique({
      where: { document_id: createVersionDto.documentId },
    });

    if (!currentContent) {
      throw new NotFoundException('文档内容不存在');
    }

    // 创建版本记录
    const version = await this.prisma.document_versions.create({
      data: {
        document_id: createVersionDto.documentId,
        title: createVersionDto.title,
        content: createVersionDto.content as Prisma.InputJsonValue,
        user_id: createVersionDto.userId,
      },
    });

    return {
      versionId: version.version_id,
      documentId: version.document_id,
      title: version.title,
      createdAt: version.created_at,
      userId: version.user_id,
    };
  }

  /**
   * 获取文档所有版本
   */
  async findVersions(documentId: string) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing) {
      throw new NotFoundException('文档不存在');
    }

    const versions = await this.prisma.document_versions.findMany({
      where: { document_id: documentId },
      orderBy: { version_id: 'desc' },
      take: 50, // 限制返回最近50个版本
    });

    return versions.map((v) => ({
      versionId: v.version_id,
      documentId: v.document_id,
      title: v.title,
      createdAt: v.created_at,
      userId: v.user_id,
    }));
  }

  /**
   * 获取指定版本详情
   */
  async findVersion(versionId: Date) {
    const version = await this.prisma.document_versions.findUnique({
      where: { version_id: versionId },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return {
      versionId: version.version_id,
      documentId: version.document_id,
      title: version.title,
      content: version.content,
      createdAt: version.created_at,
      userId: version.user_id,
    };
  }

  /**
   * 恢复到指定版本
   */
  async restoreVersion(documentId: string, versionId: Date) {
    const version = await this.prisma.document_versions.findUnique({
      where: { version_id: versionId },
    });

    if (!version || version.document_id !== documentId) {
      throw new NotFoundException('版本不存在');
    }

    // 更新当前内容为版本内容
    const content = await this.prisma.document_contents.update({
      where: { document_id: documentId },
      data: {
        content: version.content as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });

    // 更新文档标题
    const doc = await this.prisma.documents_info.update({
      where: { document_id: documentId },
      data: {
        title: version.title,
        updated_at: new Date(),
      },
    });

    return {
      documentId: doc.document_id,
      title: doc.title,
      content: content.content,
      restoredFrom: versionId,
    };
  }

  // ==================== 权限操作 ====================

  /**
   * 获取用户对文档的权限
   */
  async getUserPermission(documentId: string, userId: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 所有者拥有 full 权限
    if (doc.owner_id === userId) {
      return { permission: 'full' as const, source: 'owner' };
    }

    // 检查直接权限
    const principal = await this.prisma.document_principals.findUnique({
      where: {
        document_id_principal_type_principal_id: {
          document_id: documentId,
          principal_type: 'user',
          principal_id: userId,
        },
      },
    });

    if (principal) {
      return { permission: principal.permission, source: 'direct' };
    }

    // 检查组权限
    const userGroups = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });

    if (userGroups.length > 0) {
      const groupPermissions = await this.prisma.document_principals.findMany({
        where: {
          document_id: documentId,
          principal_type: 'group',
          principal_id: {
            in: userGroups.map((g) => g.group_id),
          },
        },
      });

      if (groupPermissions.length > 0) {
        // 返回最高权限
        const highestPermission = groupPermissions.reduce((highest, current) => {
          return PERMISSION_LEVELS[current.permission] > PERMISSION_LEVELS[highest.permission]
            ? current
            : highest;
        });
        return { permission: highestPermission.permission, source: 'group' };
      }
    }

    // 检查分享链接权限
    if (doc.link_permission && doc.link_permission !== 'close') {
      return { permission: doc.link_permission, source: 'link' };
    }

    return { permission: null, source: null };
  }

  /**
   * 设置用户权限
   */
  async setUserPermission(
    documentId: string,
    targetUserId: string,
    permission: document_principals_permission,
    grantedBy: string,
  ) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 只有所有者或拥有 manage/full 权限的用户才能设置权限
    if (doc.owner_id !== grantedBy) {
      const hasPermission = await this.checkUserPermission(documentId, grantedBy, 'manage');
      if (!hasPermission) {
        throw new ForbiddenException('没有权限设置文档权限');
      }
    }

    // 不能给自己设置权限（所有者已经有 full 权限）
    if (targetUserId === doc.owner_id) {
      throw new BadRequestException('不能修改所有者的权限');
    }

    // 创建或更新权限
    await this.prisma.document_principals.upsert({
      where: {
        document_id_principal_type_principal_id: {
          document_id: documentId,
          principal_type: 'user',
          principal_id: targetUserId,
        },
      },
      update: {
        permission,
        granted_by: grantedBy,
        updated_at: new Date(),
      },
      create: {
        document_id: documentId,
        principal_type: 'user',
        principal_id: targetUserId,
        permission,
        granted_by: grantedBy,
      },
    });

    return { success: true, userId: targetUserId, permission };
  }

  /**
   * 移除用户权限
   */
  async removeUserPermission(documentId: string, targetUserId: string, grantedBy: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 检查权限
    if (doc.owner_id !== grantedBy) {
      const hasPermission = await this.checkUserPermission(documentId, grantedBy, 'manage');
      if (!hasPermission) {
        throw new ForbiddenException('没有权限移除文档权限');
      }
    }

    await this.prisma.document_principals.deleteMany({
      where: {
        document_id: documentId,
        principal_type: 'user',
        principal_id: targetUserId,
      },
    });

    return { success: true };
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查用户是否有指定权限
   */
  private async checkUserPermission(
    documentId: string,
    userId: string,
    requiredPermission: document_principals_permission,
  ): Promise<boolean> {
    const { permission } = await this.getUserPermission(documentId, userId);
    if (!permission) return false;

    // 检查权限等级
    return PERMISSION_LEVELS[permission] >= PERMISSION_LEVELS[requiredPermission];
  }

  /**
   * 映射文档信息为响应格式
   */
  private mapDocumentInfo(doc: {
    document_id: string;
    title: string;
    type: string;
    owner_id: string;
    parent_id: string | null;
    is_starred: boolean;
    sort_order: number;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    share_token: string;
    link_permission: string | null;
  }) {
    return {
      documentId: doc.document_id,
      title: doc.title,
      type: doc.type,
      ownerId: doc.owner_id,
      parentId: doc.parent_id,
      isStarred: doc.is_starred,
      sortOrder: doc.sort_order,
      isDeleted: doc.is_deleted,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      shareToken: doc.share_token,
      linkPermission: doc.link_permission,
    };
  }

  /**
   * 检查循环引用
   */
  private async checkCircularReference(documentId: string, targetParentId: string) {
    if (documentId === targetParentId) {
      throw new BadRequestException('不能将文档移动到自己内部');
    }

    let currentId: string | null = targetParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        throw new BadRequestException('检测到循环引用');
      }
      visited.add(currentId);

      const parent = await this.prisma.documents_info.findUnique({
        where: { document_id: currentId },
        select: { parent_id: true },
      });

      if (parent?.parent_id === documentId) {
        throw new BadRequestException('不能将文档移动到其子文件夹中');
      }

      currentId = parent?.parent_id || null;
    }
  }

  /**
   * 软删除子文档
   */
  private async softDeleteChildren(parentId: string) {
    const children = await this.prisma.documents_info.findMany({
      where: { parent_id: parentId },
    });

    for (const child of children) {
      if (child.type === 'FOLDER') {
        await this.softDeleteChildren(child.document_id);
      }
      await this.prisma.documents_info.update({
        where: { document_id: child.document_id },
        data: { is_deleted: true, updated_at: new Date() },
      });
    }
  }

  /**
   * 恢复子文档
   */
  private async restoreChildren(parentId: string) {
    const children = await this.prisma.documents_info.findMany({
      where: { parent_id: parentId },
    });

    for (const child of children) {
      if (child.type === 'FOLDER') {
        await this.restoreChildren(child.document_id);
      }
      await this.prisma.documents_info.update({
        where: { document_id: child.document_id },
        data: { is_deleted: false, updated_at: new Date() },
      });
    }
  }

  /**
   * 永久删除子文档
   */
  private async removeChildren(parentId: string) {
    const children = await this.prisma.documents_info.findMany({
      where: { parent_id: parentId },
    });

    for (const child of children) {
      if (child.type === 'FOLDER') {
        await this.removeChildren(child.document_id);
      }

      await this.prisma.$transaction([
        this.prisma.document_contents.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_versions.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_principals.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.documents_info.delete({
          where: { document_id: child.document_id },
        }),
      ]);
    }
  }
}
