import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('requests')
  sendRequest(@Body() dto: CreateFriendRequestDto) {
    return this.friendsService.sendRequest(dto);
  }

  @Patch('requests/:requestId/respond')
  respond(
    @Param('requestId') requestId: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.friendsService.respondRequest(BigInt(requestId), dto.receiverId, dto.action);
  }

  @Get()
  findFriends(@Query('userId') userId: string) {
    return this.friendsService.findFriends(userId);
  }

  @Get('requests')
  findRequests(@Query('userId') userId: string) {
    return this.friendsService.findRequests(userId);
  }
}

