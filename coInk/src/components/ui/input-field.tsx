import { Eye, EyeOff } from 'lucide-react';
import { UseFormRegister } from 'react-hook-form';

import { InputWrapper } from './input-wrapper';

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  maxLength?: number;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  register?: UseFormRegister<any>;
  error?: string;
}

export const InputField = ({
  label,
  name,
  type = 'text',
  placeholder,
  maxLength,
  showPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
  register,
  error,
}: InputFieldProps) => {
  // 如果没有 register，打印警告
  if (!register) {
    console.warn(`InputField: register is undefined for field "${name}"`);
  }

  // 获取 register 返回的 props
  const registerProps = register ? register(name) : {};

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1.5">{label}</label>
      <InputWrapper>
        <div className="relative">
          <input
            {...registerProps}
            type={showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full bg-transparent text-base px-3.5 py-3 rounded-xl focus:outline-none text-gray-900 placeholder:text-gray-500 pr-12"
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute inset-y-0 right-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
              ) : (
                <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
              )}
            </button>
          )}
        </div>
      </InputWrapper>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
};
