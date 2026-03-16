import { IsString, IsNotEmpty } from 'class-validator';

export class CheckFileDto {
  @IsString()
  @IsNotEmpty()
  fileHash: string;
}
