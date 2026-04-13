'use client';

import { useState, useCallback, useEffect } from 'react';

import { toastError, toastSuccess } from '@/utils/toast';
import authApi from '@/services/auth';

export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
  code: string;
}

export function useSimpleAuthForm() {
  // 表单数据状态
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });

  // 错误状态
  const [errors, setErrors] = useState<Partial<Record<keyof AuthFormData, string>>>({});

  // UI 状态
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // 更新字段值
  const updateField = useCallback(
    <K extends keyof AuthFormData>(field: K, value: AuthFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // 清除该字段的错误
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  // 验证邮箱格式
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 设置字段错误
  const setFieldError = useCallback((field: keyof AuthFormData, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  // 清除所有错误
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // 验证整个表单（注册模式）
  const validateRegisterForm = (): boolean => {
    const newErrors: Partial<Record<keyof AuthFormData, string>> = {};

    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少为6位';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 验证登录表单
  const validateLoginForm = (): boolean => {
    const newErrors: Partial<Record<keyof AuthFormData, string>> = {};

    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setTimeout(() => {
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!formData.email) {
      toastError('请先输入邮箱地址');
      return;
    }

    if (!validateEmail(formData.email)) {
      toastError('请输入有效的邮箱地址');
      return;
    }

    setIsSendingCode(true);
    try {
      const { data, error } = await authApi.sendEmailCode({
        email: formData.email,
      });

      if (error) {
        toastError(error);
        return;
      }

      if (!data || data.code !== 200 || !data.data?.success) {
        toastError(data?.message || '验证码发送失败，请稍后重试');
        return;
      }

      setCountdown(data.data.cooldownSeconds ?? 60);
      toastSuccess('验证码已发送，请前往邮箱查收');
    } catch (error) {
      toastError(error instanceof Error ? error.message : '发送验证码失败，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 重置表单
  const resetForm = useCallback((keepEmail = true) => {
    setFormData((prev) => ({
      email: keepEmail ? prev.email : '',
      password: '',
      confirmPassword: '',
      code: '',
    }));
    setErrors({});
  }, []);

  return {
    // 表单数据
    formData,
    updateField,
    // 错误
    errors,
    setFieldError,
    clearErrors,
    // 验证
    validateRegisterForm,
    validateLoginForm,
    // UI 状态
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    countdown,
    setCountdown,
    isSendingCode,
    // 操作
    handleSendCode,
    resetForm,
  };
}
