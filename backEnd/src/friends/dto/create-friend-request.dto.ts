import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  requesterId: string;

  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  message?: string;
}

