import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUserId } from '../common/decorators';
import { CheckFileDto, CompleteFileDto, UploadChunkDto } from './dto';
import { UploadService, UploadStatus } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

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
   * 上传头像
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUserId() userId: string) {
    if (!file) {
      throw new BadRequestException('头像文件不能为空');
    }

    return this.uploadService.uploadAvatar(file.buffer, file.originalname, file.mimetype, userId);
  }
}
