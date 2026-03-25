'use client';

import { useState } from 'react';
import { ShieldX, Home, ArrowLeft, KeyRound, ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { permissionRequestsApi, type PermissionLevel } from '@/services/permission-requests';
import { toastError, toastSuccess } from '@/utils/toast';

interface NoPermissionProps {
  documentId?: string;
  documentTitle?: string;
  message?: string;
}

// 权限选项配置
const permissionOptions: { value: PermissionLevel; label: string; description: string }[] = [
  { value: 'view', label: '查看权限', description: '只能查看文档，无法编辑' },
  { value: 'comment', label: '评论权限', description: '可查看和添加评论' },
  { value: 'edit', label: '编辑权限', description: '可编辑文档内容' },
  { value: 'manage', label: '完全管理', description: '可管理文档设置、分享与协作者权限' },
];

export default function NoPermission({ documentId, documentTitle, message }: NoPermissionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>('edit');
  const [showPermissionMenu, setShowPermissionMenu] = useState(false);

  const handleRequestPermission = async () => {
    if (!documentId) return;

    const cached = localStorage.getItem('cached_user_profile');
    let parsed: { userId?: string } | null;
    try {
      parsed = cached ? (JSON.parse(cached) as { userId?: string }) : null;
    } catch {
      parsed = null;
    }
    const applicantId = parsed?.userId ?? '';

    if (!applicantId) {
      toastError('请先登录后再申请权限');
      return;
    }

    const selectedOption = permissionOptions.find((opt) => opt.value === selectedPermission);

    setSubmitting(true);
    const { error } = await permissionRequestsApi.create({
      documentId,
      applicantId,
      targetPermission: selectedPermission,
      message: `申请${selectedOption?.label}`,
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess('权限申请已发送，请等待文档所有者处理');
  };

  const selectedOption = permissionOptions.find((opt) => opt.value === selectedPermission);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          {/* 图标 */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/10 rounded-full blur-xl animate-pulse"></div>
              <div className="relative bg-red-100 dark:bg-red-950 rounded-full p-6">
                <ShieldX className="w-16 h-16 text-red-600 dark:text-red-400" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* 标题 */}
          <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-3">
            无法访问文档
          </h1>

          {/* 描述信息 */}
          <div className="text-center space-y-2 mb-8">
            {documentTitle && (
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                文档：<span className="text-slate-900 dark:text-slate-100">{documentTitle}</span>
              </p>
            )}
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {message || '您没有访问此文档的权限。如需访问，请选择需要的权限类型并发送申请。'}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-3">
            <Button asChild className="w-full" size="lg">
              <Link href="/docs">
                <Home className="w-4 h-4 mr-2" />
                返回文档列表
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首页
              </Link>
            </Button>

            {documentId && (
              <div className="space-y-2">
                {/* 权限类型选择 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPermissionMenu(!showPermissionMenu)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {selectedOption?.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedOption?.description}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${showPermissionMenu ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* 下拉菜单 */}
                  {showPermissionMenu && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg">
                      {permissionOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSelectedPermission(option.value);
                            setShowPermissionMenu(false);
                          }}
                          className={`w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            selectedPermission === option.value
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                              : 'border-l-4 border-l-transparent'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {option.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {option.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 申请按钮 */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleRequestPermission}
                  disabled={submitting}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {submitting ? '发送中...' : `索要${selectedOption?.label}`}
                </Button>
              </div>
            )}
          </div>

          {/* 提示信息 */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              如果您认为这是一个错误，请联系系统管理员
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
