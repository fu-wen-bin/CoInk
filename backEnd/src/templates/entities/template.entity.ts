export class Template {
  templateId: string;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  category: string;
  tags?: string[];
  thumbnailUrl?: string;
  isPublic: boolean;
  isOfficial: boolean;
  creatorId: string;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}
