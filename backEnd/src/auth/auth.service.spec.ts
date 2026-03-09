// Mocks must be at the top before imports
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-nanoid-123'),
}));

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
}));

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const prismaMock = {
  users: {
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

    prismaMock.users.findUnique.mockReset();
    prismaMock.users.create.mockReset();
    prismaMock.users.update.mockReset();
    jwtMock.signAsync.mockReset();
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
});
