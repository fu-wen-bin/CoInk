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
      mockOssService.uploadBuffer.mockResolvedValueOnce('https://cdn.example.com/editor-images/user123/2024-01-01/def456.png');

      const result = await service.uploadEditorImage(mockBuffer, mockFileName, 'image/png', userId);

      expect(ossService.isEnabled).toHaveBeenCalled();
      expect(ossService.uploadBuffer).toHaveBeenCalled();
      expect(result.url).toContain('editor-images');
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
});
