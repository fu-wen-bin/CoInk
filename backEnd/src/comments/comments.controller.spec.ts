// Mock nanoid before imports
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-nanoid-123'),
}));

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { CommentDetailController, CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

const prismaMock = {
  document_comments: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  documents_info: {
    findUnique: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('CommentsController', () => {
  let controller: CommentsController;
  let detailController: CommentDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController, CommentDetailController],
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    detailController = module.get<CommentDetailController>(CommentDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('detail controller should be defined', () => {
    expect(detailController).toBeDefined();
  });
});
