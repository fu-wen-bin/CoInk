import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const jwtMock = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    jwtMock.signAsync.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('register should reject when email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ userId: 'u1', email: 'a@b.com' });

    await expect(
      service.register({ email: 'a@b.com', name: 'A', password: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login should return tokens and user on valid credentials', async () => {
    const user = {
      userId: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'hash',
      avatarUrl: null,
      websiteUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue(user);

    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
    jwtMock.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

    const result = await service.login({ email: 'a@b.com', password: '123456' });

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.user.userId).toBe('u1');
  });
});
