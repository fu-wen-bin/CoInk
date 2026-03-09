import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '模板市场 - CoInk',
  description: '浏览和使用各种文档模板',
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>;
}
