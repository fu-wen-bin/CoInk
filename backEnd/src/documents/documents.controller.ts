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
import { UpdateDocumentContentDto, UpdateDocumentDto } from './dto/update-document.dto';

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
    if (!ownerId) {
      throw new BadRequestException('ownerId is required');
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

  // 获取星标文档
  @Get('starred')
  findStarred(@Query('ownerId') ownerId: string) {
    if (!ownerId) {
      throw new BadRequestException('ownerId is required');
    }
    return this.documentsService.findStarred(ownerId);
  }

  // 获取回收站文档
  @Get('deleted')
  findDeleted(@Query('ownerId') ownerId: string) {
    if (!ownerId) {
      throw new BadRequestException('ownerId is required');
    }
    return this.documentsService.findDeleted(ownerId);
  }

  // 通过分享 token 获取文档
  @Get('share/:shareToken')
  findByShareToken(@Param('shareToken') shareToken: string) {
    if (!shareToken) {
      throw new BadRequestException('shareToken is required');
    }
    return this.documentsService.findByShareToken(shareToken);
  }

  // 获取单个文档详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // 更新文档元数据（标题、排序、分享权限等）
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  // 星标/取消星标文档
  @Patch(':id/star')
  toggleStar(@Param('id') id: string, @Body('isStarred') isStarred?: boolean) {
    return this.documentsService.toggleStar(id, Boolean(isStarred));
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
    return this.documentsService.findVersion(parsed);
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
