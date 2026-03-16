import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateTemplateDto } from './dto/create-template.dto';
import { GenerateFromTemplateDto } from './dto/generate-from-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ==================== 模板 CRUD ====================

  /**
   * 创建模板
   */
  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(createTemplateDto);
  }

  /**
   * 获取公开模板列表
   */
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.templatesService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      category,
    );
  }

  /**
   * 搜索模板
   */
  @Get('search')
  search(@Query() searchDto: SearchTemplateDto) {
    return this.templatesService.search(searchDto);
  }

  /**
   * 获取官方推荐模板
   */
  @Get('official')
  findOfficial(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.templatesService.findOfficial(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * 获取模板分类列表
   */
  @Get('categories')
  getCategories() {
    return this.templatesService.getCategories();
  }

  /**
   * 获取我的模板列表
   */
  @Get('my')
  findMyTemplates(
    @Query('creatorId') creatorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!creatorId) {
      return {
        code: '0',
        message: 'creatorId is required',
        data: null,
      };
    }
    return this.templatesService.findMyTemplates(
      creatorId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * 获取项目介绍模板
   */
  @Get('project-introduction')
  async getProjectIntroduction() {
    const template = await this.templatesService.getProjectIntroduction();
    return {
      code: 200,
      message: 'success',
      data: {
        id: template.templateId,
        name: template.title,
        description: template.description,
        category: template.category,
        content: template.content,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 获取模板详情
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  /**
   * 更新模板
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  /**
   * 删除模板
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  // ==================== 从模板生成 ====================

  /**
   * 从模板生成文档
   */
  @Post(':id/generate')
  generateFromTemplate(@Param('id') id: string, @Body() generateDto: GenerateFromTemplateDto) {
    return this.templatesService.generateFromTemplate(id, generateDto);
  }
}
