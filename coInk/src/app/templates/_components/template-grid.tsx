'use client';

import { FileX } from 'lucide-react';

import { TemplateCard } from './template-card';

import type { Template } from '@/types/templates';

interface TemplateGridProps {
  templates: Template[];
  loading?: boolean;
  emptyText?: string;
}

export function TemplateGrid({ templates, loading, emptyText = '暂无模板' }: TemplateGridProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <FileX className="h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <TemplateCard key={template.templateId} template={template} />
      ))}
    </div>
  );
}
