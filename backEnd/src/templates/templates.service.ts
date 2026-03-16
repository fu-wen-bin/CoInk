import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { GenerateFromTemplateDto } from './dto/generate-from-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Template } from './entities/template.entity';

// 预定义的分类列表
const TEMPLATE_CATEGORIES = [
  { id: 'business', name: '商务', description: '商务文档模板', icon: 'briefcase' },
  { id: 'education', name: '教育', description: '学习笔记、教案模板', icon: 'book' },
  { id: 'personal', name: '个人', description: '日记、计划模板', icon: 'user' },
  { id: 'project', name: '项目', description: '项目管理、需求文档模板', icon: 'folder' },
  { id: 'meeting', name: '会议', description: '会议纪要、议程模板', icon: 'users' },
  { id: 'other', name: '其他', description: '其他类型模板', icon: 'file' },
];

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 模板 CRUD ====================

  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    const template = await this.prisma.templates.create({
      data: {
        template_id: nanoid(),
        title: createTemplateDto.title,
        description: createTemplateDto.description,
        content: createTemplateDto.content as Prisma.InputJsonValue,
        category: createTemplateDto.category,
        tags: createTemplateDto.tags ?? [],
        thumbnail_url: createTemplateDto.thumbnailUrl,
        is_public: createTemplateDto.isPublic ?? true,
        creator_id: createTemplateDto.creatorId,
      },
    });

    return this.mapToEntity(template);
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    category?: string,
  ): Promise<{ templates: Template[]; total: number; page: number; limit: number }> {
    const where: Record<string, unknown> = { is_public: true };
    if (category) {
      where.category = category;
    }

    const [templates, total] = await Promise.all([
      this.prisma.templates.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ is_official: 'desc' }, { use_count: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.templates.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapToEntity(t)),
      total,
      page,
      limit,
    };
  }

  async search(searchDto: SearchTemplateDto): Promise<{
    templates: Template[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { keyword, category, tags, page = 1, limit = 20 } = searchDto;

    const where: Record<string, unknown> = { is_public: true };

    if (keyword) {
      where.title = { contains: keyword };
    }

    if (category) {
      where.category = category;
    }

    if (tags && tags.length > 0) {
      // 使用 JSON 包含查询标签
      where.AND = tags.map((tag) => ({
        tags: { path: '$', array_contains: tag },
      }));
    }

    const [templates, total] = await Promise.all([
      this.prisma.templates.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ use_count: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.templates.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapToEntity(t)),
      total,
      page,
      limit,
    };
  }

  async findOne(templateId: string): Promise<Template> {
    const template = await this.prisma.templates.findUnique({
      where: { template_id: templateId },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    return this.mapToEntity(template);
  }

  async update(templateId: string, updateTemplateDto: UpdateTemplateDto): Promise<Template> {
    const existing = await this.prisma.templates.findUnique({
      where: { template_id: templateId },
    });

    if (!existing) {
      throw new NotFoundException('模板不存在');
    }

    const template = await this.prisma.templates.update({
      where: { template_id: templateId },
      data: {
        title: updateTemplateDto.title,
        description: updateTemplateDto.description,
        content: updateTemplateDto.content as Prisma.InputJsonValue | undefined,
        category: updateTemplateDto.category,
        tags: updateTemplateDto.tags,
        thumbnail_url: updateTemplateDto.thumbnailUrl,
        is_public: updateTemplateDto.isPublic,
        is_official: updateTemplateDto.isOfficial,
        updated_at: new Date(),
      },
    });

    return this.mapToEntity(template);
  }

  async remove(templateId: string): Promise<void> {
    const existing = await this.prisma.templates.findUnique({
      where: { template_id: templateId },
    });

    if (!existing) {
      throw new NotFoundException('模板不存在');
    }

    await this.prisma.templates.delete({
      where: { template_id: templateId },
    });
  }

  // ==================== 特殊查询 ====================

  async findOfficial(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    templates: Template[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [templates, total] = await Promise.all([
      this.prisma.templates.findMany({
        where: { is_official: true, is_public: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ use_count: 'desc' }, { created_at: 'desc' }],
      }),
      this.prisma.templates.count({ where: { is_official: true, is_public: true } }),
    ]);

    return {
      templates: templates.map((t) => this.mapToEntity(t)),
      total,
      page,
      limit,
    };
  }

  async findMyTemplates(
    creatorId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    templates: Template[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [templates, total] = await Promise.all([
      this.prisma.templates.findMany({
        where: { creator_id: creatorId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.templates.count({ where: { creator_id: creatorId } }),
    ]);

    return {
      templates: templates.map((t) => this.mapToEntity(t)),
      total,
      page,
      limit,
    };
  }

  getCategories(): typeof TEMPLATE_CATEGORIES {
    return TEMPLATE_CATEGORIES;
  }

  /**
   * 获取项目介绍模板
   * 优先从数据库获取官方项目模板，如果没有则返回默认模板
   */
  async getProjectIntroduction(): Promise<Template> {
    // 首先尝试从数据库获取官方的项目模板
    const template = await this.prisma.templates.findFirst({
      where: {
        category: 'meeting',
        is_official: true,
        is_public: true,
      },
      orderBy: {
        use_count: 'desc',
      },
    });

    if (template) {
      return this.mapToEntity(template);
    }

    // 如果没有找到，返回默认模板
    return {
      templateId: 'default-project-intro',
      title: '项目介绍',
      description: '默认的项目介绍模板',
      category: 'project',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '项目名称' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '在这里输入项目描述...' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '项目目标' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '描述项目的主要目标...' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '关键特性' }] },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '特性 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '特性 2' }] }] },
            ],
          },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '开始使用' }] },
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '创建你的第一个文档' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '邀请团队成员协作' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '分享你的作品' }] }] },
            ],
          },
        ],
      },
      isPublic: true,
      isOfficial: true,
      creatorId: 'system',
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ==================== 从模板生成文档 ====================

  async generateFromTemplate(
    templateId: string,
    generateDto: GenerateFromTemplateDto,
  ): Promise<{ documentId: string; title: string }> {
    const template = await this.prisma.templates.findUnique({
      where: { template_id: templateId },
    });

    if (!template) {
      throw new NotFoundException('模板不存在');
    }

    if (!template.is_public) {
      throw new BadRequestException('该模板未公开，无法使用');
    }

    const documentId = nanoid();
    const title = generateDto.title || `${template.title} (副本)`;

    // 创建文档元数据
    await this.prisma.documents_info.create({
      data: {
        document_id: documentId,
        title,
        type: 'FILE',
        owner_id: generateDto.ownerId,
        parent_id: generateDto.parentId || null,
        is_starred: false,
        sort_order: 0,
        is_deleted: false,
        share_token: nanoid(),
        link_permission: 'close',
      },
    });

    // 创建文档内容（从模板复制）
    await this.prisma.document_contents.create({
      data: {
        document_id: documentId,
        content: template.content as Prisma.InputJsonValue,
        updated_by: generateDto.ownerId,
      },
    });

    // 增加模板使用次数
    await this.prisma.templates.update({
      where: { template_id: templateId },
      data: { use_count: { increment: 1 } },
    });

    return { documentId, title };
  }

  // ==================== 辅助方法 ====================

  private mapToEntity(template: {
    template_id: string;
    title: string;
    description: string | null;
    content: unknown;
    category: string;
    tags: unknown;
    thumbnail_url: string | null;
    is_public: boolean;
    is_official: boolean;
    creator_id: string;
    use_count: number;
    created_at: Date;
    updated_at: Date;
  }): Template {
    return {
      templateId: template.template_id,
      title: template.title,
      description: template.description ?? undefined,
      content: template.content as Record<string, unknown>,
      category: template.category,
      tags: (template.tags as string[]) ?? undefined,
      thumbnailUrl: template.thumbnail_url ?? undefined,
      isPublic: template.is_public,
      isOfficial: template.is_official,
      creatorId: template.creator_id,
      useCount: template.use_count,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
  }
}
