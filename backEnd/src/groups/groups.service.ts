import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group } from './entities/group.entity';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建权限组
   */
  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    const groupId = nanoid();

    const group = await this.prisma.groups.create({
      data: {
        group_id: groupId,
        name: createGroupDto.name,
        owner_id: createGroupDto.ownerId,
      },
    });

    // 自动将创建者添加为成员
    await this.prisma.group_members.create({
      data: {
        group_id: groupId,
        user_id: createGroupDto.ownerId,
      },
    });

    return this.mapToGroup(group);
  }

  /**
   * 获取用户的所有权限组
   */
  async findByUser(userId: string): Promise<Group[]> {
    // 获取用户作为成员的组
    const memberships = await this.prisma.group_members.findMany({
      where: { user_id: userId },
    });

    const groupIds = memberships.map((m) => m.group_id);

    const groups = await this.prisma.groups.findMany({
      where: {
        group_id: { in: groupIds },
      },
      orderBy: { created_at: 'desc' },
    });

    return groups.map((g) => this.mapToGroup(g));
  }

  /**
   * 获取用户拥有的权限组
   */
  async findByOwner(ownerId: string): Promise<Group[]> {
    const groups = await this.prisma.groups.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' },
    });

    return groups.map((g) => this.mapToGroup(g));
  }

  /**
   * 获取权限组详情
   */
  async findOne(groupId: string): Promise<Group> {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    return this.mapToGroup(group);
  }

  /**
   * 更新权限组
   */
  async update(groupId: string, updateGroupDto: UpdateGroupDto, userId: string): Promise<Group> {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    // 只有所有者可以更新
    if (group.owner_id !== userId) {
      throw new ForbiddenException('没有权限更新此权限组');
    }

    const updated = await this.prisma.groups.update({
      where: { group_id: groupId },
      data: {
        name: updateGroupDto.name,
      },
    });

    return this.mapToGroup(updated);
  }

  /**
   * 删除权限组
   */
  async remove(groupId: string, userId: string): Promise<void> {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    // 只有所有者可以删除
    if (group.owner_id !== userId) {
      throw new ForbiddenException('没有权限删除此权限组');
    }

    // 删除所有成员关系
    await this.prisma.group_members.deleteMany({
      where: { group_id: groupId },
    });

    // 删除权限组
    await this.prisma.groups.delete({
      where: { group_id: groupId },
    });
  }

  /**
   * 添加组成员
   */
  async addMember(groupId: string, targetUserId: string, userId: string): Promise<void> {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    // 只有所有者可以添加成员
    if (group.owner_id !== userId) {
      throw new ForbiddenException('没有权限添加成员');
    }

    // 检查用户是否已在组中
    const existing = await this.prisma.group_members.findUnique({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: targetUserId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('用户已在权限组中');
    }

    await this.prisma.group_members.create({
      data: {
        group_id: groupId,
        user_id: targetUserId,
      },
    });
  }

  /**
   * 移除组成员
   */
  async removeMember(groupId: string, targetUserId: string, userId: string): Promise<void> {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    // 只有所有者可以移除成员（不能移除自己）
    if (group.owner_id !== userId) {
      throw new ForbiddenException('没有权限移除成员');
    }

    if (targetUserId === group.owner_id) {
      throw new BadRequestException('不能移除权限组所有者');
    }

    await this.prisma.group_members.deleteMany({
      where: {
        group_id: groupId,
        user_id: targetUserId,
      },
    });
  }

  /**
   * 获取组成员列表
   */
  async findMembers(groupId: string) {
    const group = await this.prisma.groups.findUnique({
      where: { group_id: groupId },
    });

    if (!group) {
      throw new NotFoundException('权限组不存在');
    }

    const members = await this.prisma.group_members.findMany({
      where: { group_id: groupId },
      orderBy: { joined_at: 'asc' },
    });

    // 获取所有用户信息
    const userIds = members.map((m) => m.user_id);
    const users = await this.prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: {
        user_id: true,
        name: true,
        avatar_url: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.user_id, u]));

    return members.map((m) => {
      const user = userMap.get(m.user_id);
      return {
        userId: m.user_id,
        name: user?.name,
        avatarUrl: user?.avatar_url,
        email: user?.email,
        joinedAt: m.joined_at,
        isOwner: m.user_id === group.owner_id,
      };
    });
  }

  /**
   * 映射数据库模型到实体
   */
  private mapToGroup(group: {
    group_id: string;
    name: string;
    owner_id: string;
    created_at: Date;
  }): Group {
    return {
      groupId: group.group_id,
      name: group.name,
      ownerId: group.owner_id,
      createdAt: group.created_at,
    };
  }
}
