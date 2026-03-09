'use client';

import { useCallback, useEffect, useState } from 'react';

import { templatesApi } from '@/services/templates';
import type {
  GetMyTemplatesParams,
  SearchTemplatesParams,
  Template,
  TemplatesListResponse,
} from '@/services/templates';

/**
 * 获取模板列表 Hook
 */
export function useTemplates(options?: { page?: number; limit?: number; category?: string }) {
  const [data, setData] = useState<TemplatesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data: result, error } = await templatesApi.getTemplates(options);
      if (error) {
        throw new Error(error);
      }
      setData(result?.data ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch templates'));
    } finally {
      setLoading(false);
    }
  }, [options?.page, options?.limit, options?.category]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  return { data, loading, error, refetch: fetchTemplates };
}

/**
 * 搜索模板 Hook
 */
export function useSearchTemplates(params: SearchTemplatesParams) {
  const [data, setData] = useState<TemplatesListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (searchParams: SearchTemplatesParams) => {
    try {
      setLoading(true);
      const { data: result, error } = await templatesApi.searchTemplates(searchParams);
      if (error) {
        throw new Error(error);
      }
      setData(result?.data ?? null);
      setError(null);
      return result?.data ?? null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to search templates');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (params.keyword || params.category || (params.tags && params.tags.length > 0)) {
      void search(params);
    }
  }, [params.keyword, params.category, params.tags?.join(','), params.page, params.limit]);

  return { data, loading, error, search };
}

/**
 * 获取模板详情 Hook
 */
export function useTemplate(id?: string) {
  const [data, setData] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const { data: result, error } = await templatesApi.getTemplate(id);
        if (error) {
          throw new Error(error);
        }
        setData(result?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch template'));
      } finally {
        setLoading(false);
      }
    };

    void fetchTemplate();
  }, [id]);

  return { data, loading, error };
}

/**
 * 获取官方模板 Hook
 */
export function useOfficialTemplates(options?: { page?: number; limit?: number }) {
  const [data, setData] = useState<TemplatesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const { data: result, error } = await templatesApi.getOfficialTemplates(options);
        if (error) {
          throw new Error(error);
        }
        setData(result?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch official templates'));
      } finally {
        setLoading(false);
      }
    };

    void fetchTemplates();
  }, [options?.page, options?.limit]);

  return { data, loading, error };
}

/**
 * 获取我的模板 Hook
 */
export function useMyTemplates(creatorId?: string, options?: { page?: number; limit?: number }) {
  const [data, setData] = useState<TemplatesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const params: GetMyTemplatesParams = { creatorId, ...options };
        const { data: result, error } = await templatesApi.getMyTemplates(params);
        if (error) {
          throw new Error(error);
        }
        setData(result?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch my templates'));
      } finally {
        setLoading(false);
      }
    };

    void fetchTemplates();
  }, [creatorId, options?.page, options?.limit]);

  return { data, loading, error };
}

/**
 * 获取模板分类 Hook
 */
export function useTemplateCategories() {
  const [data, setData] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    icon?: string;
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const { data: result, error } = await templatesApi.getCategories();
        if (error) {
          throw new Error(error);
        }
        setData(result?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch categories'));
      } finally {
        setLoading(false);
      }
    };

    void fetchCategories();
  }, []);

  return { data, loading, error };
}
