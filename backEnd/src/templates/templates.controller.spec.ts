/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { CreateTemplateDto } from './dto/create-template.dto';
import { GenerateFromTemplateDto } from './dto/generate-from-template.dto';
import { SearchTemplateDto } from './dto/search-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

// Mock nanoid before importing the module
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-123'),
}));

describe('TemplatesController', () => {
  let controller: TemplatesController;
  let service: TemplatesService;

  const mockTemplate = {
    templateId: 'mock-id-123',
    title: 'Test Template',
    description: 'Test Description',
    content: { type: 'doc', content: [] },
    category: 'business',
    tags: ['test'],
    isPublic: true,
    isOfficial: false,
    creatorId: 'user-123',
    useCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTemplatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findOfficial: jest.fn(),
    findMyTemplates: jest.fn(),
    getCategories: jest.fn(),
    generateFromTemplate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    }).compile();

    controller = module.get<TemplatesController>(TemplatesController);
    service = module.get<TemplatesService>(TemplatesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a template', async () => {
      const createDto: CreateTemplateDto = {
        title: 'New Template',
        content: { type: 'doc', content: [] },
        category: 'business',
        creatorId: 'user-123',
      };

      mockTemplatesService.create.mockResolvedValue(mockTemplate);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockTemplatesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should accept pagination params', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 2,
        limit: 10,
      };

      mockTemplatesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll('2', '10', 'business');

      expect(service.findAll).toHaveBeenCalledWith(2, 10, 'business');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('search', () => {
    it('should search templates', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockTemplatesService.search.mockResolvedValue(mockResponse);

      const searchDto: SearchTemplateDto = {
        keyword: 'test',
        page: 1,
        limit: 20,
      };

      const result = await controller.search(searchDto);

      expect(service.search).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOfficial', () => {
    it('should return official templates', async () => {
      const mockResponse = {
        templates: [{ ...mockTemplate, isOfficial: true }],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockTemplatesService.findOfficial.mockResolvedValue(mockResponse);

      const result = await controller.findOfficial();

      expect(service.findOfficial).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCategories', () => {
    it('should return categories', () => {
      const mockCategories = [{ id: 'business', name: '商务', description: '商务文档' }];

      mockTemplatesService.getCategories.mockReturnValue(mockCategories);

      const result = controller.getCategories();

      expect(service.getCategories).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });
  });

  describe('findMyTemplates', () => {
    it('should return my templates', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockTemplatesService.findMyTemplates.mockResolvedValue(mockResponse);

      const result = await controller.findMyTemplates('user-123');

      expect(service.findMyTemplates).toHaveBeenCalledWith('user-123', 1, 20);
      expect(result).toEqual(mockResponse);
    });

    it('should return error if creatorId is missing', async () => {
      const result = await controller.findMyTemplates('');

      expect(result).toEqual({
        code: '0',
        message: 'creatorId is required',
        data: null,
      });
    });
  });

  describe('findOne', () => {
    it('should return a template by id', async () => {
      mockTemplatesService.findOne.mockResolvedValue(mockTemplate);

      const result = await controller.findOne('mock-id-123');

      expect(service.findOne).toHaveBeenCalledWith('mock-id-123');
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      const updateDto: UpdateTemplateDto = {
        title: 'Updated Title',
      };

      mockTemplatesService.update.mockResolvedValue({
        ...mockTemplate,
        title: 'Updated Title',
      });

      const result = await controller.update('mock-id-123', updateDto);

      expect(service.update).toHaveBeenCalledWith('mock-id-123', updateDto);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('remove', () => {
    it('should remove a template', async () => {
      mockTemplatesService.remove.mockResolvedValue(undefined);

      await controller.remove('mock-id-123');

      expect(service.remove).toHaveBeenCalledWith('mock-id-123');
    });
  });

  describe('generateFromTemplate', () => {
    it('should generate document from template', async () => {
      const mockResult = {
        documentId: 'new-doc-id',
        title: 'Generated Document',
      };

      mockTemplatesService.generateFromTemplate.mockResolvedValue(mockResult);

      const generateDto: GenerateFromTemplateDto = {
        ownerId: 'user-123',
        title: 'My Document',
      };

      const result = await controller.generateFromTemplate('mock-id-123', generateDto);

      expect(service.generateFromTemplate).toHaveBeenCalledWith('mock-id-123', generateDto);
      expect(result).toEqual(mockResult);
    });
  });
});
