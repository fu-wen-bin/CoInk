export class User {
  userId: string;
  email?: string;
  name: string;
  passwordHash?: string;
  githubId?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
