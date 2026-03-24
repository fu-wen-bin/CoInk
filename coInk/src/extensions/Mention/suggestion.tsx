import { ReactRenderer } from '@tiptap/react';
import { Editor } from '@tiptap/core';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { RefAttributes } from 'react';

import MentionPopover, { MentionPopoverRef } from './components/MentionPopover';
import { MentionListProps, MentionUser } from './types';

import friendService from '@/services/friend';
import type { Friend } from '@/services/friend/types';

const extensionName = 'mentionSuggestion';

// 缓存好友列表，避免频繁请求
let cachedFriends: MentionUser[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 将好友数据转换为 MentionUser 格式
 */
const convertFriendToMentionUser = (friend: Friend): MentionUser => {
  return {
    id: friend.userId,
    name: friend.name,
    email: friend.email ?? undefined,
    avatar: friend.avatarUrl ?? undefined,
    role: '好友',
  };
};

/**
 * 获取好友列表并转换为 MentionUser 格式
 */
const getFriendsAsMentionUsers = async (): Promise<MentionUser[]> => {
  // 检查缓存是否有效
  if (cachedFriends && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedFriends;
  }

  try {
    const cached = localStorage.getItem('cached_user_profile');
    let userId: string | undefined;
    try {
      userId = cached ? (JSON.parse(cached) as { userId?: string })?.userId : undefined;
    } catch {
      userId = undefined;
    }

    if (!userId) {
      return [];
    }

    const friendsData = await friendService.getFriendList(userId);
    const list = friendsData.data?.data;

    if (!Array.isArray(list)) {
      console.warn('好友列表为空或格式不正确');

      return [];
    }

    // 转换为 MentionUser 格式
    const mentionUsers = list.map(convertFriendToMentionUser);

    // 更新缓存
    cachedFriends = mentionUsers;
    cacheTimestamp = Date.now();

    return mentionUsers;
  } catch (error) {
    console.error('获取好友列表失败:', error);

    // 返回空数组而不是抛出错误
    return [];
  }
};

export interface MentionSuggestionOptions {
  getUsers?: () => MentionUser[] | Promise<MentionUser[]>;
}

/**
 * 清除好友列表缓存（可在好友列表更新时调用）
 */
export const clearMentionCache = () => {
  cachedFriends = null;
  cacheTimestamp = null;
};

export const createMentionSuggestion = (options?: MentionSuggestionOptions) => {
  const getUsers = options?.getUsers || getFriendsAsMentionUsers;

  return {
    items: async ({ query }: { editor: Editor; query: string }) => {
      const users = await getUsers();

      if (!query) {
        return users.slice(0, 10);
      }

      const lowerQuery = query.toLowerCase();

      return users
        .filter(
          (user) =>
            user.name.toLowerCase().includes(lowerQuery) ||
            (user.email && user.email.toLowerCase().includes(lowerQuery)) ||
            (user.role && user.role.toLowerCase().includes(lowerQuery)),
        )
        .slice(0, 10);
    },

    render: () => {
      let component: ReactRenderer<
        MentionPopoverRef,
        MentionListProps & { anchorRect: DOMRect } & RefAttributes<MentionPopoverRef>
      >;

      let scrollHandler: (() => void) | null = null;

      return {
        onStart: (props: SuggestionProps<MentionUser>) => {
          const view = props.editor.view;

          const getReferenceClientRect = () => {
            if (!props.clientRect) {
              return (props.editor.storage as any)[extensionName]?.rect;
            }

            const rect = props.clientRect();

            if (!rect) {
              return (props.editor.storage as any)[extensionName]?.rect;
            }

            let yPos = rect.y;

            if (rect.top + 300 > window.innerHeight) {
              const diff = rect.top + 300 - window.innerHeight + 40;
              yPos = rect.y - diff;
            }

            return new DOMRect(rect.x, yPos, rect.width, rect.height);
          };

          component = new ReactRenderer(MentionPopover, {
            props: {
              ...props,
              anchorRect: getReferenceClientRect(),
            },
            editor: props.editor,
          });

          scrollHandler = () => {
            if (!getReferenceClientRect()) return;
            component.updateProps({
              anchorRect: getReferenceClientRect(),
            });
          };

          view.dom.parentElement?.parentElement?.addEventListener('scroll', scrollHandler);
        },

        onUpdate(props: SuggestionProps<MentionUser>) {
          const getReferenceClientRect = () => {
            if (!props.clientRect) {
              return (props.editor.storage as any)[extensionName]?.rect;
            }

            const rect = props.clientRect();

            if (!rect) {
              return (props.editor.storage as any)[extensionName]?.rect;
            }

            let yPos = rect.y;

            if (rect.top + 300 > window.innerHeight) {
              const diff = rect.top + 300 - window.innerHeight + 40;
              yPos = rect.y - diff;
            }

            return new DOMRect(rect.x, yPos, rect.width, rect.height);
          };

          (props.editor.storage as any)[extensionName] = {
            rect: props.clientRect
              ? getReferenceClientRect()
              : {
                  width: 0,
                  height: 0,
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                },
          };

          const anchorRect = getReferenceClientRect();

          component.updateProps({
            ...props,
            anchorRect,
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === 'Escape') {
            component.destroy();

            return true;
          }

          return component.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          if (scrollHandler) {
            const view = component.editor.view;
            view.dom.parentElement?.parentElement?.removeEventListener('scroll', scrollHandler);
          }

          component.destroy();
        },
      };
    },
  };
};

export const mentionSuggestion = createMentionSuggestion();

export default mentionSuggestion;
