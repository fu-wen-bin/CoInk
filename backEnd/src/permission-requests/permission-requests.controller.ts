import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreatePermissionRequestDto } from './dto/create-permission-request.dto';
import { ReviewPermissionRequestDto } from './dto/review-permission-request.dto';
import { PermissionRequestsService } from './permission-requests.service';

@Controller('permission-requests')
export class PermissionRequestsController {
  constructor(private readonly permissionRequestsService: PermissionRequestsService) {}

  @Post()
  create(@Body() dto: CreatePermissionRequestDto) {
    return this.permissionRequestsService.create(dto);
  }

  @Patch(':requestId/review')
  review(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewPermissionRequestDto,
  ) {
    return this.permissionRequestsService.review(BigInt(requestId), dto.reviewerId, dto.action);
  }

  @Get('mine')
  findMine(@Query('applicantId') applicantId: string) {
    return this.permissionRequestsService.findMine(applicantId);
  }
}

