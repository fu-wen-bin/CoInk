/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { GenerateFromTemplateDto } from './dto/generate-from-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-123'),
}));

describe('TemplatesService', () => {
  let service: TemplatesService;

  const mockTemplate = {
    template_id: 'mock-id-123',
    title: 'Test Template',
    description: 'Test Description',
    content: { type: 'doc', content: [] },
    category: 'business',
    tags: ['test', 'template'],
    thumbnail_url: null,
    is_public: true,
    is_official: false,
    creator_id: 'user-123',
    use_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    templates: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documents_info: {
      create: jest.fn(),
    },
    document_contents: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a template successfully', async () => {
      const createDto: CreateTemplateDto = {
        title: 'Test Template',
        description: 'Test Description',
        content: { type: 'doc', content: [] },
        category: 'business',
        tags: ['test'],
        creatorId: 'user-123',
      };

      mockPrismaService.templates.create.mockResolvedValue(mockTemplate);

      const result = await service.create(createDto);

      expect(mockPrismaService.templates.create).toHaveBeenCalledWith({
        data: {
          template_id: 'mock-id-123',
          title: createDto.title,
          description: createDto.description,
          content: createDto.content,
          category: createDto.category,
          tags: createDto.tags,
          thumbnail_url: undefined,
          is_public: true,
          creator_id: createDto.creatorId,
        },
      });
      expect(result.templateId).toBe('mock-id-123');
      expect(result.title).toBe(createDto.title);
    });
  });

  describe('findAll', () => {
    it('should return paginated templates', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([mockTemplate]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by category', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([mockTemplate]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      await service.findAll(1, 20, 'business');

      expect(mockPrismaService.templates.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_public: true, category: 'business' },
        }),
      );
    });
  });

  describe('search', () => {
    it('should search templates by keyword', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([mockTemplate]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      const searchDto: SearchTemplateDto = {
        keyword: 'test',
        page: 1,
        limit: 20,
      };

      const result = await service.search(searchDto);

      expect(result.templates).toHaveLength(1);
      expect(mockPrismaService.templates.findMany).toHaveBeenCalled();
    });

    it('should search templates by category', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([mockTemplate]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      const searchDto: SearchTemplateDto = {
        category: 'business',
        page: 1,
        limit: 20,
      };

      await service.search(searchDto);

      expect(mockPrismaService.templates.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'business' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a template by id', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.findOne('mock-id-123');

      expect(mockPrismaService.templates.findUnique).toHaveBeenCalledWith({
        where: { template_id: 'mock-id-123' },
      });
      expect(result.templateId).toBe('mock-id-123');
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a template successfully', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(mockTemplate);
      mockPrismaService.templates.update.mockResolvedValue({
        ...mockTemplate,
        title: 'Updated Title',
      });

      const updateDto: UpdateTemplateDto = {
        title: 'Updated Title',
      };

      const result = await service.update('mock-id-123', updateDto);

      expect(mockPrismaService.templates.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(null);

      const updateDto: UpdateTemplateDto = {
        title: 'Updated Title',
      };

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a template successfully', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(mockTemplate);
      mockPrismaService.templates.delete.mockResolvedValue(mockTemplate);

      await service.remove('mock-id-123');

      expect(mockPrismaService.templates.delete).toHaveBeenCalledWith({
        where: { template_id: 'mock-id-123' },
      });
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOfficial', () => {
    it('should return official templates', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([
        { ...mockTemplate, is_official: true },
      ]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      const result = await service.findOfficial(1, 20);

      expect(mockPrismaService.templates.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_official: true, is_public: true },
        }),
      );
      expect(result.templates).toHaveLength(1);
    });
  });

  describe('findMyTemplates', () => {
    it('should return templates by creator', async () => {
      mockPrismaService.templates.findMany.mockResolvedValue([mockTemplate]);
      mockPrismaService.templates.count.mockResolvedValue(1);

      const result = await service.findMyTemplates('user-123', 1, 20);

      expect(mockPrismaService.templates.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creator_id: 'user-123' },
        }),
      );
      expect(result.templates).toHaveLength(1);
    });
  });

  describe('getCategories', () => {
    it('should return predefined categories', () => {
      const categories = service.getCategories();

      expect(categories).toBeInstanceOf(Array);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('name');
    });
  });

  describe('generateFromTemplate', () => {
    it('should generate a document from template', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(mockTemplate);
      mockPrismaService.documents_info.create.mockResolvedValue({
        document_id: 'new-doc-id',
      });
      mockPrismaService.document_contents.create.mockResolvedValue({});
      mockPrismaService.templates.update.mockResolvedValue({
        ...mockTemplate,
        use_count: 1,
      });

      const generateDto: GenerateFromTemplateDto = {
        ownerId: 'user-123',
        title: 'My New Document',
      };

      const result = await service.generateFromTemplate('mock-id-123', generateDto);

      expect(mockPrismaService.documents_info.create).toHaveBeenCalled();
      expect(mockPrismaService.document_contents.create).toHaveBeenCalled();
      expect(mockPrismaService.templates.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { use_count: { increment: 1 } },
        }),
      );
      expect(result).toHaveProperty('documentId');
      expect(result).toHaveProperty('title');
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue(null);

      const generateDto: GenerateFromTemplateDto = {
        ownerId: 'user-123',
      };

      await expect(service.generateFromTemplate('non-existent-id', generateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if template is not public', async () => {
      mockPrismaService.templates.findUnique.mockResolvedValue({
        ...mockTemplate,
        is_public: false,
      });

      const generateDto: GenerateFromTemplateDto = {
        ownerId: 'user-123',
      };

      await expect(service.generateFromTemplate('mock-id-123', generateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
