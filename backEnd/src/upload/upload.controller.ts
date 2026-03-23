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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { CurrentUserId } from '../common/decorators';
import { CheckFileDto, CompleteFileDto, UploadChunkDto } from './dto';
import { UploadService, UploadStatus } from './upload.service';

const EDITOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** 与编辑器内嵌图片共用 `/upload/avatar` 时的上限 */
const AVATAR_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

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
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(@UploadedFile() file: Express.Multer.File, @Query() dto: UploadChunkDto) {
    if (!file) {
      throw new BadRequestException('分片文件不能为空');
    }

    return this.uploadService.uploadChunk(
      dto.fileId,
      dto.chunkIndex,
      dto.totalChunks,
      dto.fileHash,
      file.buffer,
    );
  }

  /**
   * 合并分片完成上传
   */
  @Post('complete-file')
  async completeFile(@Body() dto: CompleteFileDto, @CurrentUserId() userId: string) {
    return this.uploadService.completeFile(dto, userId);
  }

  /**
   * 取消上传
   */
  @Delete('cancel/:fileId')
  async cancelUpload(@Param('fileId') fileId: string, @CurrentUserId() userId: string) {
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

    const accessToken =
      typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : undefined;
    if (!accessToken) {
      throw new UnauthorizedException('请先登录后再上传图片');
    }

    const verified = await this.authService.verifyToken(accessToken);
    if (!verified.valid || !verified.payload?.userId) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    return this.uploadService.uploadEditorImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      verified.payload.userId,
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
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUserId() userId: string) {
    if (!file) {
      throw new BadRequestException('头像文件不能为空');
    }

    return this.uploadService.uploadAvatar(file.buffer, file.originalname, file.mimetype, userId);
  }
}
