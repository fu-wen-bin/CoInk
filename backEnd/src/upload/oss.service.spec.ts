import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OssService } from './oss.service';

// Mock ali-oss
jest.mock('ali-oss', () => {
  return jest.fn().mockImplementation(() => ({
    put: jest.fn().mockResolvedValue({ url: 'https://example.com/test-file.jpg' }),
    head: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  }));
});

describe('OssService', () => {
  let service: OssService;

  const createMockConfigService = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn((key: string) => {
      const configs: Record<string, string | undefined> = {
        OSS_REGION: 'oss-cn-hangzhou',
        OSS_ACCESS_KEY_ID: 'test-key-id',
        OSS_ACCESS_KEY_SECRET: 'test-key-secret',
        OSS_BUCKET: 'test-bucket',
        OSS_PUBLIC_BASE_URL: 'https://cdn.example.com',
        ...overrides,
      };
      return configs[key];
    }),
  });

  describe('isEnabled', () => {
    it('should return true when all required env vars are set', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when OSS_REGION is missing', async () => {
      const mockConfigService = createMockConfigService({ OSS_REGION: undefined });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      expect(service.isEnabled()).toBe(false);
    });

    it('should return false when OSS_ACCESS_KEY_ID is missing', async () => {
      const mockConfigService = createMockConfigService({ OSS_ACCESS_KEY_ID: undefined });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('uploadBuffer', () => {
    it('should upload buffer and return CDN URL when OSS_PUBLIC_BASE_URL is set', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      const buffer = Buffer.from('test content');
      const objectKey = 'test/file.jpg';
      const contentType = 'image/jpeg';

      const url = await service.uploadBuffer(objectKey, buffer, contentType);

      expect(url).toBe('https://cdn.example.com/test/file.jpg');
    });

    it('should upload buffer and return OSS URL when OSS_PUBLIC_BASE_URL is not set', async () => {
      const mockConfigService = createMockConfigService({ OSS_PUBLIC_BASE_URL: undefined });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      const buffer = Buffer.from('test content');
      const objectKey = 'test/file.jpg';
      const contentType = 'image/jpeg';

      const url = await service.uploadBuffer(objectKey, buffer, contentType);

      expect(url).toBe('https://example.com/test-file.jpg');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from OSS', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      const objectKey = 'test/file.jpg';

      await expect(service.deleteFile(objectKey)).resolves.not.toThrow();
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      await expect(service.objectExists('test/file.jpg')).resolves.toBe(true);
    });

    it('should return false when object is not found', async () => {
      const OssConstructor = jest.requireMock('ali-oss') as jest.Mock;
      OssConstructor.mockImplementationOnce(() => ({
        put: jest.fn().mockResolvedValue({ url: 'https://example.com/test-file.jpg' }),
        head: jest.fn().mockRejectedValue({ status: 404, code: 'NoSuchKey' }),
        delete: jest.fn().mockResolvedValue({}),
      }));

      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OssService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<OssService>(OssService);

      await expect(service.objectExists('test/missing.jpg')).resolves.toBe(false);
    });
  });
});
