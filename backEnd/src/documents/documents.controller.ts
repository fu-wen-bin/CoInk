import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { DocumentsService } from './documents.service';
import {
  CreateDocumentContentDto,
  CreateDocumentDto,
  CreateDocumentVersionDto,
} from './dto/create-document.dto';
import { BatchRemovePermissionsDto, BatchUpsertPermissionsDto } from './dto/permission.dto';
import { UpdateDocumentContentDto, UpdateDocumentDto } from './dto/update-document.dto';
import { document_principals_permission } from '../../generated/prisma/enums';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // 创建文档（文件或文件夹）
  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.create(createDocumentDto);
  }

  // 获取当前用户的全部文档列表
  @Get()
  findAll(@Query('ownerId') ownerId: string) {
    // 如果传了 ownerId 就使用，否则返回空列表（实际应从 JWT 获取）
    if (!ownerId) {
      return {
        code: 200,
        message: 'success',
        data: { documents: [], total: 0 },
        timestamp: Date.now(),
      };
    }
    return this.documentsService.findAll(ownerId);
  }

  // 按父级查询子文档（根目录时 parentId 为空字符串或不传）
  @Get('parent')
  findByParent(@Query('parentId') parentId: string | null, @Query('ownerId') ownerId: string) {
    if (!ownerId) {
      throw new BadRequestException('ownerId is required');
    }
    return this.documentsService.findByParent(parentId ?? null, ownerId);
  }

  // 获取当前用户的收藏文档（document_user_star）
  @Get('starred')
  findStarred(@Query('userId') userId: string, @Query('ownerId') ownerId?: string) {
    const uid = userId || ownerId;
    if (!uid) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.findStarred(uid);
  }

  // 获取回收站文档
  @Get('deleted')
  findDeleted(@Query('ownerId') ownerId: string) {
    if (!ownerId) {
      throw new BadRequestException('ownerId is required');
    }
    return this.documentsService.findDeleted(ownerId);
  }

  // 获取与我共享的文档
  @Get('shared/me')
  findSharedWithMe(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.findSharedWithMe(userId);
  }

  // 从最近访问列表中批量移除（仅删除访问记录）
  @Post('recent/remove')
  removeFromRecent(@Body('userId') userId: string, @Body('documentIds') documentIds: string[]) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!Array.isArray(documentIds)) {
      throw new BadRequestException('documentIds must be an array');
    }
    return this.documentsService.removeFromRecentList(userId, documentIds);
  }

  /** 批量收藏（我的文档 + 与我共享的文档 ID 列表） */
  @Post('stars/batch')
  batchStarDocuments(@Body('userId') userId: string, @Body('documentIds') documentIds: string[]) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!Array.isArray(documentIds)) {
      throw new BadRequestException('documentIds must be an array');
    }
    return this.documentsService.batchStarDocuments(userId, documentIds);
  }

  // 通过分享 token 获取文档
  @Get('share/:shareToken')
  findByShareToken(@Param('shareToken') shareToken: string, @Query('userId') userId?: string) {
    if (!shareToken) {
      throw new BadRequestException('shareToken is required');
    }
    return this.documentsService.findByShareToken(shareToken, userId);
  }

  // 记录用户打开文档（最近访问时间）
  @Post(':id/access')
  recordAccess(@Param('id') id: string, @Body('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.recordAccess(id, userId);
  }

  // 获取单个文档详情（可选 userId 用于返回当前用户是否收藏）
  @Get(':id')
  findOne(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.documentsService.findOne(id, userId);
  }

  // 更新文档元数据（标题、排序、分享权限等）
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  // 重命名文档
  @Patch(':id/rename')
  rename(@Param('id') id: string, @Body('title') title: string) {
    if (!title) {
      throw new BadRequestException('title is required');
    }
    return this.documentsService.rename(id, title);
  }

  // 移动文档到指定文件夹
  @Patch(':id/move')
  move(
    @Param('id') id: string,
    @Body('parentId') parentId: string | null,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.move(id, parentId ?? null, userId);
  }

  // 收藏/取消收藏（需有文档访问权限；userId 为执行操作的用户）
  @Patch(':id/star')
  toggleStar(
    @Param('id') id: string,
    @Body('isStarred') isStarred: boolean,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.toggleStar(id, userId, Boolean(isStarred));
  }

  // 软删除文档（移动到回收站）
  @Patch(':id/soft-delete')
  softDelete(@Param('id') id: string) {
    return this.documentsService.softDelete(id);
  }

  // 恢复回收站文档
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.documentsService.restore(id);
  }

  // 永久删除文档
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  // ==================== 分享相关 ====================

  // 生成/开启分享链接
  @Post(':id/share')
  generateShareToken(@Param('id') id: string, @Body('permission') permission: 'view' | 'edit') {
    if (!permission || !['view', 'edit'].includes(permission)) {
      throw new BadRequestException('permission must be view or edit');
    }
    return this.documentsService.generateShareToken(id, permission);
  }

  // 关闭分享链接
  @Patch(':id/share')
  closeShare(@Param('id') id: string) {
    return this.documentsService.closeShare(id);
  }

  // ==================== 权限相关 ====================

  // 获取当前用户对文档的权限
  @Get(':id/permission')
  getUserPermission(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.documentsService.getUserPermission(id, userId ?? '');
  }

  @Get(':id/principals')
  listPrincipals(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.documentsService.listPrincipals(id, userId);
  }

  // 设置用户权限
  @Post(':id/permissions')
  setUserPermission(
    @Param('id') id: string,
    @Body('targetUserId') targetUserId: string,
    @Body('permission') permission: document_principals_permission,
    @Body('grantedBy') grantedBy: string,
  ) {
    if (!targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    if (!permission) {
      throw new BadRequestException('permission is required');
    }
    if (!grantedBy) {
      throw new BadRequestException('grantedBy is required');
    }
    return this.documentsService.setUserPermission(id, targetUserId, permission, grantedBy);
  }

  // 移除用户权限
  @Delete(':id/permissions')
  removeUserPermission(
    @Param('id') id: string,
    @Body('targetUserId') targetUserId: string,
    @Body('grantedBy') grantedBy: string,
  ) {
    if (!targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    if (!grantedBy) {
      throw new BadRequestException('grantedBy is required');
    }
    return this.documentsService.removeUserPermission(id, targetUserId, grantedBy);
  }

  @Post(':id/permissions/batch-upsert')
  batchUpsertPermissions(@Param('id') id: string, @Body() dto: BatchUpsertPermissionsDto) {
    if (!dto.grantedBy) {
      throw new BadRequestException('grantedBy is required');
    }
    return this.documentsService.batchUpsertPermissions(id, dto);
  }

  @Delete(':id/permissions/batch')
  batchRemovePermissions(
    @Param('id') id: string,
    @Body() dto: BatchRemovePermissionsDto,
    @Query('grantedBy') grantedByQuery?: string,
  ) {
    // 优先从查询参数获取 grantedBy，否则从 body 获取
    const grantedBy = grantedByQuery || dto.grantedBy;
    if (!grantedBy) {
      throw new BadRequestException('grantedBy is required');
    }
    return this.documentsService.batchRemovePermissions(id, { ...dto, grantedBy });
  }

  // ==================== 文档内容 ====================

  // 创建文档内容（初始化时使用）
  @Post(':id/content')
  createContent(@Param('id') id: string, @Body() dto: CreateDocumentContentDto) {
    return this.documentsService.createContent({ ...dto, documentId: id });
  }

  // 获取文档内容
  @Get(':id/content')
  findContent(@Param('id') id: string) {
    return this.documentsService.findContent(id);
  }

  // 更新文档内容
  @Patch(':id/content')
  updateContent(@Param('id') id: string, @Body() dto: UpdateDocumentContentDto) {
    return this.documentsService.updateContent(id, dto);
  }

  // ==================== 文档版本 ====================

  // 创建文档版本
  @Post(':id/versions')
  createVersion(@Param('id') id: string, @Body() dto: CreateDocumentVersionDto) {
    return this.documentsService.createVersion({ ...dto, documentId: id });
  }

  // 获取文档所有版本
  @Get(':id/versions')
  findVersions(@Param('id') id: string) {
    return this.documentsService.findVersions(id);
  }

  // 获取指定版本
  @Get(':id/versions/:versionId')
  findVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    const parsed = new Date(versionId);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('versionId is not a valid date');
    }
    return this.documentsService.findVersion(id, parsed);
  }

  // 将文档恢复到指定版本
  @Post(':id/versions/:versionId/restore')
  restoreVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    const parsed = new Date(versionId);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('versionId is not a valid date');
    }
    return this.documentsService.restoreVersion(id, parsed);
  }
}
