import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { CheckFileDto, CompleteFileDto, UploadChunkDto } from './dto';
import { EditorImageDirectUploadSession, UploadService, UploadStatus } from './upload.service';

const EDITOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** 与编辑器内嵌图片共用 `/upload/avatar` 时的上限 */
const AVATAR_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 秒传检查
   */
  @Get('check-file')
  async checkFile(@Query() query: CheckFileDto) {
    return this.uploadService.checkFile(query.fileHash);
  }

  /**
   * 获取已上传分片信息
   */
  @Get('chunk-info/:fileId')
  async getChunkInfo(@Param('fileId') fileId: string) {
    return this.uploadService.getChunkInfo(fileId);
  }

  /**
   * 上传分片
   */
  @Post('chunk')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'chunk', maxCount: 1 },
      { name: 'file', maxCount: 1 }, // 兼容旧字段名
    ]),
  )
  async uploadChunk(
    @UploadedFiles()
    files: {
      chunk?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
    @Body() body: Partial<UploadChunkDto>,
    @Query() query: Partial<UploadChunkDto>,
  ) {
    const file = files?.chunk?.[0] ?? files?.file?.[0];
    if (!file) {
      throw new BadRequestException('分片文件不能为空');
    }

    const payload = { ...query, ...body };
    const fileId = this.requireString(payload.fileId, 'fileId');
    const fileHash = this.requireString(payload.fileHash, 'fileHash');
    const chunkIndex = this.requireInt(
      payload.chunkIndex ?? payload.chunkNumber,
      'chunkIndex/chunkNumber',
      0,
    );
    const totalChunks = this.requireInt(payload.totalChunks, 'totalChunks', 1);
    const chunkHash = this.optionalString(payload.chunkHash);

    return this.uploadService.uploadChunk(
      fileId,
      chunkIndex,
      totalChunks,
      fileHash,
      file.buffer,
      chunkHash,
    );
  }

  /**
   * 合并分片完成上传
   */
  @Post('complete-file')
  async completeFile(@Body() dto: CompleteFileDto, @Req() req: Request) {
    const userId = await this.requireUserId(req, '请先登录后再完成上传');
    const fileSize = this.requireInt(dto.fileSize ?? dto.totalSize, 'fileSize/totalSize', 1);
    const totalChunks =
      dto.totalChunks === undefined ? undefined : this.requireInt(dto.totalChunks, 'totalChunks', 1);

    return this.uploadService.completeFile(
      {
        ...dto,
        fileSize,
        totalChunks,
      },
      userId,
    );
  }

  /**
   * 取消上传
   */
  @Delete('cancel/:fileId')
  async cancelUpload(@Param('fileId') fileId: string, @Req() req: Request) {
    const userId = await this.requireUserId(req, '请先登录后再取消上传');
    return this.uploadService.cancelUpload(fileId, userId);
  }

  /**
   * 获取上传状态
   */
  @Get('status/:fileId')
  async getUploadStatus(@Param('fileId') fileId: string): Promise<UploadStatus | null> {
    return this.uploadService.getUploadStatus(fileId);
  }

  /**
   * 编辑器图片上传（阿里云 OSS）
   * 需登录：从 HTTP-Only Cookie `access_token` 校验 JWT
   */
  @Post('editor-image/sts')
  async createEditorImageDirectUploadSession(
    @Body() body: { fileName?: unknown; mimeType?: unknown; fileSize?: unknown; contentHash?: unknown },
    @Req() req: Request,
  ): Promise<EditorImageDirectUploadSession> {
    const userId = await this.requireUserId(req, '请先登录后再上传图片');
    const fileName = this.requireString(body.fileName, 'fileName');
    const mimeType = this.requireString(body.mimeType, 'mimeType');
    const fileSize = this.requireInt(body.fileSize, 'fileSize', 1);
    const contentHash = this.requireSha256Hex(body.contentHash, 'contentHash');

    return this.uploadService.createEditorImageDirectUploadSession(
      fileSize,
      fileName,
      mimeType,
      contentHash,
      userId,
    );
  }

  @Post('editor-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: EDITOR_IMAGE_MAX_BYTES },
    }),
  )
  async uploadEditorImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('图片文件不能为空');
    }

    const userId = await this.requireUserId(req, '请先登录后再上传图片');

    return this.uploadService.uploadEditorImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
    );
  }

  /**
   * 上传头像
   */
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_UPLOAD_MAX_BYTES },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('头像文件不能为空');
    }

    const userId = await this.requireUserId(req, '请先登录后再上传头像');

    return this.uploadService.uploadAvatar(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
    );
  }

  private requireString(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
      throw new BadRequestException(`${fieldName} 不能为空`);
    }
    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private requireInt(value: unknown, fieldName: string, min: number): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min) {
      throw new BadRequestException(`${fieldName} 必须是大于等于 ${min} 的整数`);
    }
    return parsed;
  }

  private requireSha256Hex(value: unknown, fieldName: string): string {
    const normalized = this.requireString(value, fieldName).toLowerCase();
    if (!SHA256_HEX_REGEX.test(normalized)) {
      throw new BadRequestException(`${fieldName} 必须是 64 位小写十六进制 sha256`);
    }
    return normalized;
  }

  private async requireUserId(req: Request, missingTokenMessage: string): Promise<string> {
    const accessToken =
      typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : undefined;
    if (!accessToken) {
      throw new UnauthorizedException(missingTokenMessage);
    }

    const verified = await this.authService.verifyToken(accessToken);
    if (!verified.valid || !verified.payload?.userId) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    return verified.payload.userId;
  }
}
