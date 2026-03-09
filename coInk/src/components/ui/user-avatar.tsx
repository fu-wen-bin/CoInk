'use client';

import { motion } from 'framer-motion';
import { User as UserIcon, Camera } from 'lucide-react';
import Spinner from './Spinner';

interface UserAvatarProps {
  user: { name: string; avatarUrl?: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  onUpload?: (file: File) => void;
  isUploading?: boolean;
}

const sizeMap = {
  sm: { container: 'w-10 h-10', text: 'text-sm', icon: 'w-4 h-4' },
  md: { container: 'w-16 h-16', text: 'text-lg', icon: 'w-6 h-6' },
  lg: { container: 'w-24 h-24', text: 'text-2xl', icon: 'w-8 h-8' },
  xl: { container: 'w-32 h-32', text: 'text-4xl', icon: 'w-12 h-12' },
};

export function UserAvatar({
  user,
  size = 'md',
  editable = false,
  onUpload,
  isUploading = false,
}: UserAvatarProps) {
  const { container, text, icon } = sizeMap[size];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  return (
    <div className="relative">
      <motion.div
        whileHover={editable ? { scale: 1.05 } : undefined}
        className="relative group"
      >
        <div
          className={`${container} rounded-full overflow-hidden ring-4 ring-white/30 shadow-2xl bg-white`}
        >
          {isUploading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Spinner className="border-emerald-600" />
            </div>
          ) : user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || '用户头像'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          {/* 默认头像 fallback */}
          <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-green-100 font-bold text-emerald-600 ${
              user.avatarUrl ? 'hidden' : ''
            } ${text}`}
          >
            {user.name?.[0]?.toUpperCase() || (
              <UserIcon className={icon} />
            )}
          </div>
        </div>

        {/* 上传覆盖层 */}
        {editable && (
          <>
            <motion.label
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded-full cursor-pointer transition-all duration-200"
              htmlFor="avatar-upload"
            >
              <div className="text-center">
                <Camera className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs font-medium">更换</span>
              </div>
            </motion.label>
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}

export default UserAvatar;
