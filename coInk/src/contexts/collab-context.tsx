'use client';

import { createContext, useContext, useMemo } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { Doc as YDoc } from 'yjs';

export type CollabContextValue = {
  provider: HocuspocusProvider | null;
  ydoc: YDoc;
  hasCollab: boolean;
};

export const CollabContext = createContext<CollabContextValue>({
  hasCollab: false,
  provider: null,
  ydoc: new YDoc(),
});

export const CollabConsumer = CollabContext.Consumer;
export const useCollab = (): CollabContextValue => {
  const context = useContext(CollabContext);
  if (!context) {
    throw new Error('useCollab must be used within a CollabProvider');
  }
  return context;
};

export function CollabProvider({
  children,
  provider,
  ydoc,
  hasCollab = true,
}: Readonly<{
  children: React.ReactNode;
  provider: HocuspocusProvider | null;
  ydoc: YDoc;
  hasCollab?: boolean;
}>) {
  const value = useMemo<CollabContextValue>(
    () => ({
      hasCollab,
      provider,
      ydoc,
    }),
    [hasCollab, provider, ydoc],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
