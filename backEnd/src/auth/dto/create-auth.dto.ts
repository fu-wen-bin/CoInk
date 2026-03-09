import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// 邮箱密码登录 DTO
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(255)
  password: string;
}

// 邮箱密码注册 DTO
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(255)
  password: string;
}

// GitHub OAuth 登录 DTO
export class GithubLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

// GitHub 用户信息 DTO (从 GitHub API 获取)
export class GithubUserDto {
  @IsNotEmpty()
  githubId: number;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  htmlUrl?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}

// 刷新 Token DTO
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// 保留原有的 CreateAuthDto 用于兼容
export class CreateAuthDto extends RegisterDto {}
