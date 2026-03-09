'use client';

import { useTemplateCategories } from '@/hooks/use-templates';
import { cn } from '@/utils/cn';

interface TemplateFilterProps {
  selectedCategory?: string;
  onCategoryChange: (category: string | undefined) => void;
}

export function TemplateFilter({ selectedCategory, onCategoryChange }: TemplateFilterProps) {
  const { data: categories, loading } = useTemplateCategories();

  if (loading || !categories) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange(undefined)}
        className={cn(
          'rounded-full px-4 py-2 text-sm font-medium transition-colors',
          selectedCategory === undefined
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        )}
      >
        全部
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            selectedCategory === category.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
