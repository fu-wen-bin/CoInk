import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  githubId?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(512)
  avatarUrl?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(512)
  websiteUrl?: string;
}
