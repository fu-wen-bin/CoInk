import type { Language } from '@tiptap-pro/extension-ai';

export const SUPPORTED_LANGUAGES: Array<{
  label: string;
  value: Language;
}> = [
  { label: '英语', value: 'en' },
  { label: '韩语', value: 'ko' },
  { label: '中文', value: 'zh' },
  { label: '日语', value: 'ja' },
  { label: '西班牙语', value: 'es' },
  { label: '俄语', value: 'ru' },
  { label: '法语', value: 'fr' },
  { label: '葡萄牙语', value: 'pt' },
  { label: '德语', value: 'de' },
  { label: '意大利语', value: 'it' },
  { label: '荷兰语', value: 'nl' },
  { label: '印尼语', value: 'id' },
  { label: '越南语', value: 'vi' },
  { label: '土耳其语', value: 'tr' },
  { label: '阿拉伯语', value: 'ar' },
];

export const SUPPORTED_TONES: Array<{ label: string; value: string }> = [
  { label: '学术', value: 'academic' },
  { label: '商务', value: 'business' },
  { label: '轻松', value: 'casual' },
  { label: '儿童友好', value: 'childfriendly' },
  { label: '自信', value: 'confident' },
  { label: '对话', value: 'conversational' },
  { label: '创意', value: 'creative' },
  { label: '情感', value: 'emotional' },
  { label: '激昂', value: 'excited' },
  { label: '正式', value: 'formal' },
  { label: '友好', value: 'friendly' },
  { label: '搞笑', value: 'funny' },
  { label: '幽默', value: 'humorous' },
  { label: '信息型', value: 'informative' },
  { label: '鼓舞', value: 'inspirational' },
  { label: '梗图风格', value: 'memeify' },
  { label: '叙事', value: 'narrative' },
  { label: '客观', value: 'objective' },
  { label: '说服', value: 'persuasive' },
  { label: '诗意', value: 'poetic' },
];
