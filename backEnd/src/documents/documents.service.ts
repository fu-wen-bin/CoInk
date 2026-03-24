import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
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
import { BatchRemovePermissionsDto, BatchUpsertPermissionsDto } from './dto/permission.dto';
import { UpdateDocumentContentDto, UpdateDocumentDto } from './dto/update-document.dto';
import { EMPTY_TIPTAP_DOCUMENT_JSON } from '../collaboration/document-yjs-storage';
import { NotificationsService } from '../notifications/notifications.service';

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
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
          content: EMPTY_TIPTAP_DOCUMENT_JSON,
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

    if (createDocumentDto.isStarred) {
      await this.applyUserStar(documentId, createDocumentDto.ownerId, true);
    }

    return {
      documentId: doc.document_id,
      title: doc.title,
      type: doc.type,
      ownerId: doc.owner_id,
      parentId: doc.parent_id,
      isStarred: Boolean(createDocumentDto.isStarred),
      sortOrder: doc.sort_order,
      shareToken: doc.share_token,
      linkPermission: doc.link_permission,
      createdAt: doc.created_at,
    };
  }

  /**
   * 获取用户的所有文档（不包含已删除的）
   * 含：自己拥有的文档 + 他人文档但对当前用户有效权限为 full 的协作文档（与「共享」互斥）
   */
  async findAll(ownerId: string) {
    const owned = await this.prisma.documents_info.findMany({
      where: {
        owner_id: ownerId,
        is_deleted: false,
      },
      orderBy: [{ sort_order: 'asc' }, { updated_at: 'desc' }],
    });

    const fullCollaborationIds = await this.findDocumentIdsWhereUserHasFullAsNonOwner(ownerId);
    let extra: typeof owned = [];
    if (fullCollaborationIds.length > 0) {
      extra = await this.prisma.documents_info.findMany({
        where: {
          document_id: { in: fullCollaborationIds },
          is_deleted: false,
        },
        orderBy: [{ sort_order: 'asc' }, { updated_at: 'desc' }],
      });
    }

    const merged = this.mergeDocumentsById(owned, extra);
    const sorted = await this.sortDocsByUserStarForUser(merged, ownerId);
    return this.enrichDocumentsForUser(sorted, ownerId);
  }

  /**
   * 获取单个文档详情
   * @param userId 传入时，isStarred 表示该用户是否在 document_user_star 中收藏
   */
  async findOne(documentId: string, userId?: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (!userId) {
      return this.mapDocumentInfo(doc, false);
    }

    const starred = await this.isStarredByUser(documentId, userId);
    return this.mapDocumentInfo(doc, starred);
  }

  /**
   * 按父目录获取文档
   * 含：自己该目录下的文档 + 他人文档但对当前用户有效权限为 full 且 parent 匹配的协作文档
   */
  async findByParent(parentId: string | null, ownerId: string) {
    const owned = await this.prisma.documents_info.findMany({
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

    const fullCollaborationIds = await this.findDocumentIdsWhereUserHasFullAsNonOwner(ownerId);
    let extra: typeof owned = [];
    if (fullCollaborationIds.length > 0) {
      extra = await this.prisma.documents_info.findMany({
        where: {
          document_id: { in: fullCollaborationIds },
          parent_id: parentId || null,
          is_deleted: false,
        },
        orderBy: [
          { type: 'desc' },
          { sort_order: 'asc' },
          { updated_at: 'desc' },
        ],
      });
    }

    const merged = this.mergeDocumentsById(owned, extra);
    const sorted = await this.sortDocsByUserStarForUser(merged, ownerId);
    return this.enrichDocumentsForUser(sorted, ownerId);
  }

  /**
   * 获取当前用户在 document_user_star 中的收藏（含他人文档、共享文档）
   */
  async findStarred(userId: string) {
    let starRows: { document_id: string; created_at: Date }[] = [];
    try {
      starRows = await this.prisma.document_user_star.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });
    } catch (err) {
      this.logger.warn(
        `document_user_star 查询失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    if (starRows.length === 0) {
      return [];
    }

    const orderMap = new Map<string, number>(starRows.map((s, i) => [s.document_id, i]));
    const docIds = starRows.map((s) => s.document_id);

    const docs = await this.prisma.documents_info.findMany({
      where: {
        document_id: { in: docIds },
        is_deleted: false,
      },
    });

    const allowed: typeof docs = [];
    for (const doc of docs) {
      try {
        const { permission } = await this.getUserPermission(doc.document_id, userId);
        if (permission) {
          allowed.push(doc);
        }
      } catch {
        // 文档不存在等跳过
      }
    }

    allowed.sort((a, b) => (orderMap.get(a.document_id) ?? 0) - (orderMap.get(b.document_id) ?? 0));

    return this.enrichDocumentsForUser(allowed, userId);
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

    // 使用 enrichDocumentsForUser 补充完整信息（parentFolderTitle, isStarred 等）
    const enriched = await this.enrichDocumentsForUser(docs, ownerId);
    return { documents: enriched, total: enriched.length };
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

    const starred = userId ? await this.isStarredByUser(doc.document_id, userId) : false;

    return {
      ...this.mapDocumentInfo(doc, starred),
      linkPermission: doc.link_permission,
    };
  }

  /**
   * 获取与我共享的文档列表（非拥有者，且有效权限不为 full——可读/可写/评论/管理等在侧栏「共享」展示）
   * full 权限协作文档出现在「我的文档库」接口中，不在此列表。
   * 列表随拥有者修改权限而变；协作者无法通过「退出」接口改变服务端权限。
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

    // 构建权限映射（principal 行，用于展示；有效权限以 getUserPermission 为准）
    const permissionMap = new Map<string, (typeof principals)[0]>();
    for (const p of [...principals, ...groupPrincipals]) {
      const existing = permissionMap.get(p.document_id);
      if (!existing || PERMISSION_LEVELS[p.permission] > PERMISSION_LEVELS[existing.permission]) {
        permissionMap.set(p.document_id, p);
      }
    }

    // 仅保留有效权限存在且不为 full 的文档（full 归入「我的文档库」）
    const filteredDocs: typeof docs = [];
    for (const doc of docs) {
      const { permission } = await this.getUserPermission(doc.document_id, userId);
      if (permission && permission !== 'full') {
        filteredDocs.push(doc);
      }
    }

    const enriched = await this.enrichDocumentsForUser(filteredDocs, userId);

    const activeRows = enriched.map((item, i) => ({
      ...item,
      myPermission: permissionMap.get(filteredDocs[i].document_id)?.permission,
      sharedAccessDenied: false,
    }));

    const includedIds = new Set(filteredDocs.map((d) => d.document_id));
    const staleDocs = await this.findStaleNonOwnerDocsWithoutPermission(userId, includedIds);
    if (staleDocs.length === 0) {
      return activeRows;
    }

    const staleEnriched = await this.enrichDocumentsForUser(staleDocs, userId);
    const staleRows = staleEnriched.map((item) => ({
      ...item,
      sharedAccessDenied: true,
    }));

    return [...activeRows, ...staleRows];
  }

  /**
   * 非拥有、当前已无任何有效权限，但仍有「最近访问」或「收藏」记录的文档（侧栏仍展示，点进后提示无权限）
   */
  private async findStaleNonOwnerDocsWithoutPermission(
    userId: string,
    alreadyIncluded: Set<string>,
  ) {
    let accessIds: string[] = [];
    try {
      const rows = await this.prisma.document_user_access.findMany({
        where: { user_id: userId },
        select: { document_id: true },
      });
      accessIds = rows.map((r) => r.document_id);
    } catch (err) {
      this.logger.warn(
        `document_user_access 查询失败（无权限占位列表将省略）：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let starIds: string[] = [];
    try {
      const rows = await this.prisma.document_user_star.findMany({
        where: { user_id: userId },
        select: { document_id: true },
      });
      starIds = rows.map((r) => r.document_id);
    } catch (err) {
      this.logger.warn(
        `document_user_star 查询失败（无权限占位列表将省略）：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const candidateIds = [...new Set([...accessIds, ...starIds])].filter(
      (id) => id && !alreadyIncluded.has(id),
    );
    if (candidateIds.length === 0) {
      return [];
    }

    const docs = await this.prisma.documents_info.findMany({
      where: {
        document_id: { in: candidateIds },
        is_deleted: false,
        owner_id: { not: userId },
      },
    });

    const stale: typeof docs = [];
    for (const doc of docs) {
      const { permission } = await this.getUserPermission(doc.document_id, userId);
      if (permission === null) {
        stale.push(doc);
      }
    }
    return stale;
  }

  /** 合并文档列表并按 document_id 去重（primary 顺序优先） */
  private mergeDocumentsById<
    T extends { document_id: string },
  >(primary: T[], secondary: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const d of primary) {
      if (!seen.has(d.document_id)) {
        seen.add(d.document_id);
        out.push(d);
      }
    }
    for (const d of secondary) {
      if (!seen.has(d.document_id)) {
        seen.add(d.document_id);
        out.push(d);
      }
    }
    return out;
  }

  /**
   * 非拥有者身份下，有效权限为 full 的文档 ID（与「共享的文档」互斥，出现在「我的文档库」树）
   */
  private async findDocumentIdsWhereUserHasFullAsNonOwner(userId: string): Promise<string[]> {
    const principals = await this.prisma.document_principals.findMany({
      where: { principal_type: 'user', principal_id: userId },
    });
    const userGroups = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });
    const groupPrincipals =
      userGroups.length > 0
        ? await this.prisma.document_principals.findMany({
            where: {
              principal_type: 'group',
              principal_id: { in: userGroups.map((g) => g.group_id) },
            },
          })
        : [];
    const candidateIds = [
      ...new Set([...principals, ...groupPrincipals].map((p) => p.document_id)),
    ];
    const result: string[] = [];
    for (const documentId of candidateIds) {
      const doc = await this.prisma.documents_info.findUnique({
        where: { document_id: documentId },
        select: { owner_id: true, is_deleted: true },
      });
      if (!doc || doc.is_deleted || doc.owner_id === userId) continue;
      const { permission } = await this.getUserPermission(documentId, userId);
      if (permission === 'full') {
        result.push(documentId);
      }
    }
    return result;
  }

  /**
   * 记录当前用户打开文档（用于「最近访问」时间，按用户维度）
   */
  async recordAccess(documentId: string, userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc || doc.is_deleted) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.type !== 'FILE') {
      return { success: true };
    }

    const canView = await this.checkUserPermission(documentId, userId, 'view');
    if (!canView) {
      throw new ForbiddenException('没有权限访问此文档');
    }

    try {
      await this.prisma.document_user_access.upsert({
        where: {
          document_id_user_id: {
            document_id: documentId,
            user_id: userId,
          },
        },
        create: {
          document_id: documentId,
          user_id: userId,
          last_accessed_at: new Date(),
        },
        update: {
          last_accessed_at: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `recordAccess 写入失败（表未迁移时属预期）：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { success: true };
  }

  /**
   * 从「最近访问」中移除：删除当前用户在这些文档上的访问记录（不删文档）
   */
  async removeFromRecentList(userId: string, documentIds: string[]) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!documentIds?.length) {
      return { success: true, removed: 0 };
    }

    try {
      const result = await this.prisma.document_user_access.deleteMany({
        where: {
          user_id: userId,
          document_id: { in: documentIds },
        },
      });
      return { success: true, removed: result.count };
    } catch (err) {
      this.logger.warn(
        `removeFromRecentList 失败（表未迁移时属预期）：${err instanceof Error ? err.message : String(err)}`,
      );
      return { success: true, removed: 0 };
    }
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

    if (updateDocumentDto.isStarred !== undefined) {
      await this.applyUserStar(documentId, existing.owner_id, updateDocumentDto.isStarred);
      return this.mapDocumentInfo(doc, updateDocumentDto.isStarred);
    }

    const ownerStarred = await this.isStarredByUser(documentId, existing.owner_id);
    return this.mapDocumentInfo(doc, ownerStarred);
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

    const starred = await this.isStarredByUser(documentId, existing.owner_id);
    return this.mapDocumentInfo(doc, starred);
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

    const starred = await this.isStarredByUser(documentId, userId);
    return this.mapDocumentInfo(updated, starred);
  }

  /**
   * 收藏/取消收藏（仅写入 document_user_star）
   */
  async toggleStar(documentId: string, userId: string, isStarred: boolean) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!existing || existing.is_deleted) {
      throw new NotFoundException('文档不存在');
    }

    const { permission } = await this.getUserPermission(documentId, userId);
    if (!permission) {
      throw new ForbiddenException('没有权限收藏此文档');
    }

    await this.applyUserStar(documentId, userId, isStarred);

    return this.mapDocumentInfo(existing, isStarred);
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

    return this.mapDocumentInfo(doc, false);
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

    return this.mapDocumentInfo(doc, false);
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
      this.prisma.document_comments.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_contents.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_versions.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_principals.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_user_star.deleteMany({
        where: { document_id: documentId },
      }),
      this.prisma.document_user_access.deleteMany({
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
        y_state: null,
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

  /** 与 MySQL TIMESTAMP(0) 对齐的秒级时间，供 document_versions.version_id 写入 */
  private nextDocumentVersionTimestamp(): Date {
    const d = new Date();
    d.setMilliseconds(0);
    return d;
  }

  // ==================== 文档版本操作 ====================

  /**
   * 创建文档版本（保存历史）
   */
  async createVersion(createVersionDto: CreateDocumentVersionDto) {
    const existing = await this.prisma.documents_info.findUnique({
      where: { document_id: createVersionDto.documentId },
    });
    if (!existing || existing.is_deleted) {
      throw new NotFoundException('文档不存在');
    }
    const row = await this.prisma.document_contents.findUnique({
      where: { document_id: createVersionDto.documentId },
    });
    if (!row) {
      throw new NotFoundException('文档内容不存在');
    }

    let yState: Buffer | null = null;
    if (createVersionDto.yStateBase64) {
      try {
        const buf = Buffer.from(createVersionDto.yStateBase64, 'base64');
        if (buf.length > 0) {
          yState = buf;
        }
      } catch {
        throw new BadRequestException('yStateBase64 无效');
      }
    }

    // 显式写入 version_id（秒精度），避免依赖 DB DEFAULT 时 Prisma 对 MySQL TIMESTAMP 主键回读失败；
    // 若同一文档同一秒内重复创建，则顺延到下一秒（P2002 重试）
    let snapshotAt = this.nextDocumentVersionTimestamp();
    const dataBase = {
      document_id: createVersionDto.documentId,
      title: createVersionDto.title,
      description: createVersionDto.description ?? null,
      content: createVersionDto.content as Prisma.InputJsonValue,
      y_state: (yState ?? null) as Prisma.Bytes | null,
      user_id: createVersionDto.userId,
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const version = await this.prisma.document_versions.create({
          data: {
            ...dataBase,
            version_id: snapshotAt,
          },
        });

        return {
          versionId: version.version_id.toISOString(),
          documentId: version.document_id,
          title: version.title,
          description: version.description,
          createdAt: version.created_at,
          userId: version.user_id,
        };
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? (err as { code: string }).code
            : '';
        if (code === 'P2002' && attempt < 7) {
          snapshotAt = new Date(snapshotAt.getTime() + 1000);
          continue;
        }
        throw err;
      }
    }

    throw new InternalServerErrorException('无法创建文档版本，请稍后重试');
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

    // 列表不读取 content / y_state：避免单行 JSON 损坏或超大 BLOB 导致整次查询失败
    const versions = await this.prisma.document_versions.findMany({
      where: { document_id: documentId },
      select: {
        version_id: true,
        document_id: true,
        title: true,
        description: true,
        created_at: true,
        user_id: true,
      },
      orderBy: { version_id: 'desc' },
      take: 50,
    });

    return {
      versions: versions.map((v) => ({
        versionId: v.version_id.toISOString(),
        documentId: v.document_id,
        title: v.title,
        description: v.description,
        createdAt: v.created_at,
        userId: v.user_id,
      })),
      total: versions.length,
    };
  }

  /**
   * 获取指定版本详情
   */
  async findVersion(documentId: string, versionId: Date) {
    const version = await this.prisma.document_versions.findUnique({
      where: {
        document_id_version_id: {
          document_id: documentId,
          version_id: versionId,
        },
      },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return {
      versionId: version.version_id.toISOString(),
      documentId: version.document_id,
      title: version.title,
      description: version.description,
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
      where: {
        document_id_version_id: {
          document_id: documentId,
          version_id: versionId,
        },
      },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    const yState: Buffer | null =
      version.y_state && version.y_state.length > 0 ? Buffer.from(version.y_state) : null;

    // 更新当前内容为版本内容（若有保存的 y_state 则一并还原协同状态）
    const content = await this.prisma.document_contents.update({
      where: { document_id: documentId },
      data: {
        content: version.content as Prisma.InputJsonValue,
        y_state: (yState ?? null) as Prisma.Bytes | null,
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

    let highestPermission: document_principals_permission | null = principal?.permission ?? null;
    let source: 'direct' | 'group' | 'link' | null = principal ? 'direct' : null;

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
        const highestGroupPermission = groupPermissions.reduce((highest, current) => {
          return PERMISSION_LEVELS[current.permission] > PERMISSION_LEVELS[highest.permission]
            ? current
            : highest;
        });

        if (
          !highestPermission ||
          PERMISSION_LEVELS[highestGroupPermission.permission] > PERMISSION_LEVELS[highestPermission]
        ) {
          highestPermission = highestGroupPermission.permission;
          source = 'group';
        }
      }
    }

    // 链接权限开启时与 ACL 做最高权限合并（close 时仅看 ACL）
    if (doc.link_permission && doc.link_permission !== 'close') {
      const linkPermission =
        doc.link_permission === 'edit'
          ? ('edit' as document_principals_permission)
          : ('view' as document_principals_permission);

      if (!highestPermission || PERMISSION_LEVELS[linkPermission] > PERMISSION_LEVELS[highestPermission]) {
        highestPermission = linkPermission;
        source = 'link';
      }
    }

    return { permission: highestPermission, source };
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

  async listPrincipals(documentId: string, userId: string) {
    await this.assertCanManagePermissions(documentId, userId);

    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
      select: {
        owner_id: true,
        link_permission: true,
      },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    const principals = await this.prisma.document_principals.findMany({
      where: { document_id: documentId },
      orderBy: [{ principal_type: 'asc' }, { updated_at: 'desc' }],
    });

    const userIds = principals
      .filter((p) => p.principal_type === 'user')
      .map((p) => p.principal_id);
    const groupIds = principals
      .filter((p) => p.principal_type === 'group')
      .map((p) => p.principal_id);

    const [users, groups] = await Promise.all([
      userIds.length > 0
        ? this.prisma.users.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true, name: true, avatar_url: true },
          })
        : Promise.resolve(
            [] as {
              user_id: string;
              name: string;
              avatar_url: string | null;
            }[],
          ),
      groupIds.length > 0
        ? this.prisma.groups.findMany({
            where: { group_id: { in: groupIds } },
            select: { group_id: true, name: true },
          })
        : Promise.resolve(
            [] as {
              group_id: string;
              name: string;
            }[],
          ),
    ]);

    const userMap = new Map<
      string,
      {
        user_id: string;
        name: string;
        avatar_url: string | null;
      }
    >();
    users.forEach((u) => userMap.set(u.user_id, u));

    const groupMap = new Map<
      string,
      {
        group_id: string;
        name: string;
      }
    >();
    groups.forEach((g) => groupMap.set(g.group_id, g));

    return {
      ownerId: doc.owner_id,
      linkPermission: doc.link_permission,
      principals: principals.map((p) => {
        if (p.principal_type === 'user') {
          const user = userMap.get(p.principal_id);
          return {
            principalType: p.principal_type,
            principalId: p.principal_id,
            permission: p.permission,
            name: user?.name ?? p.principal_id,
            avatarUrl: user?.avatar_url ?? null,
          };
        }

        const group = groupMap.get(p.principal_id);
        return {
          principalType: p.principal_type,
          principalId: p.principal_id,
          permission: p.permission,
          name: group?.name ?? p.principal_id,
        };
      }),
    };
  }

  async batchUpsertPermissions(documentId: string, dto: BatchUpsertPermissionsDto) {
    await this.assertCanManagePermissions(documentId, dto.grantedBy);

    const userTargets = dto.userTargets ?? [];
    const groupTargets = dto.groupTargets ?? [];

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const target of userTargets) {
        await tx.document_principals.upsert({
          where: {
            document_id_principal_type_principal_id: {
              document_id: documentId,
              principal_type: 'user',
              principal_id: target.targetId,
            },
          },
          update: {
            permission: target.permission,
            granted_by: dto.grantedBy,
            updated_at: now,
          },
          create: {
            document_id: documentId,
            principal_type: 'user',
            principal_id: target.targetId,
            permission: target.permission,
            granted_by: dto.grantedBy,
          },
        });
      }

      for (const target of groupTargets) {
        await tx.document_principals.upsert({
          where: {
            document_id_principal_type_principal_id: {
              document_id: documentId,
              principal_type: 'group',
              principal_id: target.targetId,
            },
          },
          update: {
            permission: target.permission,
            granted_by: dto.grantedBy,
            updated_at: now,
          },
          create: {
            document_id: documentId,
            principal_type: 'group',
            principal_id: target.targetId,
            permission: target.permission,
            granted_by: dto.grantedBy,
          },
        });
      }
    });

    if (dto.sendNotification !== false) {
      const notifyUserIds = new Set<string>(userTargets.map((item) => item.targetId));

      if (groupTargets.length > 0) {
        const memberships = await this.prisma.group_members.findMany({
          where: {
            group_id: {
              in: groupTargets.map((item) => item.targetId),
            },
          },
          select: { user_id: true },
        });
        for (const member of memberships) {
          notifyUserIds.add(member.user_id);
        }
      }

      notifyUserIds.delete(dto.grantedBy);

      await Promise.all(
        Array.from(notifyUserIds).map((uid) =>
          this.notificationsService.createAndPush({
            userId: uid,
            requestId: 0n,
            type: 'DOCUMENT_PERMISSION_CHANGED',
            payload: {
              documentId,
              operatorId: dto.grantedBy,
            },
            event: 'permission.changed',
          }),
        ),
      );
    }

    return {
      success: true,
      upsertedUsers: userTargets.length,
      upsertedGroups: groupTargets.length,
    };
  }

  async batchRemovePermissions(documentId: string, dto: BatchRemovePermissionsDto) {
    await this.assertCanManagePermissions(documentId, dto.grantedBy);

    const userIds = dto.userIds ?? [];
    const groupIds = dto.groupIds ?? [];

    const [removedUsers, removedGroups] = await Promise.all([
      userIds.length > 0
        ? this.prisma.document_principals.deleteMany({
            where: {
              document_id: documentId,
              principal_type: 'user',
              principal_id: { in: userIds },
            },
          })
        : Promise.resolve({ count: 0 }),
      groupIds.length > 0
        ? this.prisma.document_principals.deleteMany({
            where: {
              document_id: documentId,
              principal_type: 'group',
              principal_id: { in: groupIds },
            },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    return {
      success: true,
      removedUsers: removedUsers.count,
      removedGroups: removedGroups.count,
    };
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

  private async assertCanManagePermissions(documentId: string, userId: string) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.owner_id === userId) {
      return;
    }

    const canManage = await this.checkUserPermission(documentId, userId, 'manage');
    if (!canManage) {
      throw new ForbiddenException('没有权限管理文档协作者');
    }
  }

  /** 批量收藏（跳过无权限项） */
  async batchStarDocuments(userId: string, documentIds: string[]) {
    const unique = [...new Set(documentIds.filter(Boolean))];
    let starred = 0;
    for (const documentId of unique) {
      try {
        await this.toggleStar(documentId, userId, true);
        starred += 1;
      } catch {
        // 无权限或不存在则跳过
      }
    }
    return {
      code: 200,
      message: 'success',
      data: { starred, requested: unique.length },
      timestamp: Date.now(),
    };
  }

  /**
   * 当前用户是否已在 document_user_star 中收藏该文档
   */
  private async isStarredByUser(documentId: string, userId: string): Promise<boolean> {
    try {
      const row = await this.prisma.document_user_star.findUnique({
        where: {
          document_id_user_id: {
            document_id: documentId,
            user_id: userId,
          },
        },
      });
      return Boolean(row);
    } catch (err) {
      this.logger.warn(
        `document_user_star 查询失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * 写入/删除当前用户对文档的收藏（document_user_star）
   */
  private async applyUserStar(documentId: string, userId: string, isStarred: boolean) {
    try {
      if (isStarred) {
        await this.prisma.document_user_star.upsert({
          where: {
            document_id_user_id: {
              document_id: documentId,
              user_id: userId,
            },
          },
          create: { document_id: documentId, user_id: userId },
          update: {},
        });
      } else {
        await this.prisma.document_user_star.deleteMany({
          where: { document_id: documentId, user_id: userId },
        });
      }
    } catch (err) {
      this.logger.error(
        `document_user_star 写入失败（请执行迁移）：${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * 列表排序：当前用户收藏优先，其次按原 type / sort_order / updated_at
   */
  private async sortDocsByUserStarForUser<
    T extends {
      document_id: string;
      type: string;
      sort_order: number;
      updated_at: Date;
    },
  >(docs: T[], userId: string): Promise<T[]> {
    if (docs.length === 0) {
      return docs;
    }
    const ids = docs.map((d) => d.document_id);
    let starSet = new Set<string>();
    try {
      const stars = await this.prisma.document_user_star.findMany({
        where: { user_id: userId, document_id: { in: ids } },
        select: { document_id: true },
      });
      starSet = new Set(stars.map((s) => s.document_id));
    } catch (err) {
      this.logger.warn(
        `document_user_star 查询失败，将不按收藏排序：${err instanceof Error ? err.message : String(err)}`,
      );
      return docs;
    }

    const typeRank = (t: string) => (t === 'FOLDER' ? 0 : 1);

    return [...docs].sort((a, b) => {
      const sa = starSet.has(a.document_id) ? 1 : 0;
      const sb = starSet.has(b.document_id) ? 1 : 0;
      if (sb !== sa) {
        return sb - sa;
      }
      if (typeRank(a.type) !== typeRank(b.type)) {
        return typeRank(a.type) - typeRank(b.type);
      }
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return b.updated_at.getTime() - a.updated_at.getTime();
    });
  }

  /**
   * 为列表补充：当前用户的最近访问时间、父文件夹标题
   */
  private async enrichDocumentsForUser(
    docs: {
      document_id: string;
      title: string;
      type: string;
      owner_id: string;
      parent_id: string | null;
      sort_order: number;
      is_deleted: boolean;
      created_at: Date;
      updated_at: Date;
      share_token: string;
      link_permission: string | null;
    }[],
    userId: string,
  ) {
    if (docs.length === 0) {
      return [];
    }

    const docIds = docs.map((d) => d.document_id);
    let accessMap = new Map<
      string,
      { document_id: string; user_id: string; last_accessed_at: Date }
    >();
    try {
      const accessRows = await this.prisma.document_user_access.findMany({
        where: {
          user_id: userId,
          document_id: { in: docIds },
        },
      });
      accessMap = new Map(accessRows.map((a) => [a.document_id, a]));
    } catch (err) {
      // 常见原因：未执行迁移，表 document_user_access 尚不存在；列表仍应返回
      this.logger.warn(
        `document_user_access 查询失败，将不附带最近访问时间（请执行 prisma migrate）。${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parentIds = [...new Set(docs.map((d) => d.parent_id).filter(Boolean))] as string[];
    let parentTitleMap = new Map<string, string>();
    if (parentIds.length > 0) {
      const parents = await this.prisma.documents_info.findMany({
        where: { document_id: { in: parentIds }, type: 'FOLDER' },
        select: { document_id: true, title: true },
      });
      parentTitleMap = new Map(parents.map((p) => [p.document_id, p.title]));
    }

    let starQueryOk = false;
    let starSet = new Set<string>();
    try {
      const starRows = await this.prisma.document_user_star.findMany({
        where: {
          user_id: userId,
          document_id: { in: docIds },
        },
        select: { document_id: true },
      });
      starSet = new Set(starRows.map((r) => r.document_id));
      starQueryOk = true;
    } catch (err) {
      this.logger.warn(
        `document_user_star 查询失败，isStarred 将视为 false：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return docs.map((doc) => {
      const isStarredForUser = starQueryOk ? starSet.has(doc.document_id) : false;
      const base = this.mapDocumentInfo(doc, isStarredForUser);
      const access = accessMap.get(doc.document_id);
      return {
        ...base,
        lastAccessedAt: access?.last_accessed_at ?? null,
        parentFolderTitle: doc.parent_id ? (parentTitleMap.get(doc.parent_id) ?? null) : null,
      };
    });
  }

  /**
   * 映射文档信息为响应格式（isStarred 来自 document_user_star，不再使用 documents_info 列）
   */
  private mapDocumentInfo(
    doc: {
      document_id: string;
      title: string;
      type: string;
      owner_id: string;
      parent_id: string | null;
      sort_order: number;
      is_deleted: boolean;
      created_at: Date;
      updated_at: Date;
      share_token: string;
      link_permission: string | null;
    },
    isStarred: boolean,
  ) {
    return {
      documentId: doc.document_id,
      title: doc.title,
      type: doc.type,
      ownerId: doc.owner_id,
      parentId: doc.parent_id,
      isStarred,
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
        this.prisma.document_comments.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_contents.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_versions.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_principals.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_user_star.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.document_user_access.deleteMany({
          where: { document_id: child.document_id },
        }),
        this.prisma.documents_info.delete({
          where: { document_id: child.document_id },
        }),
      ]);
    }
  }
}
