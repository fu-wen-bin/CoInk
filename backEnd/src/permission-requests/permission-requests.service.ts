import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  permission_requests_status,
  permission_requests_target_permission,
} from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionRequestDto } from './dto/create-permission-request.dto';
import { PermissionReviewAction } from './dto/review-permission-request.dto';

@Injectable()
export class PermissionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreatePermissionRequestDto) {
    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: dto.documentId },
    });

    if (!doc || doc.is_deleted) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.owner_id === dto.applicantId) {
      throw new BadRequestException('文档所有者无需申请权限');
    }

    const existingPending = await this.prisma.permission_requests.findFirst({
      where: {
        document_id: dto.documentId,
        applicant_id: dto.applicantId,
        status: permission_requests_status.pending,
      },
    });

    if (existingPending) {
      throw new BadRequestException('已有待处理的申请，请勿重复提交');
    }

    const created = await this.prisma.permission_requests.create({
      data: {
        document_id: dto.documentId,
        applicant_id: dto.applicantId,
        target_permission: dto.targetPermission,
        message: dto.message ?? null,
        status: permission_requests_status.pending,
        reviewer_id: doc.owner_id,
      },
    });

    await this.notificationsService.createAndPush({
      userId: doc.owner_id,
      requestId: created.request_id,
      type: 'PERMISSION_REQUEST_CREATED',
      payload: {
        documentId: dto.documentId,
        applicantId: dto.applicantId,
        targetPermission: dto.targetPermission,
        message: dto.message ?? '',
      },
      event: 'permission.request.created',
    });

    return {
      requestId: created.request_id.toString(),
      status: created.status,
      documentId: created.document_id,
      applicantId: created.applicant_id,
      targetPermission: created.target_permission,
      message: created.message,
      createdAt: created.created_at,
    };
  }

  async review(requestId: bigint, reviewerId: string, action: PermissionReviewAction) {
    const row = await this.prisma.permission_requests.findUnique({
      where: { request_id: requestId },
    });

    if (!row) {
      throw new NotFoundException('权限申请不存在');
    }

    if (row.status !== permission_requests_status.pending) {
      throw new BadRequestException('该申请已处理');
    }

    const doc = await this.prisma.documents_info.findUnique({
      where: { document_id: row.document_id },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    if (doc.owner_id !== reviewerId) {
      throw new ForbiddenException('仅文档所有者可处理申请');
    }

    const nextStatus =
      action === PermissionReviewAction.APPROVE
        ? permission_requests_status.approved
        : permission_requests_status.rejected;

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.permission_requests.update({
        where: { request_id: requestId },
        data: {
          status: nextStatus,
          reviewer_id: reviewerId,
          updated_at: new Date(),
        },
      });

      if (nextStatus === permission_requests_status.approved) {
        await tx.document_principals.upsert({
          where: {
            document_id_principal_type_principal_id: {
              document_id: req.document_id,
              principal_type: 'user',
              principal_id: req.applicant_id,
            },
          },
          update: {
            permission: req.target_permission,
            granted_by: reviewerId,
            updated_at: new Date(),
          },
          create: {
            document_id: req.document_id,
            principal_type: 'user',
            principal_id: req.applicant_id,
            permission: req.target_permission,
            granted_by: reviewerId,
          },
        });
      }

      return req;
    });

    await this.notificationsService.createAndPush({
      userId: updated.applicant_id,
      requestId: updated.request_id,
      type: 'PERMISSION_REQUEST_REVIEWED',
      payload: {
        documentId: updated.document_id,
        status: updated.status,
        targetPermission: updated.target_permission,
      },
      event: 'permission.request.reviewed',
    });

    return {
      requestId: updated.request_id.toString(),
      status: updated.status,
      documentId: updated.document_id,
      applicantId: updated.applicant_id,
      targetPermission: updated.target_permission,
      updatedAt: updated.updated_at,
    };
  }

  async findMine(applicantId: string) {
    const rows = await this.prisma.permission_requests.findMany({
      where: { applicant_id: applicantId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return rows.map((row) => ({
      requestId: row.request_id.toString(),
      documentId: row.document_id,
      applicantId: row.applicant_id,
      targetPermission: row.target_permission,
      status: row.status,
      message: row.message,
      reviewerId: row.reviewer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // 链接权限开启时取最高权限： direct/group/link
  normalizePermission(
    directOrGroup: permission_requests_target_permission | null,
    linkPermission: 'view' | 'edit' | 'close' | null,
  ): permission_requests_target_permission | null {
    if (!directOrGroup) {
      if (linkPermission === 'view') return permission_requests_target_permission.view;
      if (linkPermission === 'edit') return permission_requests_target_permission.edit;
      return null;
    }

    if (linkPermission === 'view') {
      return directOrGroup;
    }

    if (linkPermission === 'edit') {
      const rank = {
        view: 1,
        comment: 2,
        edit: 3,
        manage: 4,
        full: 5,
      } as const;

      return rank[directOrGroup] >= rank.edit
        ? directOrGroup
        : permission_requests_target_permission.edit;
    }

    return directOrGroup;
  }
}
