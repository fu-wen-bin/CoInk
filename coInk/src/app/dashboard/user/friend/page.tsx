'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FriendPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/contacts');
  }, [router]);

  return null;
}
