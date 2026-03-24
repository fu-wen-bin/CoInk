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
  const handlersRef = useRef<Record<string, (payload: unknown) => void>>({});

  useEffect(() => {
    const socket = socketRef.current;
    const nextHandlers = handlers ?? {};
    const prevHandlers = handlersRef.current;

    if (socket) {
      Object.entries(prevHandlers).forEach(([event, handler]) => {
        const nextHandler = nextHandlers[event];
        if (!nextHandler || nextHandler !== handler) {
          socket.off(event, handler);
        }
      });

      Object.entries(nextHandlers).forEach(([event, handler]) => {
        const prevHandler = prevHandlers[event];
        if (!prevHandler || prevHandler !== handler) {
          socket.on(event, handler);
        }
      });
    }

    handlersRef.current = nextHandlers;
  }, [handlers]);

  useEffect(() => {
    if (!userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

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

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [userId]);

  return socketRef;
}
