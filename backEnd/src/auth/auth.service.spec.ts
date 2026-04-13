// Mocks must be at the top before imports
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-nanoid-123'),
}));

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
}));

import * as argon2 from 'argon2';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

const prismaMock = {
  users: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  email_login_codes: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const jwtMock = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const emailServiceMock = {
  sendLoginCode: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    prismaMock.users.findUnique.mockReset();
    prismaMock.users.create.mockReset();
    prismaMock.users.update.mockReset();
    prismaMock.email_login_codes.findFirst.mockReset();
    prismaMock.email_login_codes.create.mockReset();
    prismaMock.email_login_codes.delete.mockReset();
    prismaMock.email_login_codes.update.mockReset();
    prismaMock.email_login_codes.updateMany.mockReset();
    jwtMock.signAsync.mockReset();
    jwtMock.verifyAsync.mockReset();
    emailServiceMock.sendLoginCode.mockReset();
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
    (argon2.verify as jest.Mock).mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('register should reject when email already exists', async () => {
    prismaMock.users.findUnique.mockResolvedValue({ user_id: 'u1', email: 'a@b.com' });

    await expect(
      service.register({ email: 'a@b.com', name: 'A', password: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login should return tokens and user on valid credentials', async () => {
    const user = {
      user_id: 'u1',
      email: 'a@b.com',
      name: 'A',
      password_hash: 'hash',
      avatar_url: null,
      website_url: null,
      github_id: null,
      github_username: null,
      location: null,
      company: null,
      bio: null,
      role: 'USER',
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    prismaMock.users.findUnique.mockResolvedValue(user);
    prismaMock.users.update.mockResolvedValue(user);

    jwtMock.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

    const result = await service.login({ email: 'a@b.com', password: '123456' });

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.user.userId).toBe('u1');
  });

  it('sendEmailCode should create code and send email', async () => {
    prismaMock.email_login_codes.findFirst.mockResolvedValue(null);
    prismaMock.email_login_codes.create.mockResolvedValue({
      code_id: 1n,
      created_at: new Date(),
    });
    emailServiceMock.sendLoginCode.mockResolvedValue(undefined);

    const result = await service.sendEmailCode(
      { email: 'User@Example.com' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result).toEqual({ success: true, cooldownSeconds: 60 });
    expect(prismaMock.email_login_codes.create).toHaveBeenCalled();
    expect(emailServiceMock.sendLoginCode).toHaveBeenCalledTimes(1);
    expect(emailServiceMock.sendLoginCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        expiresInMinutes: 10,
      }),
    );
  });

  it('sendEmailCode should skip resend during cooldown', async () => {
    prismaMock.email_login_codes.findFirst.mockResolvedValue({
      created_at: new Date(Date.now() - 30 * 1000),
    });

    const result = await service.sendEmailCode({ email: 'user@example.com' });

    expect(result).toEqual({ success: true, cooldownSeconds: 60 });
    expect(prismaMock.email_login_codes.create).not.toHaveBeenCalled();
    expect(emailServiceMock.sendLoginCode).not.toHaveBeenCalled();
  });

  it('emailCodeLogin should auto-register first-time user', async () => {
    prismaMock.email_login_codes.findFirst.mockResolvedValue({
      code_id: 2n,
      code_hash: 'hashed-code',
      attempt_count: 0,
      max_attempts: 5,
      used_at: null,
      expires_at: new Date(Date.now() + 60 * 1000),
      created_at: new Date(),
    });
    prismaMock.email_login_codes.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.users.findUnique.mockResolvedValue(null);
    prismaMock.users.create.mockResolvedValue({
      user_id: 'u-new',
      email: 'new@example.com',
      name: 'new',
      password_hash: null,
      avatar_url: null,
      website_url: null,
      github_id: null,
      github_username: null,
      location: null,
      company: null,
      bio: null,
      role: 'USER',
      last_login_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    jwtMock.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

    const result = await service.emailCodeLogin({
      email: 'new@example.com',
      code: '123456',
    });

    expect(result.isNewUser).toBe(true);
    expect(result.accessToken).toBe('access');
    expect(prismaMock.users.create).toHaveBeenCalledTimes(1);
  });

  it('emailCodeLogin should login existing user', async () => {
    prismaMock.email_login_codes.findFirst.mockResolvedValue({
      code_id: 3n,
      code_hash: 'hashed-code',
      attempt_count: 0,
      max_attempts: 5,
      used_at: null,
      expires_at: new Date(Date.now() + 60 * 1000),
      created_at: new Date(),
    });
    prismaMock.email_login_codes.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.users.findUnique.mockResolvedValue({
      user_id: 'u-old',
      email: 'old@example.com',
    });
    prismaMock.users.update.mockResolvedValue({
      user_id: 'u-old',
      email: 'old@example.com',
      name: 'old',
      password_hash: null,
      avatar_url: null,
      website_url: null,
      github_id: null,
      github_username: null,
      location: null,
      company: null,
      bio: null,
      role: 'USER',
      last_login_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    jwtMock.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

    const result = await service.emailCodeLogin({
      email: 'old@example.com',
      code: '654321',
    });

    expect(result.isNewUser).toBe(false);
    expect(prismaMock.users.update).toHaveBeenCalledTimes(1);
  });

  it('emailCodeLogin should increase attempt count on invalid code', async () => {
    prismaMock.email_login_codes.findFirst.mockResolvedValue({
      code_id: 4n,
      code_hash: 'hashed-code',
      attempt_count: 0,
      max_attempts: 5,
      used_at: null,
      expires_at: new Date(Date.now() + 60 * 1000),
      created_at: new Date(),
    });
    (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

    await expect(service.emailCodeLogin({ email: 'x@x.com', code: '000000' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaMock.email_login_codes.update).toHaveBeenCalledWith({
      where: { code_id: 4n },
      data: { attempt_count: { increment: 1 } },
    });
  });
});

