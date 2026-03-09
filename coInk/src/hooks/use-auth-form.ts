import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import authApi from '@/services/auth';
import { LoginFormData } from '@/utils/auth-schemas';
import { LoginMode } from '@/app/auth/_components/login-mode-switcher';

export const useAuthForm = (loginMode: LoginMode) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // 使用 ref 存储上一次的 loginMode，避免重复重置表单
  const prevLoginModeRef = useRef<LoginMode>(loginMode);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      code: '',
      confirmPassword: '',
    },
  });

  // 当 loginMode 改变时重置表单和错误
  useEffect(() => {
    // 只有当 loginMode 真正改变时才重置表单
    if (prevLoginModeRef.current === loginMode) {
      return;
    }

    // 更新 ref
    prevLoginModeRef.current = loginMode;

    // 保留当前已输入的邮箱，清空其他字段
    const currentEmail = getValues('email') || '';

    reset({
      email: currentEmail,
      password: '',
      code: '',
      confirmPassword: '',
    });
    clearErrors();
    // 注意：依赖数组中不要包含 reset/clearErrors/getValues，避免重复触发
  }, [loginMode]);

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    const email = getValues('email');

    if (!email) {
      toast.error('请先输入邮箱地址');

      return;
    }

    const emailSchema = z.string().email();
    const emailValidation = emailSchema.safeParse(email);

    if (!emailValidation.success) {
      toast.error('请输入有效的邮箱地址');

      return;
    }

    setIsSendingCode(true);

    try {
      // 注意：后端暂无发送验证码接口，暂时提示用户
      toast.error('验证码功能暂未开放');
      setIsSendingCode(false);
      return;

      /*
      const { data, error } = await authApi.sendEmailCode(email);

      setIsSendingCode(false);

      if (error) {
        toast.error(error);

        return;
      }

      if (!data || data.code !== 200) {
        toast.error(data?.message || '发送验证码失败');

        return;
      }

      toast.success('验证码已发送', {
        description: '请查收您的邮箱，验证码有效期为10分钟',
      });

      setCountdown(60);
      */
    } catch (error) {
      setIsSendingCode(false);
      toast.error(error instanceof Error ? error.message : '发送验证码失败，请稍后重试');
    }
  };

  return {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    countdown,
    isSendingCode,
    handleSendCode,
    register,
    handleSubmit,
    errors,
    setError,
  };
};
