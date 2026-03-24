'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const resolveServerOrigin = () => {
  const raw = process.env.NEXT_PUBLIC_SERVER_URL?.trim() ?? '';
  if (raw) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:8888';
};

export function useAppRealtime(
  userId: string | null,
  handlers?: Record<string, (payload: unknown) => void>,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io(resolveServerOrigin(), {
      path: '/ws/app',
      transports: ['websocket'],
      query: { userId },
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { userId });
    });

    if (handlers) {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    }

    return () => {
      if (handlers) {
        Object.entries(handlers).forEach(([event, handler]) => {
          socket.off(event, handler);
        });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handlers, userId]);

  return socketRef;
}

