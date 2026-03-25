import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据 userId 获取用户信息（兼容前端 /user/info 接口）
   */
  async getInfo(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        name: true,
        email: true,
        avatar_url: true,
        bio: true,
        company: true,
        location: true,
        website_url: true,
        github_id: true,
        github_username: true,
        role: true,
        created_at: true,
        updated_at: true,
        last_login_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        company: user.company,
        location: user.location,
        websiteUrl: user.website_url,
        githubId: user.github_id ? user.github_id.toString() : null,
        githubUsername: user.github_username,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 搜索用户（支持按名称、邮箱模糊搜索）
   * @param query 搜索关键词
   * @param limit 返回数量限制
   */
  async search(query: string, limit = 10) {
    if (!query) return [];

    return this.prisma.users.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
          { github_username: { contains: query } },
        ],
      },
      take: limit,
      select: {
        user_id: true,
        name: true,
        email: true,
        avatar_url: true,
      },
    });
  }
}
