import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum FriendRequestAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class RespondFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @IsEnum(FriendRequestAction)
  action: FriendRequestAction;
}

