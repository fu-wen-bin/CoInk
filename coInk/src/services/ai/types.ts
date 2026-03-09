/**
 * AI服务类型定义
 *
 * 功能说明：
 * - AI划词编辑功能类型
 * - 续写、改写、润色、翻译等
 * - 智能评论和问答
 *
 * @todo Phase 3: 实现AI划词编辑功能
 */

/**
 * AI操作类型
 */
export type AIOperation =
  | 'continue' // 续写
  | 'rewrite' // 改写
  | 'polish' // 润色
  | 'summarize' // 总结
  | 'translate' // 翻译
  | 'comment' // 智能评论
  | 'ask'; // 问答

/**
 * AI请求参数
 */
export interface AIRequest {
  /** 操作类型 */
  operation: AIOperation;
  /** 选中的文本 */
  selectedText: string;
  /** 文档上下文 */
  context?: string;
  /** 目标语言 (翻译用) */
  targetLang?: string;
  /** 语气风格 (改写用) */
  tone?: 'formal' | 'casual' | 'professional' | 'creative';
  /** 自定义提示词 */
  customPrompt?: string;
}

/**
 * AI响应
 */
export interface AIResponse {
  /** 生成的内容 */
  content: string;
  /** 操作类型 */
  operation: AIOperation;
  /** 替换范围 (用于划词替换) */
  range?: {
    from: number;
    to: number;
  };
}

/**
 * 智能评论
 */
export interface AIComment {
  /** 评论ID */
  commentId: string;
  /** 关联的文档位置 */
  position: {
    blockId: string;
    start: number;
    end: number;
  };
  /** 选中的原文 */
  originalText: string;
  /** AI建议 */
  suggestion: string;
  /** 建议类型 */
  type: 'grammar' | 'style' | 'clarity' | 'idea' | 'structure';
  /** 置信度 */
  confidence?: number;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 划词菜单配置
 */
export interface SelectionMenuItem {
  /** 菜单项ID */
  id: AIOperation;
  /** 显示名称 */
  label: string;
  /** 图标 */
  icon: string;
  /** 快捷键 */
  shortcut?: string;
  /** 是否需要选中文本 */
  requiresSelection?: boolean;
}

/**
 * 分析选中文本请求
 */
export interface AnalyzeSelectionRequest {
  /** 选中的文本 */
  text: string;
  /** 文档上下文 */
  context?: string;
  /** 分析类型 */
  analysisTypes?: Array<'grammar' | 'style' | 'clarity' | 'idea'>;
}

/**
 * 分析选中文本响应
 */
export interface AnalyzeSelectionResponse {
  /** 分析结果列表 */
  comments: AIComment[];
}

/**
 * 默认划词菜单项
 */
export const DEFAULT_SELECTION_MENU: SelectionMenuItem[] = [
  { id: 'continue', label: '续写', icon: 'Sparkles', shortcut: '⌘+K C', requiresSelection: false },
  { id: 'rewrite', label: '改写', icon: 'RefreshCw', shortcut: '⌘+K R', requiresSelection: true },
  { id: 'polish', label: '润色', icon: 'Wand2', shortcut: '⌘+K P', requiresSelection: true },
  { id: 'summarize', label: '总结', icon: 'FileText', shortcut: '⌘+K S', requiresSelection: true },
  { id: 'translate', label: '翻译', icon: 'Languages', shortcut: '⌘+K T', requiresSelection: true },
  {
    id: 'comment',
    label: '智能评论',
    icon: 'MessageSquare',
    shortcut: '⌘+K M',
    requiresSelection: true,
  },
  { id: 'ask', label: '询问AI', icon: 'Bot', shortcut: '⌘+K A', requiresSelection: false },
];

/**
 * AI生成请求 (通用)
 */
export interface AIGenerateRequest {
  /** 提示词 */
  prompt: string;
  /** 系统角色设定 */
  system?: string;
  /** 最大token数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
}

/**
 * AI生成响应 (流式)
 */
export interface AIGenerateResponse {
  /** 生成的内容块 */
  chunk: string;
  /** 是否结束 */
  done: boolean;
}
