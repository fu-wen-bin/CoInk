import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { friend_requests_status } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FriendRequestAction } from './dto/respond-friend-request.dto';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendRequest(dto: CreateFriendRequestDto) {
    if (dto.requesterId === dto.receiverId) {
      throw new BadRequestException('不能添加自己为好友');
    }

    const users = await this.prisma.users.findMany({
      where: { user_id: { in: [dto.requesterId, dto.receiverId] } },
      select: { user_id: true },
    });

    if (users.length < 2) {
      throw new NotFoundException('用户不存在');
    }

    const existed = await this.prisma.friends.findUnique({
      where: {
        user_id_friend_id: {
          user_id: dto.requesterId,
          friend_id: dto.receiverId,
        },
      },
    });

    if (existed) {
      throw new BadRequestException('你们已经是好友');
    }

    const pending = await this.prisma.friend_requests.findFirst({
      where: {
        status: friend_requests_status.pending,
        OR: [
          { requester_id: dto.requesterId, receiver_id: dto.receiverId },
          { requester_id: dto.receiverId, receiver_id: dto.requesterId },
        ],
      },
    });

    if (pending) {
      throw new BadRequestException('已存在待处理好友申请');
    }

    const row = await this.prisma.friend_requests.create({
      data: {
        requester_id: dto.requesterId,
        receiver_id: dto.receiverId,
        message: dto.message ?? null,
        status: friend_requests_status.pending,
      },
    });

    await this.notificationsService.createAndPush({
      userId: dto.receiverId,
      requestId: row.request_id,
      type: 'FRIEND_REQUEST_CREATED',
      payload: {
        requesterId: dto.requesterId,
        receiverId: dto.receiverId,
        message: row.message,
      },
      event: 'friend.request.created',
    });

    return {
      requestId: row.request_id.toString(),
      requesterId: row.requester_id,
      receiverId: row.receiver_id,
      status: row.status,
      message: row.message,
      createdAt: row.created_at,
    };
  }

  async respondRequest(requestId: bigint, receiverId: string, action: FriendRequestAction) {
    const row = await this.prisma.friend_requests.findUnique({
      where: { request_id: requestId },
    });

    if (!row) {
      throw new NotFoundException('好友申请不存在');
    }

    if (row.receiver_id !== receiverId) {
      throw new ForbiddenException('无权处理该好友申请');
    }

    if (row.status !== friend_requests_status.pending) {
      throw new BadRequestException('该好友申请已处理');
    }

    const next =
      action === FriendRequestAction.APPROVE
        ? friend_requests_status.approved
        : friend_requests_status.rejected;

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.friend_requests.update({
        where: { request_id: requestId },
        data: {
          status: next,
          updated_at: new Date(),
        },
      });

      if (next === friend_requests_status.approved) {
        await tx.friends.upsert({
          where: {
            user_id_friend_id: {
              user_id: req.requester_id,
              friend_id: req.receiver_id,
            },
          },
          update: {},
          create: {
            user_id: req.requester_id,
            friend_id: req.receiver_id,
          },
        });

        await tx.friends.upsert({
          where: {
            user_id_friend_id: {
              user_id: req.receiver_id,
              friend_id: req.requester_id,
            },
          },
          update: {},
          create: {
            user_id: req.receiver_id,
            friend_id: req.requester_id,
          },
        });
      }

      return req;
    });

    await this.notificationsService.createAndPush({
      userId: updated.requester_id,
      requestId: updated.request_id,
      type: 'FRIEND_REQUEST_REVIEWED',
      payload: {
        requesterId: updated.requester_id,
        receiverId: updated.receiver_id,
        status: updated.status,
      },
      event: 'friend.request.reviewed',
    });

    return {
      requestId: updated.request_id.toString(),
      requesterId: updated.requester_id,
      receiverId: updated.receiver_id,
      status: updated.status,
      updatedAt: updated.updated_at,
    };
  }

  async findFriends(userId: string) {
    const rows = await this.prisma.friends.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    if (rows.length === 0) {
      return [];
    }

    const users = await this.prisma.users.findMany({
      where: { user_id: { in: rows.map((r) => r.friend_id) } },
      select: {
        user_id: true,
        name: true,
        email: true,
        avatar_url: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.user_id, u]));

    return rows.map((row) => {
      const user = userMap.get(row.friend_id);
      return {
        userId: row.friend_id,
        name: user?.name ?? row.friend_id,
        email: user?.email ?? null,
        avatarUrl: user?.avatar_url ?? null,
        addedAt: row.created_at,
      };
    });
  }

  async findRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friend_requests.findMany({
        where: { receiver_id: userId },
        orderBy: { created_at: 'desc' },
        take: 100,
      }),
      this.prisma.friend_requests.findMany({
        where: { requester_id: userId },
        orderBy: { created_at: 'desc' },
        take: 100,
      }),
    ]);

    return {
      incoming: incoming.map((row) => ({
        requestId: row.request_id.toString(),
        requesterId: row.requester_id,
        receiverId: row.receiver_id,
        status: row.status,
        message: row.message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      outgoing: outgoing.map((row) => ({
        requestId: row.request_id.toString(),
        requesterId: row.requester_id,
        receiverId: row.receiver_id,
        status: row.status,
        message: row.message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }
}

