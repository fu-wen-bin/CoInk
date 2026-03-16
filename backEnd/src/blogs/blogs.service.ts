import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { CreateBlogDto } from './dto/create-blog.dto';
import { QueryBlogDto } from './dto/query-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { Blog } from './entities/blog.entity';

@Injectable()
export class BlogsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 博客 CRUD ====================

  async create(createBlogDto: CreateBlogDto, userId: string): Promise<Blog> {
    const blog = await this.prisma.blogs.create({
      data: {
        blog_id: nanoid(),
        title: createBlogDto.title,
        summary: createBlogDto.summary,
        content: createBlogDto.content as Prisma.InputJsonValue,
        category: createBlogDto.category,
        tags: createBlogDto.tags ?? [],
        cover_image: createBlogDto.coverImage,
        user_id: userId,
      },
    });

    return this.mapToEntity(blog);
  }

  async findAll(queryDto: QueryBlogDto): Promise<{
    blogs: Blog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, category, keyword } = queryDto;
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (keyword) {
      where.title = { contains: keyword };
    }

    const [blogs, total] = await Promise.all([
      this.prisma.blogs.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.blogs.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      blogs: blogs.map((b) => this.mapToEntity(b)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findMyBlogs(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    blogs: Blog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const [blogs, total] = await Promise.all([
      this.prisma.blogs.findMany({
        where: { user_id: userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.blogs.count({ where: { user_id: userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      blogs: blogs.map((b) => this.mapToEntity(b)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(blogId: string): Promise<Blog> {
    const blog = await this.prisma.blogs.findUnique({
      where: { blog_id: blogId },
    });

    if (!blog) {
      throw new NotFoundException('博客不存在');
    }

    return this.mapToEntity(blog);
  }

  async update(
    blogId: string,
    updateBlogDto: UpdateBlogDto,
    userId: string,
    userRole?: string,
  ): Promise<Blog> {
    const existing = await this.prisma.blogs.findUnique({
      where: { blog_id: blogId },
    });

    if (!existing) {
      throw new NotFoundException('博客不存在');
    }

    // 检查所有权或管理员权限
    if (existing.user_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('没有权限更新此博客');
    }

    const blog = await this.prisma.blogs.update({
      where: { blog_id: blogId },
      data: {
        title: updateBlogDto.title,
        summary: updateBlogDto.summary,
        content: updateBlogDto.content as Prisma.InputJsonValue | undefined,
        category: updateBlogDto.category,
        tags: updateBlogDto.tags,
        cover_image: updateBlogDto.coverImage,
        updated_at: new Date(),
      },
    });

    return this.mapToEntity(blog);
  }

  async remove(blogId: string, userId: string, userRole?: string): Promise<void> {
    const existing = await this.prisma.blogs.findUnique({
      where: { blog_id: blogId },
    });

    if (!existing) {
      throw new NotFoundException('博客不存在');
    }

    // 检查所有权或管理员权限
    if (existing.user_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('没有权限删除此博客');
    }

    await this.prisma.blogs.delete({
      where: { blog_id: blogId },
    });
  }

  // ==================== 辅助方法 ====================

  private mapToEntity(blog: {
    blog_id: string;
    title: string;
    summary: string | null;
    content: unknown;
    category: string;
    tags: unknown;
    cover_image: string | null;
    user_id: string;
    created_at: Date;
    updated_at: Date;
  }): Blog {
    return {
      blogId: blog.blog_id,
      title: blog.title,
      summary: blog.summary ?? undefined,
      content: blog.content as Record<string, unknown>,
      category: blog.category,
      tags: (blog.tags as string[]) ?? undefined,
      coverImage: blog.cover_image ?? undefined,
      userId: blog.user_id,
      createdAt: blog.created_at,
      updatedAt: blog.updated_at,
    };
  }
}
