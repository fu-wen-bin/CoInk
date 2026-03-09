# useAuth Hooks 修复文档

## 问题概述

GitHub 登录后的回调处理中，`useAuth.ts` 中的方法调用与 `authApi` 实际定义不一致，导致类型错误和运行时错误。

## 主要修复内容

### 1. 类型定义修复

#### 修改文件: `src/hooks/useAuth.ts`

**问题**: 使用了旧的 `AuthResponse` 类型（来自 `src/types/auth.ts`），与 `authApi` 返回的 `AuthResponseData` 不匹配。

**修复**:
```typescript
// 修改前
import type { User, AuthResponse, EmailPasswordRegisterParams } from '@/types/auth';

// 修改后
import type { AuthResponseData, User, RegisterParams } from '@/services/auth/types';
```

**差异说明**:

| 属性 | 旧类型 (AuthResponse) | 新类型 (AuthResponseData) |
|------|----------------------|--------------------------|
| Token | `token: string` | `accessToken: string` |
| 刷新Token | `refresh_token?: string` | `refreshToken: string` |
| 用户ID | `user?.id: number` | `user.userId: string` |

### 2. 方法调用修复

#### 修改文件: `src/hooks/useAuth.ts`

**问题 1**: `useEmailPasswordLogin` hook 调用不存在的 `authApi.emailPasswordLogin` 方法

**修复**:
```typescript
// 修改前
const { data, error } = await authApi.emailPasswordLogin({ email, password });

// 修改后
const { data, error } = await authApi.login({ email, password });
```

**问题 2**: `useEmailPasswordRegister` hook 调用不存在的 `authApi.emailPasswordRegister` 方法

**修复**:
```typescript
// 修改前
const { data, error } = await authApi.emailPasswordRegister({
  email,
  password,
  confirmPassword,
});

// 修改后
const { data, error } = await authApi.register({
  email,
  name: email.split('@')[0], // 使用邮箱前缀作为默认用户名
  password,
});
```

**问题 3**: `handleAuthSuccess` 函数调用 `authApi.getProfile()` 缺少必需的 `userId` 参数

**修复**:
```typescript
// 修改前
const { data: userResponse, error } = await authApi.getProfile();

// 修改后
const userId = authData.user?.userId;
if (!userId) {
  console.error('❌ 无法获取用户ID');
  toast.warning('无法获取用户ID，但登录成功');
  return;
}
const { data: userResponse, error } = await authApi.getProfile(userId);
```

**问题 4**: 注册成功后检查 `authData.token` 应为 `authData.accessToken`

**修复**:
```typescript
// 修改前
if (authData?.token) { ... }

// 修改后
if (authData?.accessToken) { ... }
```

### 3. HTTP-Only Cookie 适配

#### 修改文件: `src/hooks/useAuth.ts`

**问题**: 仍使用旧的 `saveAuthData` 函数手动保存 Token，但后端已使用 HTTP-Only Cookie

**修复**:
```typescript
// 修改前
import { saveAuthData } from '@/utils';
...
saveAuthData(authData);

// 修改后
import { setLoggedInFlag } from '@/utils/auth/cookie';
...
// HTTP-Only Cookie 已由后端自动设置，前端只需设置 logged_in 标记
setLoggedInFlag();
```

### 4. 回调页面修复

#### 修改文件: `src/app/auth/callback/page.tsx`

**问题**: URL Token 登录场景构造的 `authData` 类型与 `AuthResponseData` 不匹配

**修复**:
```typescript
// 修改前
const authData = {
  token,
  refresh_token: searchParams.get('refresh_token') || undefined,
  expires_in: searchParams.get('expires_in') ? parseInt(...) : undefined,
  refresh_expires_in: searchParams.get('refresh_expires_in') ? parseInt(...) : undefined,
};

// 修改后
const authData = {
  accessToken: token,
  refreshToken: searchParams.get('refresh_token') || '',
  user: {
    userId,
    name: userName,
    email: userEmail,
  },
};
```

同时修改了 URL 参数获取逻辑，现在需要同时提供 `token` 和 `userId` 参数。

### 5. 用户查询 Hook 修复

#### 修改文件: `src/hooks/useUserQuery.ts`

**问题 1**: 调用不存在的 `authApi.getCurrentUser()` 方法

**修复**: 修改为使用 `authApi.getProfile(userId)`，并接受 `userId` 作为参数

```typescript
// 修改前
export function useUserQuery() {
  return useQuery({
    queryKey: userQueryKeys.profile(),
    queryFn: async (): Promise<User> => {
      const { data, error } = await authApi.getCurrentUser();
      ...
    },
    enabled: hasValidAuthToken(),
  });
}

// 修改后
export function useUserQuery(userId?: string) {
  return useQuery({
    queryKey: [...userQueryKeys.profile(), userId],
    queryFn: async (): Promise<User | null> => {
      if (!userId) {
        // 尝试从本地缓存获取
        const cached = storage.get();
        return cached || null;
      }
      const { data, error } = await authApi.getProfile(userId);
      ...
    },
    enabled: isLoggedIn() && (!!userId || !!storage.get()),
  });
}
```

**问题 2**: 旧的 `User` 类型（`id: number`）与新的 `User` 类型（`userId: string`）不兼容

**修复**: 添加了旧格式到新格式的迁移逻辑

```typescript
// 添加迁移函数
function migrateUserFormat(legacy: LegacyUser): User {
  return {
    userId: String(legacy.id),
    email: (legacy as any).email || '',
    name: legacy.name,
    avatarUrl: legacy.avatar_url,
    createdAt: (legacy as any).created_at,
    updatedAt: (legacy as any).updated_at,
  };
}

// 在 storage.get() 中检测并转换
if (parsed.id && !parsed.userId) {
  return migrateUserFormat(parsed as LegacyUser);
}
```

**问题 3**: 清理函数使用旧的 `clearAuthData`，应使用新的 `clearLoggedInFlag`

**修复**:
```typescript
// 修改前
import { clearAuthData, hasValidAuthToken } from '@/utils';
...
clearAuthData();

// 修改后
import { clearLoggedInFlag, isLoggedIn } from '@/utils/auth/cookie';
...
clearLoggedInFlag();
```

## 文件修改清单

| 文件路径 | 修改类型 | 修改说明 |
|---------|---------|---------|
| `src/hooks/useAuth.ts` | 修改 | 修复类型导入、方法调用、HTTP-Only Cookie 适配 |
| `src/hooks/useUserQuery.ts` | 修改 | 修复方法调用、类型兼容性、清理函数 |
| `src/app/auth/callback/page.tsx` | 修改 | 修复 Token 登录场景的数据构造 |

## 向后兼容性说明

### 1. 用户数据格式迁移

旧版缓存的用户数据格式会被自动检测并转换为新版格式，无需用户操作。

### 2. useUserQuery 使用方式变更

新版 `useUserQuery` 需要传入 `userId` 参数：

```typescript
// 旧用法（已废弃）
const { data: user } = useUserQuery();

// 新用法
const { data: user } = useUserQuery(userId);

// 或仅在本地缓存中查找
const { data: user } = useUserQuery(); // 返回可能为 null
```

### 3. 认证状态检查

```typescript
// 旧方法（已废弃）
import { hasValidAuthToken } from '@/utils';
const isAuth = hasValidAuthToken();

// 新方法
import { isLoggedIn } from '@/utils/auth/cookie';
const isAuth = isLoggedIn();
```

## 验证方式

运行以下命令检查修复结果：

```bash
# 类型检查
cd /Users/fwb/WebstormProjects/CoInk/coInk
pnpm type-check

# 运行测试
pnpm test
```

## 相关接口文档

- 后端接口文档: `backEnd/docs/API.md`
- 认证服务实现: `src/services/auth/index.ts`
- 认证类型定义: `src/services/auth/types.ts`
