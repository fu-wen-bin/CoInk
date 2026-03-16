export class Blog {
  blogId: string;
  title: string;
  summary?: string;
  content: Record<string, unknown>;
  category: string;
  tags?: string[];
  coverImage?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
