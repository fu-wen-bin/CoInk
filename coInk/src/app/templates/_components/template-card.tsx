'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Template } from '@/types/templates';

interface TemplateCardProps {
  template: Template;
}

export function TemplateCard({ template }: TemplateCardProps) {
  return (
    <Link href={`/templates/${template.templateId}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="line-clamp-1 text-base">{template.title}</CardTitle>
                <CardDescription className="line-clamp-1 text-xs">
                  {template.category}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {template.description && (
            <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {template.description}
            </p>
          )}
          {template.tags && template.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  {tag}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  +{template.tags.length - 3}
                </span>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
            <span>{template.useCount} 次使用</span>
            {template.isOfficial && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                官方
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
