/**
 * Validation constants used across the application
 */
export const VALIDATION = {
  NAME: {
    minLength: 1,
    maxLength: 20,
  },
  EMAIL: {
    maxLength: 255,
  },
  PASSWORD: {
    minLength: 6,
    maxLength: 255,
  },
  TITLE: {
    minLength: 1,
    maxLength: 512,
  },
  DESCRIPTION: {
    maxLength: 1024,
  },
  URL: {
    maxLength: 512,
  },
  CONTENT: {
    maxLength: 50000,
  },
  TAG: {
    minLength: 1,
    maxLength: 32,
    maxCount: 10,
  },
  CATEGORY: {
    minLength: 1,
    maxLength: 64,
  },
} as const;

/**
 * Error messages for validation
 */
export const VALIDATION_MESSAGES = {
  NAME: {
    minLength: `名称至少 ${VALIDATION.NAME.minLength} 个字符`,
    maxLength: `名称最多 ${VALIDATION.NAME.maxLength} 个字符`,
  },
  EMAIL: {
    invalid: '邮箱格式不正确',
    maxLength: `邮箱最多 ${VALIDATION.EMAIL.maxLength} 个字符`,
  },
  PASSWORD: {
    minLength: `密码至少 ${VALIDATION.PASSWORD.minLength} 个字符`,
    maxLength: `密码最多 ${VALIDATION.PASSWORD.maxLength} 个字符`,
  },
  TITLE: {
    minLength: `标题不能为空`,
    maxLength: `标题最多 ${VALIDATION.TITLE.maxLength} 个字符`,
  },
  DESCRIPTION: {
    maxLength: `描述最多 ${VALIDATION.DESCRIPTION.maxLength} 个字符`,
  },
  URL: {
    maxLength: `链接最多 ${VALIDATION.URL.maxLength} 个字符`,
    invalid: '链接格式不正确',
  },
  TAG: {
    maxCount: `最多 ${VALIDATION.TAG.maxCount} 个标签`,
    maxLength: `单个标签最多 ${VALIDATION.TAG.maxLength} 个字符`,
  },
  REQUIRED: '此项为必填项',
} as const;
