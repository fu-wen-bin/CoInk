// JWT Payload 实体
export class JwtPayload {
  userId: string;
  email?: string;
  name: string;
  tokenType?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// 登录响应实体
export class AuthResponse {
  accessToken: string;
  refreshToken?: string;
  githubToken?: string;
  user: {
    userId: string;
    email?: string;
    name: string;
    avatarUrl?: string;
    websiteUrl?: string;
    location?: string;
    company?: string;
    bio?: string;
    githubId?: string;
    githubUsername?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// 保留原有的 Auth 实体用于兼容
export class Auth {
  userId: string;
  email?: string;
  name: string;
  passwordHash?: string;
  githubId?: number;
  avatarUrl?: string;
  websiteUrl?: string;
  location?: string;
  company?: string;
  bio?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
