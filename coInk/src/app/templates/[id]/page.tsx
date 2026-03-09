'use client';

import { ArrowLeft, Copy, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { TemplatePreview } from '../_components/template-preview';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTemplate } from '@/hooks/use-templates';
import { templatesApi } from '@/services/templates';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const { data: template, loading, error } = useTemplate(templateId);
  const [generating, setGenerating] = useState(false);

  const handleUseTemplate = async () => {
    try {
      setGenerating(true);
      // TODO: 获取当前用户 ID
      const ownerId = 'temp-user-id'; // 需要从 auth 获取

      const { data: result, error } = await templatesApi.generateFromTemplate(templateId, {
        ownerId,
      });

      if (error) {
        throw new Error(error);
      }

      // 跳转到新创建的文档
      if (result?.data?.documentId) {
        router.push(`/documents/${result.data.documentId}`);
      }
    } catch (err) {
      console.error('Failed to generate document from template:', err);
      // TODO: 显示错误提示
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mb-6 h-10 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-96 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            模板不存在或已删除
          </h2>
          <Link href="/templates">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回模板市场
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Link href="/templates">
        <Button variant="ghost" className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          返回模板市场
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Template Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{template.title}</CardTitle>
              {template.description && <CardDescription>{template.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileText className="h-4 w-4" />
                <span className="capitalize">{template.category}</span>
              </div>

              {template.tags && template.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-4">
                <Button className="w-full gap-2" onClick={handleUseTemplate} disabled={generating}>
                  <Copy className="h-4 w-4" />
                  {generating ? '生成中...' : '使用模板'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Template Preview */}
        <div className="lg:col-span-2">
          <TemplatePreview content={template.content} />
        </div>
      </div>
    </div>
  );
}
