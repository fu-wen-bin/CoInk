import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * 创建权限组
   */
  @Post()
  create(@Body() createGroupDto: CreateGroupDto) {
    return this.groupsService.create(createGroupDto);
  }

  /**
   * 获取我拥有的权限组
   */
  @Get('owned')
  findOwnedGroups(@Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.groupsService.findByOwner(userId);
  }

  /**
   * 获取权限组详情
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  /**
   * 更新权限组
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Body('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.groupsService.update(id, updateGroupDto, userId);
  }

  /**
   * 删除权限组
   */
  @Delete(':id')
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.groupsService.remove(id, userId);
  }

  // ==================== 成员管理 ====================

  /**
   * 获取组成员列表
   */
  @Get(':id/members')
  findMembers(@Param('id') id: string) {
    return this.groupsService.findMembers(id);
  }

  /**
   * 添加成员
   */
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body('targetUserId') targetUserId: string,
    @Body('userId') userId: string,
  ) {
    if (!targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.groupsService.addMember(id, targetUserId, userId);
  }

  /**
   * 移除成员
   */
  @Delete(':id/members/:targetUserId')
  removeMember(
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.groupsService.removeMember(id, targetUserId, userId);
  }
}
