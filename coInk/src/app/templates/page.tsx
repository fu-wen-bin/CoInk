'use client';

import { useState } from 'react';
import { FilePlus, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { TemplateFilter } from './_components/template-filter';
import { TemplateGrid } from './_components/template-grid';
import { TemplateSearch } from './_components/template-search';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOfficialTemplates, useTemplates } from '@/hooks/use-templates';

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allTemplates, loading: allLoading } = useTemplates({
    category: selectedCategory,
    page: 1,
    limit: 20,
  });

  const { data: officialTemplates, loading: officialLoading } = useOfficialTemplates({
    page: 1,
    limit: 10,
  });

  const handleCategoryChange = (category: string | undefined) => {
    setSelectedCategory(category);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // 如果有搜索关键词，可以跳转到搜索结果页面或在本页显示搜索结果
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">模板市场</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            浏览和使用各种文档模板，快速开始您的工作
          </p>
        </div>
        <Link href="/documents/new">
          <Button className="gap-2">
            <FilePlus className="h-4 w-4" />
            新建文档
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <TemplateSearch onSearch={handleSearch} />
      </div>

      {/* Category Filter */}
      <div className="mb-8">
        <TemplateFilter
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">全部模板</TabsTrigger>
          <TabsTrigger value="official" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            官方推荐
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <TemplateGrid
            templates={allTemplates?.templates ?? []}
            loading={allLoading}
            emptyText="暂无模板，尝试选择其他分类"
          />
        </TabsContent>

        <TabsContent value="official">
          <TemplateGrid
            templates={officialTemplates?.templates ?? []}
            loading={officialLoading}
            emptyText="暂无官方推荐模板"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
