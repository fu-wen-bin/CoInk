import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum PermissionReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ReviewPermissionRequestDto {
  @IsString()
  @IsNotEmpty()
  reviewerId: string;

  @IsEnum(PermissionReviewAction)
  action: PermissionReviewAction;
}

