import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { OssService } from './oss.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(function(event, callback) {
      if (event === 'finish') callback();
      return this;
    }),
    destroy: jest.fn(),
  })),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
  renameSync: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash'),
  }),
}));

describe('UploadService - OSS Integration', () => {
  let service: UploadService;
  let ossService: OssService;
  let prismaService: PrismaService;

  const mockOssService = {
    isEnabled: jest.fn().mockReturnValue(true),
    isDirectUploadEnabled: jest.fn().mockReturnValue(true),
    objectExists: jest.fn().mockResolvedValue(false),
    buildPublicObjectUrl: jest
      .fn()
      .mockImplementation((objectKey: string) => `https://cdn.example.com/${objectKey}`),
    createEditorImageDirectUploadCredential: jest
      .fn()
      .mockImplementation(async (_userId: string, objectKey: string) => ({
        accessKeyId: 'sts-access-key-id',
        accessKeySecret: 'sts-access-key-secret',
        securityToken: 'sts-security-token',
        expiration: '2099-01-01T00:00:00Z',
        region: 'oss-cn-hangzhou',
        bucket: 'test-bucket',
        endpoint: 'oss-cn-hangzhou.aliyuncs.com',
        authorizationV4: true,
        partSize: 524288,
        parallel: 3,
        objectKey,
        url: `https://cdn.example.com/${objectKey}`,
      })),
    uploadBuffer: jest.fn().mockResolvedValue('https://cdn.example.com/avatars/user123/2024-01-01/abc123.jpg'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    files: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    users: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: OssService,
          useValue: mockOssService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    ossService = module.get<OssService>(OssService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAvatar', () => {
    const userId = 'user123';
    const mockBuffer = Buffer.from('fake-image-data');
    const mockFileName = 'avatar.jpg';

    it('should upload avatar to OSS when OSS is enabled', async () => {
      const result = await service.uploadAvatar(mockBuffer, mockFileName, 'image/jpeg', userId);

      expect(ossService.isEnabled).toHaveBeenCalled();
      expect(ossService.uploadBuffer).toHaveBeenCalled();
      expect(prismaService.users.update).toHaveBeenCalledWith({
        where: { user_id: userId },
        data: { avatar_url: 'https://cdn.example.com/avatars/user123/2024-01-01/abc123.jpg' },
      });
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://cdn.example.com/avatars/user123/2024-01-01/abc123.jpg');
    });

    it('should throw ServiceUnavailableException when OSS is not enabled', async () => {
      mockOssService.isEnabled.mockReturnValueOnce(false);

      await expect(
        service.uploadAvatar(mockBuffer, mockFileName, 'image/jpeg', userId),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw BadRequestException for invalid mime type', async () => {
      await expect(
        service.uploadAvatar(mockBuffer, mockFileName, 'application/pdf', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for file size exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(
        service.uploadAvatar(largeBuffer, mockFileName, 'image/jpeg', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid image formats', async () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      for (const mimeType of validTypes) {
        mockOssService.uploadBuffer.mockResolvedValueOnce(`https://cdn.example.com/${mimeType.replace('/', '-')}.jpg`);

        const result = await service.uploadAvatar(mockBuffer, mockFileName, mimeType, userId);

        expect(result.success).toBe(true);
      }
    });
  });

  describe('uploadEditorImage', () => {
    const userId = 'user123';
    const mockBuffer = Buffer.from('fake-image-data');
    const mockFileName = 'editor-image.png';

    it('should upload editor image to OSS', async () => {
      mockOssService.uploadBuffer.mockResolvedValueOnce(
        'https://cdn.example.com/editor-images/user123/sha256/mock-hash',
      );

      const result = await service.uploadEditorImage(mockBuffer, mockFileName, 'image/png', userId);

      expect(ossService.isEnabled).toHaveBeenCalled();
      expect(ossService.objectExists).toHaveBeenCalledWith('editor-images/user123/sha256/mock-hash');
      expect(ossService.uploadBuffer).toHaveBeenCalledWith(
        'editor-images/user123/sha256/mock-hash',
        mockBuffer,
        'image/png',
        { forbidOverwrite: true },
      );
      expect(result.url).toContain('editor-images');
    });

    it('should return existing url without uploading when same content already exists', async () => {
      mockOssService.objectExists.mockResolvedValueOnce(true);

      const result = await service.uploadEditorImage(mockBuffer, mockFileName, 'image/png', userId);

      expect(ossService.objectExists).toHaveBeenCalledWith('editor-images/user123/sha256/mock-hash');
      expect(ossService.uploadBuffer).not.toHaveBeenCalled();
      expect(result.url).toBe('https://cdn.example.com/editor-images/user123/sha256/mock-hash');
    });

    it('should throw BadRequestException for invalid image format', async () => {
      await expect(
        service.uploadEditorImage(mockBuffer, mockFileName, 'application/pdf', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for image size exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      await expect(
        service.uploadEditorImage(largeBuffer, mockFileName, 'image/png', userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createEditorImageDirectUploadSession', () => {
    const userId = 'user123';
    const mockFileName = 'editor-image.png';
    const fileSize = 1024;
    const contentHash = 'a'.repeat(64);

    it('should create direct upload session when STS direct upload is enabled', async () => {
      const result = await service.createEditorImageDirectUploadSession(
        fileSize,
        mockFileName,
        'image/png',
        contentHash,
        userId,
      );

      expect(ossService.isDirectUploadEnabled).toHaveBeenCalled();
      expect(ossService.objectExists).toHaveBeenCalledWith(`editor-images/${userId}/sha256/${contentHash}`);
      expect(ossService.createEditorImageDirectUploadCredential).toHaveBeenCalledWith(
        userId,
        `editor-images/${userId}/sha256/${contentHash}`,
      );
      expect(result.alreadyExists).toBe(false);
      if (result.alreadyExists) {
        throw new Error('unexpected alreadyExists=true');
      }
      expect(result.securityToken).toBe('sts-security-token');
      expect(result.objectKey).toBe(`editor-images/${userId}/sha256/${contentHash}`);
    });

    it('should short-circuit when hashed object already exists', async () => {
      mockOssService.objectExists.mockResolvedValueOnce(true);

      const result = await service.createEditorImageDirectUploadSession(
        fileSize,
        mockFileName,
        'image/png',
        contentHash,
        userId,
      );

      expect(result).toEqual({
        alreadyExists: true,
        objectKey: `editor-images/${userId}/sha256/${contentHash}`,
        url: `https://cdn.example.com/editor-images/${userId}/sha256/${contentHash}`,
      });
      expect(ossService.createEditorImageDirectUploadCredential).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid contentHash', async () => {
      await expect(
        service.createEditorImageDirectUploadSession(fileSize, mockFileName, 'image/png', 'not-sha256', userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ServiceUnavailableException when STS direct upload is disabled', async () => {
      mockOssService.isDirectUploadEnabled.mockReturnValueOnce(false);

      await expect(
        service.createEditorImageDirectUploadSession(
          fileSize,
          mockFileName,
          'image/png',
          contentHash,
          userId,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
