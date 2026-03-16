import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUserId, CurrentUserRole } from '../common/decorators/current-user.decorator';

import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { QueryBlogDto } from './dto/query-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Controller('blog')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  // ==================== 博客 CRUD ====================

  /**
   * 获取博客列表（支持分页、分类筛选）
   */
  @Get()
  findAll(@Query() queryDto: QueryBlogDto) {
    return this.blogsService.findAll(queryDto);
  }

  /**
   * 获取博客详情
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blogsService.findOne(id);
  }

  /**
   * 获取我的博客
   */
  @Get('my-blogs')
  findMyBlogs(
    @CurrentUserId() userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.blogsService.findMyBlogs(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * 创建博客
   */
  @Post()
  create(@Body() createBlogDto: CreateBlogDto, @CurrentUserId() userId: string) {
    return this.blogsService.create(createBlogDto, userId);
  }

  /**
   * 更新博客
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @CurrentUserId() userId: string,
    @CurrentUserRole() userRole: string,
  ) {
    return this.blogsService.update(id, updateBlogDto, userId, userRole);
  }

  /**
   * 删除博客
   */
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @CurrentUserRole() userRole: string,
  ) {
    return this.blogsService.remove(id, userId, userRole);
  }
}
