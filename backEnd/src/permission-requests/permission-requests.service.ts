import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  permission_requests_status,
  permission_requests_target_permission,
} from '../../generated/prisma/enums';
import { document_principals_permission } from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionRequestDto } from './dto/create-permission-request.dto';
import { PermissionReviewAction } from './dto/review-permission-request.dto';

@Injectable()
export class PermissionRequestsService {
  private readonly logger = new Logger(PermissionRequestsService.name);

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

    const targetPermission = this.normalizeTargetPermission(dto.targetPermission);

    const created = await this.prisma.permission_requests.create({
      data: {
        document_id: dto.documentId,
        applicant_id: dto.applicantId,
        target_permission: targetPermission,
        message: dto.message ?? null,
        status: permission_requests_status.pending,
        // 审批人由 owner + manage 动态决定，创建时不预绑定单一 reviewer
        reviewer_id: null,
      },
    });

    const reviewerIds = await this.resolveReviewerIds(dto.documentId, doc.owner_id);
    const notifyReviewerIds = reviewerIds.filter((uid) => uid !== dto.applicantId);

    this.logger.log(
      `权限申请通知目标 requestDoc=${dto.documentId} applicant=${dto.applicantId} recipients=${notifyReviewerIds.join(',') || 'none'}`,
    );

    const notifyResults = await Promise.allSettled(
      notifyReviewerIds.map((uid) =>
        this.notificationsService.createAndPush({
          userId: uid,
          requestId: created.request_id,
          type: 'PERMISSION_REQUEST_CREATED',
          payload: {
            documentId: dto.documentId,
            documentTitle: doc.title,
            applicantId: dto.applicantId,
            targetPermission,
            message: dto.message ?? '',
          },
          event: 'permission.request.created',
        }),
      ),
    );

    const failedReviewerIds = notifyResults
      .map((result, idx) => (result.status === 'rejected' ? notifyReviewerIds[idx] : null))
      .filter((id): id is string => Boolean(id));
    if (failedReviewerIds.length > 0) {
      this.logger.warn(
        `权限申请通知部分发送失败 requestId=${created.request_id.toString()} recipients=${failedReviewerIds.join(',')}`,
      );
    }

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

    const reviewerIds = await this.resolveReviewerIds(row.document_id, doc.owner_id);
    if (!reviewerIds.includes(reviewerId)) {
      throw new ForbiddenException('仅文档所有者或文档管理者可处理申请');
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
        const grantedPermission = this.normalizeTargetPermission(req.target_permission);
        await tx.document_principals.upsert({
          where: {
            document_id_principal_type_principal_id: {
              document_id: req.document_id,
              principal_type: 'user',
              principal_id: req.applicant_id,
            },
          },
          update: {
            permission: grantedPermission,
            granted_by: reviewerId,
            updated_at: new Date(),
          },
          create: {
            document_id: req.document_id,
            principal_type: 'user',
            principal_id: req.applicant_id,
            permission: grantedPermission,
            granted_by: reviewerId,
          },
        });
      }

      return req;
    });

    const relatedDoc = await this.prisma.documents_info.findUnique({
      where: { document_id: updated.document_id },
      select: { title: true },
    });

    await this.notificationsService.createAndPush({
      userId: updated.applicant_id,
      requestId: updated.request_id,
      type: 'PERMISSION_REQUEST_REVIEWED',
      payload: {
        documentId: updated.document_id,
        documentTitle: relatedDoc?.title ?? '',
        status: updated.status,
        targetPermission: this.normalizeTargetPermission(updated.target_permission),
      },
      event: 'permission.request.reviewed',
    });

    return {
      requestId: updated.request_id.toString(),
      status: updated.status,
      documentId: updated.document_id,
      applicantId: updated.applicant_id,
      targetPermission: this.normalizeTargetPermission(updated.target_permission),
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
      targetPermission: this.normalizeTargetPermission(row.target_permission),
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
      } as const;

      return rank[directOrGroup] >= rank.edit
        ? this.normalizeTargetPermission(directOrGroup)
        : permission_requests_target_permission.edit;
    }

    return this.normalizeTargetPermission(directOrGroup);
  }

  private normalizeTargetPermission(
    permission: permission_requests_target_permission,
  ): permission_requests_target_permission {
    return permission;
  }

  private hasManageTierPermission(
    permission: document_principals_permission | permission_requests_target_permission,
  ): boolean {
    return permission === 'manage';
  }

  private async resolveReviewerIds(documentId: string, ownerId: string): Promise<string[]> {
    const principals = await this.prisma.document_principals.findMany({
      where: { document_id: documentId },
      select: {
        principal_type: true,
        principal_id: true,
        permission: true,
      },
    });

    const directUserReviewerIds = principals
      .filter((p) => p.principal_type === 'user' && this.hasManageTierPermission(p.permission))
      .map((p) => p.principal_id);

    const manageGroupIds = principals
      .filter((p) => p.principal_type === 'group' && this.hasManageTierPermission(p.permission))
      .map((p) => p.principal_id);

    let groupMemberReviewerIds: string[] = [];
    if (manageGroupIds.length > 0) {
      const memberships = await this.prisma.group_members.findMany({
        where: {
          group_id: { in: manageGroupIds },
        },
        select: { user_id: true },
      });
      groupMemberReviewerIds = memberships.map((m) => m.user_id);
    }

    return [...new Set([ownerId, ...directUserReviewerIds, ...groupMemberReviewerIds])];
  }
}
