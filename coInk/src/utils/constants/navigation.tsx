import { ReactNode } from 'react';
import { User, FileText, LayoutDashboard, Podcast, Users, Building2, Bell } from 'lucide-react';

// Import route constants from routes.ts (Edge runtime compatible)
import { ROUTES } from '@/utils';

// 导航项接口
export interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
  tourContent?: string; // 可选的引导配置
}

// 导航项列表
export const NAV_ITEMS: NavItem[] = [
  {
    name: '仪表盘',
    href: ROUTES.DASHBOARD,
    icon: <LayoutDashboard className="w-5 h-5" />,
    tourContent: '仪表盘用于展示系统概览和关键指标，帮助你快速了解当前工作状态。',
  },
  {
    name: '文档',
    href: ROUTES.DOCS,
    icon: <FileText className="w-5 h-5" />,
    external: true,
    tourContent: '文档模块用于文档的编辑和管理，是协作文档的核心入口。',
  },
  {
    name: '通讯录',
    href: ROUTES.CONTACTS,
    icon: <Users className="w-5 h-5" />,
    tourContent: '通讯录用于管理联系人、同事及外部联系人，方便快速协作与沟通。',
  },
  {
    name: '消息通知',
    href: ROUTES.INBOX,
    icon: <Bell className="w-5 h-5" />,
    tourContent: '消息通知用于查看系统通知、好友申请和权限请求。',
  },
  {
    name: '分组管理',
    href: ROUTES.GROUPS,
    icon: <Building2 className="w-5 h-5" />,
    tourContent: '分组管理用于管理组织架构、成员与权限，是企业级协作的基础配置。',
  },
  {
    name: '我的资料',
    href: ROUTES.USER,
    icon: <User className="w-5 h-5" />,
    tourContent: '个人资料页面用于设置个人信息、账号与偏好。',
  },
  {
    name: '播客',
    href: ROUTES.PODCAST,
    icon: <Podcast className="w-5 h-5" />,
    tourContent: '播客模块提供播客相关能力，用于创建和管理播客内容。',
  },
];
